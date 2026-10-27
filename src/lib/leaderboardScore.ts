/**
 * The leaderboard's weekly % (the grid at /attendance and /curator/leaderboard), apart from the page.
 *
 * % = Σ(weight × part%) ÷ Σ(weights of the parts that exist), over three parts:
 * Attendance 40, Homework 40, Test 20. A part that does not exist for a student that week is left
 * out of both sums — nothing else is re-weighted. A homework that was handed in but is not graded yet
 * is left out until it is graded (it is counted in `homework.pending`). A homework not handed in counts 0
 * only once its due date has passed; before that it is left out and counted in `homework.not_due`.
 * The activity star is not part of it.
 * A group with no weekly test at all (Pre-SAT, or its platform-tests switch off) has no test part, even
 * for a student who happens to have a score (`testsOff`). The test is judged against its own closing time
 * (`testClosesAt`): a student without a score while it is still open has no test part yet (`open`); after it
 * closes, no score is 0 (`skipped`) when the group had a test; a score handed in after the close (the server
 * says so in `test_late`) counts half (`late`).
 *
 * Kept here because the maths is the one thing on that screen worth unit-testing (there are no
 * component tests), and because the popover that shows a student their own sum must read the very
 * numbers the cell was coloured from.
 */
import { displaysAsAbsence } from './excusedAbsence';

/**
 * Manual columns taken out of the grid. Every name listed is hidden (header, cells, toggles) and
 * ignored by the maths in every week, old weeks included; nothing is written to them any more, so
 * what is stored stays as it was. Removing a name here is all it takes to show that column again.
 */
export const RETIRED_LEADERBOARD_COLUMNS = [
  'curator_hour',
  'study_buddy',
  'self_reflection_journal',
  'weekly_evaluation',
  'extra_points',
] as const;

export type RetiredLeaderboardColumn = (typeof RETIRED_LEADERBOARD_COLUMNS)[number];

export function isRetiredColumn(column: string): boolean {
  return (RETIRED_LEADERBOARD_COLUMNS as readonly string[]).includes(column);
}

/** A copy of a save payload without the retired fields, so a save never touches their stored values. */
export function withoutRetiredColumns<T extends object>(entry: T): T {
  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (!isRetiredColumn(key)) kept[key] = value;
  }
  return kept as T;
}

export const SCORE_WEIGHTS = { attendance: 40, homework: 40, test: 20 } as const;

export type ScorePart = keyof typeof SCORE_WEIGHTS;

// -- input shapes (structural, so the page's own row types fit without a cast) ---------------------

export interface ScoreHomeworkMeta {
  id: number;
  max_score?: number | null;
  /** When it is due (ISO instant); without one it counts 0 as soon as its lesson has happened. */
  due_date?: string | null;
}

export interface ScoreLessonMeta {
  lesson_number: number;
  start_datetime: string;
  homework?: ScoreHomeworkMeta;
  homeworks?: ScoreHomeworkMeta[];
}

export interface ScoreHomeworkStatus {
  assignment_id?: number;
  /** Handed in. With no score yet it is «pending» — left out of the average until it is graded. */
  submitted?: boolean;
  score: number | null;
  max_score?: number | null;
  /** The student's own deadline (an extension), else the assignment's. */
  due_date?: string | null;
}

export interface ScoreStudentLesson {
  attendance_status: string;
  enrolled?: boolean;
  marked?: boolean;
  frozen?: boolean;
  blocked?: boolean;
  excused?: boolean;
  homework_status?: ScoreHomeworkStatus | null;
  homework_statuses?: ScoreHomeworkStatus[];
}

export interface ScoreStudent {
  lessons: Record<string, ScoreStudentLesson>;
  test_percent?: number | null;
  mock_exam?: number | null;
  /** The platform result came in at or after the close of its set: it counts half. */
  test_late?: boolean;
}

// -- the rules -------------------------------------------------------------------------------------

/** All homeworks assigned to a lesson; falls back to the legacy single-homework field. */
export function lessonHomeworkMetas(meta?: ScoreLessonMeta): ScoreHomeworkMeta[] {
  return meta?.homeworks ?? (meta?.homework ? [meta.homework] : []);
}

function lessonHomeworkStatuses(lesson?: ScoreStudentLesson): ScoreHomeworkStatus[] {
  return lesson?.homework_statuses ?? (lesson?.homework_status ? [lesson.homework_status] : []);
}

/** The lesson is not the student's: before they joined, inside a freeze, or while their login was off. */
function isNotTheirs(lesson?: ScoreStudentLesson): boolean {
  return Boolean(lesson && (lesson.enrolled === false || lesson.frozen || lesson.blocked));
}

/** «Был» and «Опоздал» both count as attended. */
function isAttended(status: string): boolean {
  return status === 'attended' || status === 'late';
}

/** A lesson that has not happened yet: it counts for nothing, neither attendance nor homework. */
function hasNotHappened(startDatetime: string | undefined, isFuture: (startDatetime: string) => boolean): boolean {
  // `isFuture` is `isAttendanceLockedLesson`: the lesson's Almaty day is after today. Today's lesson is not future.
  return startDatetime !== undefined && isFuture(startDatetime);
}

/**
 * Whether a lesson goes into the attendance part. Left out: a lesson that has not happened yet,
 * cancelled, not the student's, an excused absence, and a past lesson nobody has marked yet (no data).
 */
export function isCountableForAttendance(
  lesson: ScoreStudentLesson | undefined,
  startDatetime: string | undefined,
  isFuture: (startDatetime: string) => boolean,
): boolean {
  if (hasNotHappened(startDatetime, isFuture)) return false;
  if (!lesson) return true;
  if (lesson.attendance_status === 'cancelled') return false;
  if (isNotTheirs(lesson)) return false;
  if (lesson.excused && displaysAsAbsence(lesson.attendance_status)) return false;
  if (lesson.marked === false) return false;
  return true;
}

/**
 * Whether a lesson's homework goes into the homework part. Homework follows the student, not the
 * register: a cancelled, excused or still-unmarked lesson keeps its homework. Left out: a lesson
 * that has not happened yet (even if something was already handed in) and one that is not the student's.
 */
export function isCountableForHomework(
  lesson: ScoreStudentLesson | undefined,
  startDatetime: string | undefined,
  isFuture: (startDatetime: string) => boolean,
): boolean {
  return !hasNotHappened(startDatetime, isFuture) && !isNotTheirs(lesson);
}

/** Handed in and not graded yet. It stays out of the homework part until a score exists. */
function isPendingHomework(status: ScoreHomeworkStatus): boolean {
  return status.submitted === true && (status.score === null || status.score === undefined);
}

/** An ISO instant as epoch milliseconds; an offset-less stamp is UTC (the server's). NaN-safe: null when unreadable. */
export function parseInstant(value: string | null | undefined): number | null {
  if (!value) return null;
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : hasOffset ? value : `${value}Z`;
  const ms = Date.parse(text);
  return Number.isNaN(ms) ? null : ms;
}

/** Not handed in: not submitted and no score. */
function isUnsubmittedHomework(status: ScoreHomeworkStatus): boolean {
  return status.submitted !== true && (status.score === null || status.score === undefined);
}

/** The homework's deadline has not passed (handing in at the very deadline is still on time). */
function isBeforeDeadline(due: string | null | undefined, nowMs: number | null): boolean {
  const dueMs = parseInstant(due);
  return dueMs !== null && nowMs !== null && nowMs <= dueMs;
}

/** The deadline of one homework: the student's own (an extension) on the status, else the assignment's. */
function statusDue(status: ScoreHomeworkStatus, assigned: ScoreHomeworkMeta[]): string | null | undefined {
  if (status.due_date !== undefined && status.due_date !== null) return status.due_date;
  return assigned.find((m) => status.assignment_id !== undefined && m.id === status.assignment_id)?.due_date;
}

/** Assigned homeworks that have no status row, as many as the lesson is short of statuses (matched by id first). */
function homeworksWithoutStatus(assigned: ScoreHomeworkMeta[], statuses: ScoreHomeworkStatus[]): Partial<ScoreHomeworkMeta>[] {
  const need = Math.max(0, assigned.length - statuses.length);
  const have = new Set(statuses.map((s) => s.assignment_id));
  const missing: Partial<ScoreHomeworkMeta>[] = assigned.filter((m) => !have.has(m.id)).slice(0, need);
  while (missing.length < need) missing.push({});
  return missing;
}

/** One homework as a share of its maximum: score ÷ max, so a 30-point homework weighs like a 10-point one. */
function homeworkShare(status: ScoreHomeworkStatus, assigned: ScoreHomeworkMeta[]): number {
  if (status.score === null || status.score === undefined) return 0;
  const metaMax = assigned.find((m) => m.id === status.assignment_id)?.max_score ?? assigned[0]?.max_score;
  const max = status.max_score ?? metaMax ?? 0;
  if (!max || max <= 0) return 0;
  return status.score / max;
}

/** The student's test % that week: the platform score, else a manual one above zero, else none. */
export function studentTestPercent(student: Pick<ScoreStudent, 'test_percent' | 'mock_exam'>): number | null {
  // An older backend does not send test_percent; its mock_exam is the same number, 0 meaning none.
  if (student.test_percent !== undefined) return student.test_percent;
  return student.mock_exam != null && student.mock_exam > 0 ? student.mock_exam : null;
}

/** Whether the group had a test that week: at least one student has a score. */
export function groupHasTest(students: Pick<ScoreStudent, 'test_percent' | 'mock_exam'>[]): boolean {
  return students.some((s) => studentTestPercent(s) !== null);
}

export interface WeeklyScoreInput {
  lessons: ScoreLessonMeta[];
  student: ScoreStudent;
  /** Whether the group had a test that week — see {@link groupHasTest}. */
  testHeld: boolean;
  /** The group has no weekly test (Pre-SAT / platform tests off): never a test part, scored or not. */
  testsOff?: boolean;
  /** The instant that judges homework due dates and the test close (ISO). Absent: every deadline has passed. */
  now?: string | null;
  /** When the week's test closes (ISO); absent: unknown, treated as closed. */
  testClosesAt?: string | null;
  isFuture: (startDatetime: string) => boolean;
}

export interface WeeklyScore {
  attendance: { attended: number; countable: number; percent: number | null };
  /** `assigned` = homeworks in the average; `pending` = handed in, waiting for a grade, left out;
   *  `not_due` = not handed in but the due date has not passed, left out. */
  homework: { assigned: number; pending: number; not_due: number; percent: number | null };
  /**
   * `scored` = the result counts in full; `late` = finished after the close, `percent` is half of `raw_percent`;
   * `open` = no score yet while the test is still open (no test part); `skipped` = the test closed (the group had
   * one) and this student has no score (counts 0); `none` = no test that week.
   */
  test: { state: 'scored' | 'late' | 'open' | 'skipped' | 'none'; percent: number | null; raw_percent: number | null };
  /** The parts that exist, in display order, with the percentage each contributes. */
  parts: { part: ScorePart; weight: number; percent: number }[];
  /** Whole percent, or null when no part exists («—»). */
  percent: number | null;
}

const LATE_FACTOR = 0.5;

export function weeklyScore({ lessons, student, testHeld, testsOff = false, now, testClosesAt, isFuture }: WeeklyScoreInput): WeeklyScore {
  const nowMs = parseInstant(now);
  const closesMs = parseInstant(testClosesAt);
  let attended = 0;
  let countable = 0;
  const shares: number[] = [];
  let pending = 0;
  let notDue = 0;

  for (const meta of lessons) {
    const lesson = student.lessons[meta.lesson_number.toString()];

    if (isCountableForAttendance(lesson, meta.start_datetime, isFuture)) {
      countable += 1;
      if (lesson && isAttended(lesson.attendance_status)) attended += 1;
    }

    if (!isCountableForHomework(lesson, meta.start_datetime, isFuture)) continue;
    const assigned = lessonHomeworkMetas(meta);
    const statuses = lessonHomeworkStatuses(lesson);
    for (const status of statuses) {
      if (isPendingHomework(status)) {
        pending += 1;
      } else if (isUnsubmittedHomework(status) && isBeforeDeadline(statusDue(status, assigned), nowMs)) {
        notDue += 1;
      } else {
        shares.push(homeworkShare(status, assigned));
      }
    }
    // Assigned but without a status row: unsubmitted, so it counts as 0 once its due date has passed.
    for (const unsent of homeworksWithoutStatus(assigned, statuses)) {
      if (isBeforeDeadline(unsent.due_date, nowMs)) notDue += 1;
      else shares.push(0);
    }
  }

  const attendancePercent = countable > 0 ? (attended / countable) * 100 : null;
  const homeworkPercent = shares.length > 0 ? (shares.reduce((a, b) => a + b, 0) / shares.length) * 100 : null;

  const testPercent = studentTestPercent(student);
  const testOpen = nowMs !== null && closesMs !== null && nowMs < closesMs;
  const test: WeeklyScore['test'] = testsOff
    ? { state: 'none', percent: null, raw_percent: null }
    : testPercent !== null && student.test_late === true
      ? { state: 'late', percent: testPercent * LATE_FACTOR, raw_percent: testPercent }
      : testPercent !== null
        ? { state: 'scored', percent: testPercent, raw_percent: testPercent }
        : testOpen
          ? { state: 'open', percent: null, raw_percent: null }
          : testHeld
            ? { state: 'skipped', percent: 0, raw_percent: null }
            : { state: 'none', percent: null, raw_percent: null };

  const parts: WeeklyScore['parts'] = [];
  if (attendancePercent !== null) parts.push({ part: 'attendance', weight: SCORE_WEIGHTS.attendance, percent: attendancePercent });
  if (homeworkPercent !== null) parts.push({ part: 'homework', weight: SCORE_WEIGHTS.homework, percent: homeworkPercent });
  if (test.percent !== null) parts.push({ part: 'test', weight: SCORE_WEIGHTS.test, percent: test.percent });

  const weights = parts.reduce((sum, p) => sum + p.weight, 0);
  const percent = weights > 0 ? Math.round(parts.reduce((sum, p) => sum + p.weight * p.percent, 0) / weights) : null;

  return {
    attendance: { attended, countable, percent: attendancePercent },
    homework: { assigned: shares.length, pending, not_due: notDue, percent: homeworkPercent },
    test,
    parts,
    percent,
  };
}

/**
 * The leaderboard's weekly % (the grid at /attendance and /curator/leaderboard), apart from the page.
 *
 * % = Σ(weight × part%) ÷ Σ(weights of the parts that exist), over three parts:
 * Attendance 40, Homework 40, Test 20. A part that does not exist for a student that week is left
 * out of both sums — nothing else is re-weighted. The activity star is not part of it.
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
}

export interface ScoreLessonMeta {
  lesson_number: number;
  start_datetime: string;
  homework?: ScoreHomeworkMeta;
  homeworks?: ScoreHomeworkMeta[];
}

export interface ScoreHomeworkStatus {
  assignment_id?: number;
  score: number | null;
  max_score?: number | null;
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
function hasNotHappened(startDatetime: string | undefined, isLocked: (startDatetime: string) => boolean): boolean {
  // `isLocked` is the register lock (`isAttendanceLockedLesson`): the Almaty day of the lesson is after today.
  return startDatetime !== undefined && isLocked(startDatetime);
}

/**
 * Whether a lesson goes into the attendance part. Left out: a lesson that has not happened yet,
 * cancelled, not the student's, an excused absence, and a past lesson nobody has marked yet (no data).
 */
export function isCountableForAttendance(
  lesson: ScoreStudentLesson | undefined,
  startDatetime: string | undefined,
  isLocked: (startDatetime: string) => boolean,
): boolean {
  if (hasNotHappened(startDatetime, isLocked)) return false;
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
  isLocked: (startDatetime: string) => boolean,
): boolean {
  return !hasNotHappened(startDatetime, isLocked) && !isNotTheirs(lesson);
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
  isLocked: (startDatetime: string) => boolean;
}

export interface WeeklyScore {
  attendance: { attended: number; countable: number; percent: number | null };
  homework: { assigned: number; percent: number | null };
  /** `skipped` = the group had a test and this student has no score (counts 0); `none` = nobody had one. */
  test: { state: 'scored' | 'skipped' | 'none'; percent: number | null };
  /** The parts that exist, in display order, with the percentage each contributes. */
  parts: { part: ScorePart; weight: number; percent: number }[];
  /** Whole percent, or null when no part exists («—»). */
  percent: number | null;
}

export function weeklyScore({ lessons, student, testHeld, isLocked }: WeeklyScoreInput): WeeklyScore {
  let attended = 0;
  let countable = 0;
  const shares: number[] = [];

  for (const meta of lessons) {
    const lesson = student.lessons[meta.lesson_number.toString()];

    if (isCountableForAttendance(lesson, meta.start_datetime, isLocked)) {
      countable += 1;
      if (lesson && isAttended(lesson.attendance_status)) attended += 1;
    }

    if (!isCountableForHomework(lesson, meta.start_datetime, isLocked)) continue;
    const assigned = lessonHomeworkMetas(meta);
    const statuses = lessonHomeworkStatuses(lesson);
    for (const status of statuses) shares.push(homeworkShare(status, assigned));
    // Assigned but without a status row: unsubmitted, so it counts as 0.
    for (let i = statuses.length; i < assigned.length; i += 1) shares.push(0);
  }

  const attendancePercent = countable > 0 ? (attended / countable) * 100 : null;
  const homeworkPercent = shares.length > 0 ? (shares.reduce((a, b) => a + b, 0) / shares.length) * 100 : null;

  const testPercent = studentTestPercent(student);
  const test: WeeklyScore['test'] =
    testPercent !== null
      ? { state: 'scored', percent: testPercent }
      : testHeld
        ? { state: 'skipped', percent: 0 }
        : { state: 'none', percent: null };

  const parts: WeeklyScore['parts'] = [];
  if (attendancePercent !== null) parts.push({ part: 'attendance', weight: SCORE_WEIGHTS.attendance, percent: attendancePercent });
  if (homeworkPercent !== null) parts.push({ part: 'homework', weight: SCORE_WEIGHTS.homework, percent: homeworkPercent });
  if (test.percent !== null) parts.push({ part: 'test', weight: SCORE_WEIGHTS.test, percent: test.percent });

  const weights = parts.reduce((sum, p) => sum + p.weight, 0);
  const percent = weights > 0 ? Math.round(parts.reduce((sum, p) => sum + p.weight * p.percent, 0) / weights) : null;

  return {
    attendance: { attended, countable, percent: attendancePercent },
    homework: { assigned: shares.length, percent: homeworkPercent },
    test,
    parts,
    percent,
  };
}

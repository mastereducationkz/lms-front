import { describe, expect, it } from 'vitest';
import {
  RETIRED_LEADERBOARD_COLUMNS,
  groupHasTest,
  isRetiredColumn,
  parseInstant,
  studentTestPercent,
  weeklyScore,
  withoutRetiredColumns,
  type ScoreLessonMeta,
  type ScoreStudent,
  type ScoreStudentLesson,
} from './leaderboardScore';

const PAST = '2026-06-01T10:00:00';
const FUTURE = '2099-01-01T10:00:00';
const TODAY = '2026-10-26T10:00:00';
const isFuture = (start: string) => start === FUTURE;

const meta = (n: number, opts: { start?: string; hw?: { id: number; max_score?: number }[] } = {}): ScoreLessonMeta => ({
  lesson_number: n,
  start_datetime: opts.start ?? PAST,
  homeworks: opts.hw ?? [],
});

const att = (status: string, extra: Partial<ScoreStudentLesson> = {}): ScoreStudentLesson => ({
  attendance_status: status,
  marked: true,
  enrolled: true,
  ...extra,
});

const student = (lessons: Record<string, ScoreStudentLesson>, test: number | null = null): ScoreStudent => ({
  lessons,
  test_percent: test,
});

const hwDone = (id: number, score: number | null, max = 10) => ({ assignment_id: id, score, max_score: max });

function score(lessons: ScoreLessonMeta[], s: ScoreStudent, testHeld = false) {
  return weeklyScore({ lessons, student: s, testHeld, isFuture });
}

describe('retired columns', () => {
  it('lists the five dead manual columns, in one place', () => {
    expect([...RETIRED_LEADERBOARD_COLUMNS]).toEqual([
      'curator_hour', 'study_buddy', 'self_reflection_journal', 'weekly_evaluation', 'extra_points',
    ]);
    expect(isRetiredColumn('study_buddy')).toBe(true);
    expect(isRetiredColumn('mock_exam')).toBe(false);
  });

  it('a save payload loses the retired fields and keeps everything else', () => {
    const payload = { user_id: 1, group_id: 2, week_number: 3, mock_exam: 70, curator_hour: 5, study_buddy: 15, extra_points: 1 };
    expect(withoutRetiredColumns(payload)).toEqual({ user_id: 1, group_id: 2, week_number: 3, mock_exam: 70 });
  });
});

describe('the weighted examples', () => {
  // 3 lessons all attended, and homework averaging 83 % (5/6 of the maximum each way below).
  const lessons = [meta(1, { hw: [{ id: 1, max_score: 6 }] }), meta(2), meta(3)];
  const row = {
    '1': att('attended', { homework_statuses: [hwDone(1, 5, 6)] }),
    '2': att('attended'),
    '3': att('attended'),
  };

  it('attendance 100 + homework 83 + a test held but skipped = 73 %', () => {
    const result = score(lessons, student(row), true);
    expect(result.attendance).toMatchObject({ attended: 3, countable: 3 });
    expect(result.test).toEqual({ state: 'skipped', percent: 0, raw_percent: null });
    expect(result.percent).toBe(73);
  });

  it('no test that week: (100·40 + 83·40) / 80 = 92 %', () => {
    const result = score(lessons, student(row), false);
    expect(result.test.state).toBe('none');
    expect(result.parts.map((p) => p.part)).toEqual(['attendance', 'homework']);
    expect(result.percent).toBe(92);
  });

  it('a student who took the test is scored on it', () => {
    const result = score(lessons, student(row, 90), true);
    expect(result.test).toEqual({ state: 'scored', percent: 90, raw_percent: 90 });
    // (100·40 + 83.33·40 + 90·20) / 100
    expect(result.percent).toBe(91);
  });

  it('a 0 % test is a score, not a skip', () => {
    expect(score(lessons, student(row, 0), true).test.state).toBe('scored');
  });
});

describe('attendance part', () => {
  it('late counts as attended', () => {
    const result = score([meta(1), meta(2)], student({ '1': att('late'), '2': att('missed') }));
    expect(result.attendance).toMatchObject({ attended: 1, countable: 2 });
    expect(result.percent).toBe(50);
  });

  it('an excused absence is left out; an ordinary one counts', () => {
    const result = score(
      [meta(1), meta(2), meta(3)],
      student({ '1': att('attended'), '2': att('missed', { excused: true }), '3': att('missed') }),
    );
    expect(result.attendance).toMatchObject({ attended: 1, countable: 2 });
  });

  it('an excused flag on a lesson that was attended changes nothing', () => {
    const result = score([meta(1)], student({ '1': att('attended', { excused: true }) }));
    expect(result.attendance).toMatchObject({ attended: 1, countable: 1 });
  });

  it('cancelled, before joining, frozen and blocked lessons are left out', () => {
    const result = score(
      [meta(1), meta(2), meta(3), meta(4), meta(5)],
      student({
        '1': att('attended'),
        '2': att('cancelled'),
        '3': att('missed', { enrolled: false }),
        '4': att('missed', { frozen: true }),
        '5': att('missed', { blocked: true }),
      }),
    );
    expect(result.attendance).toMatchObject({ attended: 1, countable: 1 });
    expect(result.percent).toBe(100);
  });

  it('a past lesson nobody has marked is left out', () => {
    const result = score(
      [meta(1), meta(2)],
      student({ '1': att('attended'), '2': { attendance_status: 'missed', marked: false } }),
    );
    expect(result.attendance).toMatchObject({ attended: 1, countable: 1 });
  });

  it('a lesson that has not happened yet is left out, marked or not', () => {
    const result = score(
      [meta(1), meta(2, { start: FUTURE }), meta(3, { start: FUTURE })],
      student({
        '1': att('attended'),
        '2': { attendance_status: 'missed', marked: false },
        '3': att('missed'),
      }),
    );
    expect(result.attendance).toMatchObject({ attended: 1, countable: 1 });
    expect(result.percent).toBe(100);
  });

  it('today\'s lesson counts once it is marked (not locked)', () => {
    const result = score([meta(1, { start: TODAY })], student({ '1': att('missed') }));
    expect(result.attendance).toMatchObject({ attended: 0, countable: 1 });
  });

  it('a future lesson with no row for the student is left out', () => {
    const result = score([meta(1), meta(2, { start: FUTURE })], student({ '1': att('attended') }));
    expect(result.attendance).toMatchObject({ attended: 1, countable: 1 });
  });

  it('a lesson with no row for the student counts as an absence', () => {
    const result = score([meta(1), meta(2)], student({ '1': att('attended') }));
    expect(result.attendance).toMatchObject({ attended: 1, countable: 2 });
  });
});

describe('homework part', () => {
  it('normalises by each homework maximum: a 30-point homework weighs like a 10-point one', () => {
    const lessons = [meta(1, { hw: [{ id: 1, max_score: 30 }] }), meta(2, { hw: [{ id: 2, max_score: 10 }] })];
    const result = score(
      lessons,
      student({
        '1': att('attended', { homework_statuses: [hwDone(1, 15, 30)] }),
        '2': att('attended', { homework_statuses: [hwDone(2, 10, 10)] }),
      }),
    );
    expect(result.homework.assigned).toBe(2);
    expect(result.homework.percent).toBe(75);
  });

  it('takes the maximum from the assignment when the submission has none', () => {
    const result = score(
      [meta(1, { hw: [{ id: 1, max_score: 20 }] })],
      student({ '1': att('attended', { homework_statuses: [{ assignment_id: 1, score: 10, max_score: null }] }) }),
    );
    expect(result.homework.percent).toBe(50);
  });

  it('unsubmitted and max-less homework count 0 but stay in the average; a submitted ungraded one is left out', () => {
    const lessons = [meta(1, { hw: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] })];
    const result = score(
      lessons,
      student({
        '1': att('attended', {
          homework_statuses: [
            { ...hwDone(1, 10), submitted: true },
            { assignment_id: 2, submitted: false, score: null, max_score: 10 },
            { assignment_id: 3, submitted: true, score: 5 },
            { ...hwDone(4, null), submitted: true },
          ],
        }),
      }),
    );
    expect(result.homework.assigned).toBe(3);
    expect(result.homework.pending).toBe(1);
    expect(result.homework.percent).toBeCloseTo(100 / 3, 9);
  });

  it('a pending homework is out of the average until it is graded, then its real score counts', () => {
    const lessons = [meta(1, { hw: [{ id: 1, max_score: 10 }, { id: 2, max_score: 10 }] })];
    const pending = score(lessons, student({ '1': att('attended', { homework_statuses: [
      { ...hwDone(1, 8), submitted: true },
      { assignment_id: 2, submitted: true, score: null, max_score: 10 },
    ] }) }));
    expect(pending.homework).toEqual({ assigned: 1, pending: 1, not_due: 0, percent: 80 });
    const graded = score(lessons, student({ '1': att('attended', { homework_statuses: [
      { ...hwDone(1, 8), submitted: true },
      { ...hwDone(2, 2), submitted: true },
    ] }) }));
    expect(graded.homework).toEqual({ assigned: 2, pending: 0, not_due: 0, percent: 50 });
  });

  it('when every homework is pending the part does not exist and nothing else is re-weighted', () => {
    const lessons = [meta(1, { hw: [{ id: 1, max_score: 10 }, { id: 2, max_score: 10 }] })];
    const result = score(
      lessons,
      student({ '1': att('attended', { homework_statuses: [
        { assignment_id: 1, submitted: true, score: null, max_score: 10 },
        { assignment_id: 2, submitted: true, score: null, max_score: 10 },
      ] }) }, 60),
      true,
    );
    expect(result.homework).toEqual({ assigned: 0, pending: 2, not_due: 0, percent: null });
    expect(result.parts.map((p) => p.part)).toEqual(['attendance', 'test']);
    expect(result.percent).toBe(87);
  });

  it('a pending homework in a future or foreign lesson is not counted at all', () => {
    const lessons = [meta(1, { hw: [{ id: 1 }] }), meta(2, { start: FUTURE, hw: [{ id: 2 }] }), meta(3, { hw: [{ id: 3 }] })];
    const pendingStatus = (id: number) => ({ assignment_id: id, submitted: true, score: null, max_score: 10 });
    const result = score(
      lessons,
      student({
        '1': att('attended', { homework_statuses: [{ ...hwDone(1, 10), submitted: true }] }),
        '2': att('attended', { homework_statuses: [pendingStatus(2)] }),
        '3': att('missed', { frozen: true, homework_statuses: [pendingStatus(3)] }),
      }),
    );
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 100 });
  });

  it('an assigned homework with no status row counts 0', () => {
    const result = score([meta(1, { hw: [{ id: 1, max_score: 10 }] })], student({ '1': att('attended') }));
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 0 });
  });

  it('cancelled and excused lessons keep their homework', () => {
    const lessons = [meta(1, { hw: [{ id: 1, max_score: 10 }] }), meta(2, { hw: [{ id: 2, max_score: 10 }] })];
    const result = score(
      lessons,
      student({
        '1': att('cancelled', { homework_statuses: [hwDone(1, 10)] }),
        '2': att('missed', { excused: true, homework_statuses: [hwDone(2, 0)] }),
      }),
    );
    expect(result.homework).toEqual({ assigned: 2, pending: 0, not_due: 0, percent: 50 });
  });

  it('lessons that are not the student\'s lose their homework too', () => {
    const lessons = [
      meta(1, { hw: [{ id: 1, max_score: 10 }] }),
      meta(2, { hw: [{ id: 2, max_score: 10 }] }),
      meta(3, { hw: [{ id: 3, max_score: 10 }] }),
      meta(4, { hw: [{ id: 4, max_score: 10 }] }),
    ];
    const result = score(
      lessons,
      student({
        '1': att('attended', { homework_statuses: [hwDone(1, 10)] }),
        '2': att('missed', { enrolled: false, homework_statuses: [hwDone(2, 0)] }),
        '3': att('missed', { frozen: true, homework_statuses: [hwDone(3, 0)] }),
        '4': att('missed', { blocked: true, homework_statuses: [hwDone(4, 0)] }),
      }),
    );
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 100 });
  });

  it('a lesson that has not happened yet loses its homework, even one already handed in', () => {
    const lessons = [meta(1, { hw: [{ id: 1, max_score: 10 }] }), meta(2, { start: FUTURE, hw: [{ id: 2, max_score: 10 }] })];
    const result = score(
      lessons,
      student({
        '1': att('attended', { homework_statuses: [hwDone(1, 10)] }),
        '2': { attendance_status: 'missed', marked: false, homework_statuses: [hwDone(2, 10)] },
      }),
    );
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 100 });
  });

  it('a past unmarked lesson counts for homework only', () => {
    const result = score(
      [meta(1, { hw: [{ id: 1, max_score: 10 }] })],
      student({ '1': { attendance_status: 'missed', marked: false, homework_statuses: [hwDone(1, 5)] } }),
    );
    expect(result.attendance).toMatchObject({ countable: 0, percent: null });
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 50 });
    expect(result.percent).toBe(50);
  });

  it('today\'s lesson keeps its homework', () => {
    const result = score(
      [meta(1, { start: TODAY, hw: [{ id: 1, max_score: 10 }] })],
      student({ '1': att('attended', { homework_statuses: [hwDone(1, 10)] }) }),
    );
    expect(result.homework).toEqual({ assigned: 1, pending: 0, not_due: 0, percent: 100 });
  });

  it('reads the legacy single homework fields', () => {
    const legacyMeta: ScoreLessonMeta = { lesson_number: 1, start_datetime: PAST, homework: { id: 1, max_score: 10 } };
    const result = score([legacyMeta], student({ '1': att('attended', { homework_status: hwDone(1, 5) }) }));
    expect(result.homework.percent).toBe(50);
  });
});

describe('test part', () => {
  it('the part exists for the group when at least one student has a score', () => {
    expect(groupHasTest([{ test_percent: null }, { test_percent: 80 }])).toBe(true);
    expect(groupHasTest([{ test_percent: null }, { test_percent: 0 }])).toBe(true);
    expect(groupHasTest([{ test_percent: null }, { test_percent: null }])).toBe(false);
    expect(groupHasTest([])).toBe(false);
  });

  it('falls back to mock_exam above zero for a backend that sends no test_percent', () => {
    expect(studentTestPercent({ mock_exam: 64 })).toBe(64);
    expect(studentTestPercent({ mock_exam: 0 })).toBeNull();
    expect(studentTestPercent({})).toBeNull();
    expect(studentTestPercent({ test_percent: null, mock_exam: 64 })).toBeNull();
  });
});

describe('a group with no weekly test (testsOff)', () => {
  const lessons = [meta(1)];
  const present = { '1': att('attended') };

  it('a student with a score gets no test part — the score does not enter the %', () => {
    const r = weeklyScore({ lessons, student: student(present, 40), testHeld: false, testsOff: true, isFuture });
    expect(r.test).toEqual({ state: 'none', percent: null, raw_percent: null });
    expect(r.parts.map((p) => p.part)).toEqual(['attendance']);
    expect(r.percent).toBe(100);
  });

  it('is not charged a skipped test even if testHeld is true', () => {
    const r = weeklyScore({ lessons, student: student(present), testHeld: true, testsOff: true, isFuture });
    expect(r.test.state).toBe('none');
    expect(r.percent).toBe(100);
  });

  it('testsOff false keeps the usual rule', () => {
    const r = weeklyScore({ lessons, student: student(present, 40), testHeld: true, testsOff: false, isFuture });
    expect(r.test).toEqual({ state: 'scored', percent: 40, raw_percent: 40 });
    expect(r.percent).toBe(Math.round((100 * 40 + 40 * 20) / 60));
  });
});

describe('no part exists', () => {
  it('a week without lessons, homework or test is «—», not 0', () => {
    expect(score([], student({})).percent).toBeNull();
  });

  it('a student with nothing countable and nothing else is «—»', () => {
    const result = score([meta(1)], student({ '1': att('cancelled') }));
    expect(result.parts).toEqual([]);
    expect(result.percent).toBeNull();
  });

  it('a single part stands alone at its own percentage', () => {
    expect(score([], student({}, 64), true).percent).toBe(64);
    expect(score([meta(1)], student({ '1': att('attended') })).percent).toBe(100);
  });
});

// The rule itself is covered case by case in leaderboardScore.parity.test.ts; these are the reading details.
describe('deadlines', () => {
  it('reads an offset-less stamp as UTC, like the server', () => {
    expect(parseInstant('2026-10-21T15:41:37')).toBe(Date.parse('2026-10-21T15:41:37Z'));
    expect(parseInstant('2026-10-21T15:41:37.0994819Z')).toBe(Date.parse('2026-10-21T15:41:37.099Z'));
    expect(parseInstant('2026-10-25T19:00:00+00:00')).toBe(Date.parse('2026-10-25T19:00:00Z'));
    expect(parseInstant('2026-10-25')).toBe(Date.parse('2026-10-25T00:00:00Z'));
    expect(parseInstant('not a date')).toBeNull();
    expect(parseInstant(null)).toBeNull();
  });

  it('a late score counts half, an open test without a score is left out', () => {
    const lessons = [meta(1)];
    const present = { '1': att('attended') };
    const closes = '2026-10-25T19:00:00Z';
    const late = weeklyScore({ lessons, student: { ...student(present, 80), test_late: true }, testHeld: true, now: '2026-10-27T00:00:00Z', testClosesAt: closes, isFuture });
    expect(late.test).toEqual({ state: 'late', percent: 40, raw_percent: 80 });
    const open = weeklyScore({ lessons, student: student(present), testHeld: true, now: '2026-10-24T00:00:00Z', testClosesAt: closes, isFuture });
    expect(open.test).toEqual({ state: 'open', percent: null, raw_percent: null });
    expect(open.percent).toBe(100);
  });
});

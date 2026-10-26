import { describe, expect, it } from 'vitest';
import {
  RETIRED_LEADERBOARD_COLUMNS,
  groupHasTest,
  isRetiredColumn,
  studentTestPercent,
  weeklyScore,
  withoutRetiredColumns,
  type ScoreLessonMeta,
  type ScoreStudent,
  type ScoreStudentLesson,
} from './leaderboardScore';

const PAST = '2026-06-01T10:00:00';
const FUTURE = '2099-01-01T10:00:00';
const isLocked = (start: string) => start === FUTURE;

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
  return weeklyScore({ lessons, student: s, testHeld, isLocked });
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
    expect(result.test).toEqual({ state: 'skipped', percent: 0 });
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
    expect(result.test).toEqual({ state: 'scored', percent: 90 });
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

  it('a locked unmarked lesson still counts as an absence, as before', () => {
    const result = score(
      [meta(1), meta(2, { start: FUTURE })],
      student({ '1': att('attended'), '2': { attendance_status: 'missed', marked: false } }),
    );
    expect(result.attendance).toMatchObject({ attended: 1, countable: 2 });
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

  it('unsubmitted, ungraded and max-less homework count 0 but stay in the average', () => {
    const lessons = [meta(1, { hw: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] })];
    const result = score(
      lessons,
      student({
        '1': att('attended', {
          homework_statuses: [
            hwDone(1, 10),
            { assignment_id: 2, score: null, max_score: 10 },
            { assignment_id: 3, score: 5 },
            hwDone(4, null),
          ],
        }),
      }),
    );
    expect(result.homework.assigned).toBe(4);
    expect(result.homework.percent).toBe(25);
  });

  it('an assigned homework with no status row counts 0', () => {
    const result = score([meta(1, { hw: [{ id: 1, max_score: 10 }] })], student({ '1': att('attended') }));
    expect(result.homework).toEqual({ assigned: 1, percent: 0 });
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
    expect(result.homework).toEqual({ assigned: 2, percent: 50 });
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
    expect(result.homework).toEqual({ assigned: 1, percent: 100 });
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

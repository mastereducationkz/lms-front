/**
 * The web's weekly % against the server's, case by case.
 *
 * `leaderboardScore.cases.json` is shared with lms-backend (`tests/fixtures/weekly_score_cases.json`,
 * byte-identical). Its expected values were written by hand from the rule, not produced by either
 * implementation. The sha256 below fails this test when the file is edited here without the same edit
 * there: change both copies, then update the constant in BOTH repos' parity tests.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAlmatyDateKey } from './attendance';
import { groupHasTest, weeklyScore, type ScoreLessonMeta, type ScoreStudent, type WeeklyScore } from './leaderboardScore';

const CASES_SHA256 = '79cb719b557e2392a0a0c00ca74082f4724d819809db7f1175ec5b997c50537a';
const casesPath = new URL('./leaderboardScore.cases.json', import.meta.url);

interface ParityCase {
  name: string;
  today: string;
  lessons: ScoreLessonMeta[];
  student: ScoreStudent;
  testHeld: boolean;
  testsOff?: boolean;
  now?: string | null;
  testClosesAt?: string | null;
  expected: WeeklyScore;
}
interface GroupHasTestCase {
  name: string;
  students: ScoreStudent[];
  expected: boolean;
}

const data = JSON.parse(readFileSync(casesPath, 'utf-8')) as { cases: ParityCase[]; groupHasTest: GroupHasTestCase[] };

/** The same numbers within float noise: the cases carry values like 83.33333333333333. */
function expectSame(actual: unknown, expected: unknown, path = 'result'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    expect(Math.abs(actual - expected), `${path}: ${actual} vs ${expected}`).toBeLessThan(1e-9);
  } else if (Array.isArray(expected)) {
    expect(Array.isArray(actual) && actual.length, path).toBe(expected.length);
    expected.forEach((e, i) => expectSame((actual as unknown[])[i], e, `${path}[${i}]`));
  } else if (expected !== null && typeof expected === 'object') {
    const actualObject = actual as Record<string, unknown>;
    expect(Object.keys(actualObject).sort(), `${path} keys`).toEqual(Object.keys(expected).sort());
    for (const [key, value] of Object.entries(expected)) expectSame(actualObject[key], value, `${path}.${key}`);
  } else {
    expect(actual, path).toBe(expected);
  }
}

describe('weekly % parity with the server', () => {
  it('the cases file is the one the backend has', () => {
    const sha = createHash('sha256').update(readFileSync(casesPath)).digest('hex');
    expect(
      sha,
      'leaderboardScore.cases.json changed: copy it to lms-backend tests/fixtures/weekly_score_cases.json and update CASES_SHA256 in both repos\' parity tests',
    ).toBe(CASES_SHA256);
  });

  it.each(data.cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const result = weeklyScore({
      lessons: c.lessons,
      student: c.student,
      testHeld: c.testHeld,
      testsOff: c.testsOff,
      now: c.now,
      testClosesAt: c.testClosesAt,
      // The web's isAttendanceLockedLesson, with the case's day standing in for «now».
      isFuture: (start) => getAlmatyDateKey(start) > c.today,
    });
    expectSame(result, c.expected);
  });

  it.each(data.groupHasTest.map((c) => [c.name, c] as const))('group has a test: %s', (_name, c) => {
    expect(groupHasTest(c.students)).toBe(c.expected);
  });
});

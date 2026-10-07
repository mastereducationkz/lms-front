import { describe, expect, it } from 'vitest';
import { TIPS, tipsFor } from './tips';
import { TOURS } from './tours';

// The backend's rule for a tip key (lms-backend src/auth/ui_state.py TIP_KEY_RE).
const SERVER_KEY = /^[a-z0-9][a-z0-9._-]{0,47}$/;
// Pictographs and the emoji variation selector: the owner's rule is lucide icons, never native emoji.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const CYRILLIC = /[а-яё]/i;

describe('tour and tip copy', () => {
  const copy = [
    ...Object.values(TOURS).flatMap((t) => t.steps.flatMap((s) => [s.title, s.body])),
    ...TIPS.flatMap((t) => [t.title, t.body]),
  ];

  it('has no native emoji anywhere', () => {
    for (const line of copy) expect(line, line).not.toMatch(EMOJI);
  });

  it('speaks each role’s UI language: English for students and teachers, Russian for curators', () => {
    for (const s of [...TOURS.student.steps, ...TOURS.teacher.steps]) expect(`${s.title} ${s.body}`).not.toMatch(CYRILLIC);
    for (const s of TOURS.curator.steps) expect(`${s.title} ${s.body}`).toMatch(CYRILLIC);
    for (const t of TIPS) expect(CYRILLIC.test(`${t.title} ${t.body}`)).toBe(t.locale === 'ru');
  });

  it('promises teachers no course creation (courses are read-only since 2026-10-03)', () => {
    for (const s of TOURS.teacher.steps) expect(`${s.title} ${s.body}`).not.toMatch(/creat(e|ing) (a |new )?course|course builder/i);
  });

  it('says «loading» in each tour’s language', () => {
    expect(TOURS.student.text.loading).not.toMatch(CYRILLIC);
    expect(TOURS.curator.text.loading).toMatch(CYRILLIC);
  });

  it('starts every tour with a centred welcome and keeps step ids unique', () => {
    for (const tour of Object.values(TOURS)) {
      expect(tour.steps[0].target).toBeUndefined();
      expect(new Set(tour.steps.map((s) => s.id)).size).toBe(tour.steps.length);
      expect(tour.steps.length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('tips', () => {
  it('use keys the server accepts', () => {
    for (const t of TIPS) expect(t.key).toMatch(SERVER_KEY);
  });

  it('are about ten, one variant per role and page', () => {
    expect(new Set(TIPS.map((t) => t.key)).size).toBe(10);
    const seen = new Set<string>();
    for (const t of TIPS) for (const role of t.roles) {
      const id = `${t.key}|${role}`;
      expect(seen.has(id), id).toBe(false);
      seen.add(id);
    }
  });

  it('pick by role and page, and drop the dismissed ones', () => {
    const none = () => false;
    expect(tipsFor('student', '/homework/12', none).map((t) => t.key)).toEqual(['homework.late']);
    expect(tipsFor('student', '/homework/12/grade', none)).toEqual([]);
    expect(tipsFor('teacher', '/homework/12/grade', none).map((t) => t.key)).toEqual(['homework.allow-attempt']);
    expect(tipsFor('teacher', '/lessons/5', none).map((t) => t.key)).toEqual(['lesson.register']);
    expect(tipsFor('student', '/lessons/5', none).map((t) => t.key)).toEqual(['lesson.sections']);
    expect(tipsFor('head_curator', '/curator/leaderboard', none)[0]).toMatchObject({ key: 'leaderboard.star-of-week', locale: 'ru' });
    expect(tipsFor('teacher', '/attendance', none)[0]).toMatchObject({ key: 'leaderboard.star-of-week', locale: 'en' });
    expect(tipsFor('admin', '/curator/students', none)).toEqual([]);
    expect(tipsFor('student', '/achievements', (k) => k === 'achievements.try-on')).toEqual([]);
    expect(tipsFor(undefined, '/achievements', none)).toEqual([]);
  });
});

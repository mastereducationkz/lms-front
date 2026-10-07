import { describe, expect, it } from 'vitest';
import { t, type Locale, type MessageKey } from '@/lib/i18n';
import { guide as enGuide } from '@/lib/i18n/en/guide';
import { guide as ruGuide } from '@/lib/i18n/ru/guide';
import { TIPS, tipsFor } from './tips';
import { replayLabel, TOURS } from './tours';

// The backend's rule for a tip key (lms-backend src/auth/ui_state.py TIP_KEY_RE).
const SERVER_KEY = /^[a-z0-9][a-z0-9._-]{0,47}$/;
// Pictographs and the emoji variation selector: the owner's rule is lucide icons, never native emoji.
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}]/u;
const CYRILLIC = /[а-яё]/i;

describe('tour and tip copy', () => {
  const keys: MessageKey[] = [
    ...Object.values(TOURS).flatMap((tour) => tour.steps.flatMap((s) => [s.title, s.body])),
    ...TIPS.flatMap((tip) => [tip.title, tip.body]),
  ];
  const say = (key: MessageKey, locale: Locale) => t(key, undefined, locale);

  it('has no native emoji anywhere, in either language', () => {
    for (const key of keys) for (const locale of ['en', 'ru'] as const) expect(say(key, locale), key).not.toMatch(EMOJI);
  });

  it('speaks the viewer’s language: every tour stop and tip has English and Russian', () => {
    for (const key of keys) {
      expect(enGuide, key).toHaveProperty([key]);
      expect(ruGuide, key).toHaveProperty([key]);
      expect(say(key, 'en'), key).not.toMatch(CYRILLIC);
      expect(say(key, 'ru'), key).toMatch(CYRILLIC);
    }
  });

  it('promises teachers no course creation (courses are read-only since 2026-10-03)', () => {
    for (const s of TOURS.teacher.steps) {
      expect(`${say(s.title, 'en')} ${say(s.body, 'en')}`).not.toMatch(/creat(e|ing) (a |new )?course|course builder/i);
      expect(`${say(s.title, 'ru')} ${say(s.body, 'ru')}`).not.toMatch(/созда\S* (нов\S* )?курс|конструктор курс/i);
    }
  });

  it('says «loading» and «Replay tour» in the viewer’s language', () => {
    expect(t('guide.tour.loading', undefined, 'en')).toBe('Loading this part of the page…');
    expect(t('guide.tour.loading', undefined, 'ru')).toBe('Загружаем эту часть страницы…');
    expect(t('guide.tour.stepOf', { index: 2, total: 9 }, 'ru')).toBe('Шаг 2 из 9');
    expect(replayLabel('curator', 'en')).toBe('Replay tour');
    expect(replayLabel('student', 'ru')).toBe('Повторить тур');
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
    expect(tipsFor('head_curator', '/curator/leaderboard', none)[0]).toMatchObject({ key: 'leaderboard.star-of-week', title: 'guide.tips.starOfWeekCurator.title' });
    expect(tipsFor('teacher', '/attendance', none)[0]).toMatchObject({ key: 'leaderboard.star-of-week', title: 'guide.tips.starOfWeekTeacher.title' });
    expect(tipsFor('admin', '/curator/students', none)).toEqual([]);
    expect(tipsFor('student', '/achievements', (k) => k === 'achievements.try-on')).toEqual([]);
    expect(tipsFor(undefined, '/achievements', none)).toEqual([]);
  });
});

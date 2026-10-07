import { afterEach, describe, expect, it } from 'vitest';
import { en, EN_NAMESPACES } from './en';
import { ru, RU_NAMESPACES } from './ru';
import type { Message } from './types';
import {
  formatDate, formatDateTime, formatNumber, formatTime, intlLocale, localeForUser, plural, setActiveLocale, t, uiLocale,
} from './index';

const ROLES = ['student', 'parent', 'teacher', 'head_teacher', 'admin', 'curator', 'head_curator'];

describe('uiLocale — the one language rule', () => {
  it('gives Russian to curator roles and English to everyone else', () => {
    expect(ROLES.filter((r) => uiLocale(r) === 'ru')).toEqual(['curator', 'head_curator']);
    expect(uiLocale(null)).toBe('en');
    expect(uiLocale(undefined)).toBe('en');
  });

  it('lets a user preference win over the role', () => {
    expect(uiLocale('curator', 'en')).toBe('en');
    expect(uiLocale('student', 'ru')).toBe('ru');
    expect(uiLocale('teacher', null)).toBe('en');
  });

  it('has no stored preference yet, so a user reads by role', () => {
    expect(localeForUser({ role: 'head_curator' })).toBe('ru');
    expect(localeForUser({ role: 'admin' })).toBe('en');
    expect(localeForUser(null)).toBe('en');
  });

  it('formats English as en-GB (day before month, 24-hour clock)', () => {
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('ru')).toBe('ru-RU');
  });
});

const placeholders = (m: Message): string[] => {
  const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
  return [...new Set(texts.flatMap((s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1])))].sort();
};

describe('catalogs', () => {
  it('has the same namespaces in both languages', () => {
    expect(Object.keys(RU_NAMESPACES).sort()).toEqual(Object.keys(EN_NAMESPACES).sort());
  });

  it('prefixes every key with its namespace, so no two areas can collide', () => {
    for (const [ns, table] of Object.entries(EN_NAMESPACES)) {
      for (const key of Object.keys(table)) expect(key.startsWith(`${ns}.`), `${key} is not in ${ns}.*`).toBe(true);
    }
    const total = Object.values(EN_NAMESPACES).reduce((n: number, table) => n + Object.keys(table).length, 0);
    expect(Object.keys(en)).toHaveLength(total);
  });

  it('translates every English key into Russian, and nothing else', () => {
    const missing = Object.keys(en).filter((k) => !(k in ru));
    const extra = Object.keys(ru).filter((k) => !(k in en));
    expect(missing, 'missing in ru').toEqual([]);
    expect(extra, 'only in ru').toEqual([]);
  });

  it('keeps plurals plural and placeholders identical', () => {
    for (const [key, enMsg] of Object.entries(en) as [string, Message][]) {
      const ruMsg = ru[key];
      if (ruMsg === undefined) continue;
      expect(typeof ruMsg, `${key}: string vs plural`).toBe(typeof enMsg);
      if (typeof ruMsg !== 'string') {
        for (const form of ['one', 'few', 'many', 'other'] as const) expect(ruMsg[form], `${key}.${form}`).toBeTruthy();
      }
      expect(placeholders(ruMsg), `${key} placeholders`).toEqual(placeholders(enMsg));
    }
  });

  // A Russian plural whose forms are all the same reads «Выбрано 1 учеников» for one of them.
  // Only wordings that never inflect may do it: the count after a colon, «видео», abbreviations.
  const RU_INVARIANT = new Set([
    'teacher.today.needYou', 'teacher.today.chips.scoresMissing', 'recordings.folders.videos',
    'achievements.analytics.badges', 'achievements.student.streak', 'studentReport.talk.summary',
    'studentReport.talk.summaryQuestions', 'studentReport.viewer.points', 'studentCard.profile.streakDays',
  ]);

  it('inflects every Russian plural (1 урок, 2 урока, 5 уроков)', () => {
    const flat = Object.entries(ru)
      .filter((entry): entry is [string, Exclude<Message, string>] => typeof entry[1] !== 'string')
      .filter(([key, forms]) => forms.one === forms.few && forms.few === forms.many && !RU_INVARIANT.has(key))
      .map(([key]) => key);
    expect(flat, 'give these one/few/many forms, or list them in RU_INVARIANT').toEqual([]);
  });

  it('has no empty messages', () => {
    for (const [key, msg] of Object.entries({ ...en, ...ru }) as [string, Message][]) {
      const texts = typeof msg === 'string' ? [msg] : Object.values(msg);
      for (const text of texts) expect((text as string).trim(), key).not.toBe('');
    }
  });
});

describe('t and plural', () => {
  afterEach(() => setActiveLocale('en'));

  it('reads the active locale unless one is passed', () => {
    expect(t('common.save')).toBe('Save');
    setActiveLocale('ru');
    expect(t('common.save')).toBe('Сохранить');
    expect(t('common.save', undefined, 'en')).toBe('Save');
  });

  it('picks the plural form from count and fills placeholders', () => {
    expect(t('common.lessons', { count: 1 }, 'en')).toBe('1 lesson');
    expect(t('common.lessons', { count: 31 }, 'en')).toBe('31 lessons');
    expect([1, 2, 5, 11, 21, 22, 25].map((count) => t('common.lessons', { count }, 'ru'))).toEqual([
      '1 урок', '2 урока', '5 уроков', '11 уроков', '21 урок', '22 урока', '25 уроков',
    ]);
  });

  it('uses Intl.PluralRules for ad-hoc forms', () => {
    const forms = { one: '{count} группа', few: '{count} группы', many: '{count} групп', other: '{count} группы' };
    expect([1, 3, 7, 1.5].map((n) => plural(n, forms, 'ru'))).toEqual(['1 группа', '3 группы', '7 групп', '1.5 группы']);
    expect(plural(2, { one: '{count} file', other: '{count} files' }, 'en')).toBe('2 files');
  });
});

describe('date and number formatting', () => {
  // 14:00 UTC is 19:00 in Almaty (UTC+5), whatever zone the test machine is in.
  const lesson = '2026-10-07T14:00:00Z';

  it('formats on Almaty time in the user language', () => {
    expect(formatDate(lesson, undefined, 'en')).toBe('7 Oct 2026');
    expect(formatTime(lesson, undefined, 'en')).toBe('19:00');
    expect(formatTime(lesson, undefined, 'ru')).toBe('19:00');
    expect(formatDateTime(lesson, undefined, 'en')).toBe('7 Oct, 19:00');
    expect(formatDateTime(lesson, undefined, 'ru')).toBe('7 окт., 19:00');
  });

  it('treats a bare day and a local-midnight Date as calendar dates', () => {
    expect(formatDate('2026-10-07', { day: 'numeric', month: 'long' }, 'en')).toBe('7 October');
    expect(formatDate(new Date(2026, 9, 7), { day: 'numeric', month: 'long' }, 'ru')).toBe('7 октября');
  });

  it('returns an empty string for nothing or garbage', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date')).toBe('');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(12500, undefined, 'en')).toBe('12,500');
    expect(formatNumber(12500, undefined, 'ru').replace(/\s/g, ' ')).toBe('12 500');
  });
});

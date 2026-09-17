import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  PREVIEW_CHANGE_TAGS,
  formatPreviewLessonRow,
  previewSummary,
  schedulePreviewPayload,
  type SchedulePreview,
  type SchedulePreviewLesson,
} from './schedulePreview';

// Ported from crm-master frontend/tests/schedulePreview.test.mjs (2026-09-17), plus the payload
// guard the LMS generator needs.

// Every case runs on a laptop far from Almaty: the dates must still be Almaty dates.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
const ORIGINAL_TZ = env.TZ;
beforeEach(() => {
  env.TZ = 'America/Los_Angeles';
});
afterEach(() => {
  env.TZ = ORIGINAL_TZ;
});

const lesson = (
  change: SchedulePreviewLesson['change'],
  start = '2026-09-18T13:00:00Z',
  end = '2026-09-18T14:00:00Z',
): SchedulePreviewLesson => ({
  start,
  end,
  minutes: 60,
  event_id: change === 'create' ? null : 1,
  change,
  previous_start: null,
  previous_end: null,
});

const preview = (overrides: Partial<SchedulePreview> = {}): SchedulePreview => ({
  started_lessons: 14,
  started_minutes: 840,
  planned_lessons: 18,
  planned_minutes: 1350,
  total_lessons: 32,
  total_minutes: 2190,
  first_start: '2026-09-18T13:00:00+00:00',
  last_end: '2026-10-17T15:30:00+00:00',
  lessons: [],
  deactivated: [],
  warnings: [],
  ...overrides,
});

describe('previewSummary', () => {
  it('reads the three totals as the owner described them', () => {
    const summary = previewSummary(preview());
    expect(summary.started).toBe('Прошло: 14 уроков · 14 ч');
    expect(summary.planned).toBe('Будет запланировано: 18 уроков · 22 ч 30 мин · 18.09–17.10');
    expect(summary.total).toBe('Итого по курсу: 32 урока · 36 ч 30 мин');
  });

  it('takes the Russian plural for the lesson count', () => {
    const summary = previewSummary(preview({ started_lessons: 1, started_minutes: 90, total_lessons: 21 }));
    expect(summary.started).toBe('Прошло: 1 урок · 1 ч 30 мин');
    expect(summary.total.startsWith('Итого по курсу: 21 урок ·')).toBe(true);
    expect(previewSummary(preview({ started_lessons: 12, started_minutes: 45 })).started).toBe(
      'Прошло: 12 уроков · 45 мин',
    );
  });

  it('has no date range when nothing is planned, rather than a dash to nowhere', () => {
    const summary = previewSummary(
      preview({ planned_lessons: 0, planned_minutes: 0, first_start: null, last_end: null }),
    );
    expect(summary.planned).toBe('Будет запланировано: 0 уроков · 0 ч');
  });

  it('gives the planned range in Almaty days, not UTC days', () => {
    // 20:00 UTC on the 17th is 01:00 on the 18th in Almaty.
    const summary = previewSummary(
      preview({ first_start: '2026-09-17T20:00:00Z', last_end: '2026-10-16T19:30:00Z' }),
    );
    expect(summary.planned.endsWith('· 18.09–17.10')).toBe(true);
  });

  it('counts what the save does to existing lessons by kind, with the switched-off dates', () => {
    const summary = previewSummary(
      preview({
        lessons: [lesson('keep'), lesson('move'), lesson('move'), lesson('resize'), lesson('create')],
        deactivated: [
          { event_id: 7, start: '2026-09-18T13:00:00Z', end: '2026-09-18T14:00:00Z' },
          { event_id: 8, start: '2026-09-25T13:00:00Z', end: '2026-09-25T14:00:00Z' },
        ],
      }),
    );
    expect(summary.changes).toBe(
      'Перенесено: 2 · изменена длительность: 1 · новых: 1 · отключено: 2 (18.09, 25.09)',
    );
  });

  it('shows a bare zero when nothing is switched off', () => {
    expect(previewSummary(preview()).changes).toBe(
      'Перенесено: 0 · изменена длительность: 0 · новых: 0 · отключено: 0',
    );
  });

  it('cuts a long list of switched-off dates short instead of flooding the dialog', () => {
    const deactivated = Array.from({ length: 8 }, (_, index) => ({
      event_id: index,
      start: `2026-09-${String(10 + index).padStart(2, '0')}T13:00:00Z`,
      end: `2026-09-${String(10 + index).padStart(2, '0')}T14:00:00Z`,
    }));
    expect(previewSummary(preview({ deactivated })).changes).toBe(
      'Перенесено: 0 · изменена длительность: 0 · новых: 0 · отключено: 8 (10.09, 11.09, 12.09, 13.09, 14.09, …)',
    );
  });
});

describe('formatPreviewLessonRow', () => {
  it('reads «пт 18.09 18:00–19:00» in Almaty time', () => {
    expect(formatPreviewLessonRow('2026-09-18T13:00:00+00:00', '2026-09-18T14:00:00+00:00')).toBe(
      'пт 18.09 18:00–19:00',
    );
  });

  it('reads an offset-less value as UTC, never as the viewer’s local time', () => {
    expect(formatPreviewLessonRow('2026-09-19T14:00:00', '2026-09-19T15:30:00')).toBe('сб 19.09 19:00–20:30');
  });

  it('gives a lesson past Almaty midnight the next day and a 00 hour', () => {
    expect(formatPreviewLessonRow('2026-09-17T19:30:00Z', '2026-09-17T20:30:00Z')).toBe('пт 18.09 00:30–01:30');
  });
});

describe('PREVIEW_CHANGE_TAGS', () => {
  it('tags only a change', () => {
    expect(PREVIEW_CHANGE_TAGS).toEqual({ keep: null, move: 'перенос', resize: 'длительность', create: 'новый' });
  });
});

describe('schedulePreviewPayload', () => {
  const valid = {
    groupId: 42,
    startDate: '2026-09-07',
    lessonsCount: 32,
    config: { 4: { time: '18:00', duration: 60 }, 0: { time: '9:00', duration: 60 }, 5: { time: '19:00', duration: 90 } },
  };

  it('is the generate body for a valid form: items in weekday order, times padded', () => {
    expect(schedulePreviewPayload(valid)).toEqual({
      group_id: 42,
      start_date: '2026-09-07',
      lessons_count: 32,
      schedule_items: [
        { day_of_week: 0, time_of_day: '09:00', duration_minutes: 60 },
        { day_of_week: 4, time_of_day: '18:00', duration_minutes: 60 },
        { day_of_week: 5, time_of_day: '19:00', duration_minutes: 90 },
      ],
    });
  });

  it('accepts the largest course the API accepts', () => {
    expect(schedulePreviewPayload({ ...valid, lessonsCount: 500 })).not.toBeNull();
  });

  it.each([
    ['no group', { groupId: null }],
    ['no day', { config: {} }],
    ['a time the API refuses', { config: { 0: { time: '25:00', duration: 60 } } }],
    ['a half-typed time', { config: { 0: { time: '18:', duration: 60 } } }],
    ['a length out of range', { config: { 0: { time: '18:00', duration: 10 } } }],
    ['a zero count', { lessonsCount: 0 }],
    ['a negative count', { lessonsCount: -3 }],
    ['a fractional count', { lessonsCount: 2.5 }],
    ['a count above 500', { lessonsCount: 501 }],
    ['a count that is not a number', { lessonsCount: Number.NaN }],
    ['no start date', { startDate: '' }],
    ['a start date that is not a day', { startDate: '2026-02-30' }],
    ['a start date in another shape', { startDate: '07.09.2026' }],
  ])('is null for %s', (_label, overrides) => {
    expect(schedulePreviewPayload({ ...valid, ...overrides })).toBeNull();
  });
});

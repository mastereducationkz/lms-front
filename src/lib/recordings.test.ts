import { describe, expect, it } from 'vitest';
import type { Event } from '../types';
import {
  almatyDayKey, dayHeading, formatClock, formatDurationWords, groupByDay, matchesRecordingFilter,
  parseWatchParam, splitLessonTitle, timeRange,
} from './recordings';

const lesson = (over: Partial<Event> = {}): Event =>
  ({
    id: 1, title: 'July 8 SAT - Gulzada: Lesson 29', event_type: 'class',
    start_datetime: '2026-09-10T14:00:00Z', end_datetime: '2026-09-10T15:00:00Z',
    is_online: true, created_by: 1, is_active: true, is_recurring: false, participant_count: 0,
    ...over,
  }) as Event;

describe('durations', () => {
  it('reads like a video player on the badge', () => {
    expect(formatClock(3834)).toBe('1:03:54'); // the first live lesson, 2026-09-10
    expect(formatClock(45 * 60 + 12)).toBe('45:12');
    expect(formatClock(59)).toBe('0:59');
  });

  it('reads like a sentence in text, in either language', () => {
    expect(formatDurationWords(3834)).toBe('1 h 4 min');
    expect(formatDurationWords(3834, 'ru')).toBe('1 ч 4 мин');
    expect(formatDurationWords(3600)).toBe('1 h');
    expect(formatDurationWords(1800)).toBe('30 min');
    expect(formatDurationWords(20)).toBe('1 min');
  });

  it('says nothing rather than something wrong', () => {
    for (const bad of [null, undefined, 0, -5, Number.NaN]) {
      expect(formatClock(bad)).toBeNull();
      expect(formatDurationWords(bad)).toBeNull();
    }
  });
});

describe('Almaty days and times', () => {
  it('uses the school clock, not the laptop clock', () => {
    expect(timeRange('2026-09-10T14:00:00Z', '2026-09-10T15:00:00Z')).toBe('19:00–20:00');
    // 19:30 UTC is already half past midnight in Almaty: it belongs to the next day.
    expect(almatyDayKey('2026-09-10T19:30:00Z')).toBe('2026-09-11');
  });

  it('names today and yesterday, and other days in full', () => {
    const now = new Date('2026-09-10T17:00:00Z'); // 22:00 on the 10th in Almaty
    expect(dayHeading('2026-09-10', now)).toBe('Today · Thu, 10 Sep');
    expect(dayHeading('2026-09-09', now)).toBe('Yesterday · Wed, 9 Sep');
    expect(dayHeading('2026-09-07', now)).toBe('Monday 7 September');
    expect(dayHeading('2026-09-10', now, 'ru')).toBe('Сегодня · чт, 10 сентября');
    expect(dayHeading('2026-09-07', now, 'ru')).toBe('Понедельник, 7 сентября');
  });

  it('adds the year only when it is not this one', () => {
    const now = new Date('2026-01-05T10:00:00Z');
    expect(dayHeading('2025-12-29', now)).toBe('Monday 29 December 2025');
  });

  it('groups consecutive items by day, keeping their order', () => {
    const items = [
      { start_datetime: '2026-09-10T14:00:00Z', id: 'a' },
      { start_datetime: '2026-09-10T09:00:00Z', id: 'b' },
      { start_datetime: '2026-09-09T14:00:00Z', id: 'c' },
    ];
    expect(groupByDay(items).map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['2026-09-10', ['a', 'b']],
      ['2026-09-09', ['c']],
    ]);
  });
});

describe('lesson names', () => {
  it('takes the group from the title when that is all there is', () => {
    expect(splitLessonTitle('July 8 SAT - Gulzada: Lesson 29')).toEqual({ name: 'July 8 SAT', lesson: 'Lesson 29' });
  });

  it('prefers the live group name, since titles go stale after a rename', () => {
    expect(splitLessonTitle('Old name: Lesson 3', [{ name: 'IELTS June 14 2026 - Шадеева' }]))
      .toEqual({ name: 'IELTS June 14 2026', lesson: 'Lesson 3' });
  });

  it('keeps a long trailing part that is not a teacher name', () => {
    const name = 'NUET - Mathematics and Critical Thinking Intensive';
    expect(splitLessonTitle(name).name).toBe(name);
  });

  it('speaks Russian to Russian readers', () => {
    expect(splitLessonTitle('July 8 SAT - Gulzada: Lesson 29', null, 'ru').lesson).toBe('Урок 29');
  });

  it('copes with a title that has no lesson number', () => {
    expect(splitLessonTitle('Mock exam')).toEqual({ name: 'Mock exam', lesson: null });
  });
});

describe('the calendar Recordings filter', () => {
  const now = new Date('2026-09-10T18:00:00Z').getTime();
  const recorded = lesson({ recording: { status: 'ready', duration_seconds: 3834 } });
  const processing = lesson({ recording: { status: 'pending' } });
  const failed = lesson({ recording: { status: 'failed' } });
  const unrecorded = lesson();
  const ahead = lesson({ start_datetime: '2026-09-11T14:00:00Z', end_datetime: '2026-09-11T15:00:00Z' });
  const webinar = lesson({ event_type: 'webinar', recording: null });

  it('keeps everything on "all"', () => {
    for (const e of [recorded, unrecorded, ahead, webinar]) expect(matchesRecordingFilter(e, 'all', now)).toBe(true);
  });

  it('"with" keeps lessons that have one, including one still processing', () => {
    expect(matchesRecordingFilter(recorded, 'with', now)).toBe(true);
    expect(matchesRecordingFilter(processing, 'with', now)).toBe(true);
    expect(matchesRecordingFilter(unrecorded, 'with', now)).toBe(false);
  });

  it('"without" keeps ended lessons that left nothing to watch', () => {
    expect(matchesRecordingFilter(unrecorded, 'without', now)).toBe(true);
    expect(matchesRecordingFilter(failed, 'without', now)).toBe(true);
    expect(matchesRecordingFilter(recorded, 'without', now)).toBe(false);
  });

  it('a lesson still ahead is in neither — it cannot have a recording yet', () => {
    expect(matchesRecordingFilter(ahead, 'with', now)).toBe(false);
    expect(matchesRecordingFilter(ahead, 'without', now)).toBe(false);
  });

  it('is about lessons: other events fall out of both choices', () => {
    expect(matchesRecordingFilter(webinar, 'with', now)).toBe(false);
    expect(matchesRecordingFilter(webinar, 'without', now)).toBe(false);
  });
});

describe('the ?watch= deep link', () => {
  it('reads a lesson id', () => {
    expect(parseWatchParam(new URLSearchParams('watch=14156'))).toBe(14156);
  });

  it('ignores anything that is not one', () => {
    for (const q of ['', 'watch=', 'watch=0', 'watch=-3', 'watch=12a', 'watch=1e5', 'watch=%3Cscript%3E']) {
      expect(parseWatchParam(new URLSearchParams(q))).toBeNull();
    }
  });
});

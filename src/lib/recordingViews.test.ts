import { describe, expect, it } from 'vitest';
import {
  advance, giveBack, newMeter, seeking, summaryLine, takeReport, viewsLine, type RecordingViewSummary, type WatchMeter,
} from './recordingViews';

/** Play from `from` to `to` in `timeupdate`-sized steps. */
function play(meter: WatchMeter, from: number, to: number, step = 0.25): WatchMeter {
  let m = advance(meter, from, true);
  for (let t = from + step; t <= to + 1e-9; t += step) m = advance(m, t, true);
  return m;
}

describe('the watch meter', () => {
  it('adds up playing, not seeking', () => {
    let m = play(newMeter(), 0, 10);
    expect(m.unsent).toBeCloseTo(10);
    m = advance(m, 600, true); // dragged the playhead: a jump is not watching
    m = play(m, 600, 605);
    expect(m.unsent).toBeCloseTo(15);
    expect(m.furthest).toBeCloseTo(605);
    m = advance(m, 100, true); // back again
    expect(m.unsent).toBeCloseTo(15);
    expect(m.furthest).toBeCloseTo(605);
  });

  it('counts nothing while paused, and a short skip after a seek is not watching either', () => {
    let m = play(newMeter(), 0, 5);
    m = advance(m, 5, false);
    m = advance(m, 7, true); // resumed after a pause: the first reading only sets the mark
    expect(m.unsent).toBeCloseTo(5);
    m = seeking(m);
    m = advance(m, 9.5, true); // a 2.5 s seek would pass for playing without `seeking`
    expect(m.unsent).toBeCloseTo(5);
  });

  it('reports whole seconds, counts the view once, and keeps the fraction', () => {
    const m = play(newMeter(), 0, 12.5);
    const first = takeReport(m);
    expect(first?.report).toEqual({ watched_seconds: 12, position_seconds: 12, new_view: true });
    expect(first?.meter.unsent).toBeCloseTo(0.5);
    const second = takeReport(play(first!.meter, 12.5, 20));
    expect(second?.report.new_view).toBe(false);
    expect(second?.report.watched_seconds).toBe(8);
  });

  it('has nothing to say until a second has played', () => {
    expect(takeReport(newMeter())).toBeNull();
    expect(takeReport(play(newMeter(), 0, 0.75))).toBeNull();
  });

  it('gives a failed report back, view and all', () => {
    const taken = takeReport(play(newMeter(), 0, 30))!;
    const back = giveBack(taken.meter, taken.report);
    expect(back.unsent).toBeCloseTo(30);
    expect(takeReport(back)?.report.new_view).toBe(true);
  });
});

describe('what staff read', () => {
  it('writes a card line, with the absent part only when someone missed it', () => {
    expect(viewsLine({ students: 12, watched: 5, absent: 4, absent_watched: 3 }, 'en'))
      .toBe('Watched by 5 of 12 · missed it: 3 of 4');
    expect(viewsLine({ students: 12, watched: 5, absent: 0, absent_watched: 0 }, 'ru')).toBe('Смотрели 5 из 12');
    expect(viewsLine({ students: 0, watched: 0, absent: 0, absent_watched: 0 }, 'en')).toBeNull();
    expect(viewsLine(null, 'en')).toBeNull();
  });

  const summary = (over: Partial<RecordingViewSummary>): RecordingViewSummary => ({
    since: '2026-09-28T09:00:00Z', window_days: 7, period_days: 30, absent: 0, watched: 0, share: null,
    pending_absent: 0, pending_watched: 0, ...over,
  });

  it('gives the 7-day figure once a week has run out', () => {
    expect(summaryLine(summary({ absent: 120, watched: 41, share: 0.342 }), 'ru'))
      .toBe('Пропустили урок и посмотрели запись в течение 7 дней: 34% (41 из 120, за 30 дней)');
  });

  it('says what has been watched so far before that, and since when it counts', () => {
    expect(summaryLine(summary({ pending_absent: 20, pending_watched: 5 }), 'ru'))
      .toBe('Просмотры записей считаются с 28.09: из пропустивших урок запись уже посмотрели 5 из 20');
    // ICU spells September «Sep» or «Sept» depending on its version.
    expect(summaryLine(summary({}), 'en')).toMatch(/^Recording views are counted since 28 Sept?$/);
    expect(summaryLine(summary({ since: null }), 'en')).toBeNull();
  });
});

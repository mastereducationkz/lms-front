import { describe, expect, it } from 'vitest';
import {
  applyShorthand,
  configFromScheduleSlots,
  normalizeScheduleTime,
  parseScheduleShorthand,
  scheduleSlotsFromConfig,
} from './scheduleShorthand';

// Ported from crm-master frontend/tests/scheduleShorthand.test.mjs (2026-09-16).
const d = (time: string, duration: number) => ({ time, duration });

describe('parseScheduleShorthand', () => {
  it("parses Rauan's schedule in one line", () => {
    const { config, problems } = parseScheduleShorthand('пн пт 18:00-19:00 сб вс 19:00-20:30');
    expect(config).toEqual({ 0: d('18:00', 60), 4: d('18:00', 60), 5: d('19:00', 90), 6: d('19:00', 90) });
    expect(problems).toEqual([]);
  });

  it('reads the way a person types it: 18-19, 19-20.5, en dash, comma', () => {
    expect(parseScheduleShorthand('пн, пт 18-19; сб вс 19–20,5').config).toEqual({
      0: d('18:00', 60),
      4: d('18:00', 60),
      5: d('19:00', 90),
      6: d('19:00', 90),
    });
    expect(parseScheduleShorthand('сб 19-20.5').config).toEqual({ 5: d('19:00', 90) });
  });

  it("keeps the old forms working, and a bare time keeps the day's current length", () => {
    expect(parseScheduleShorthand('вт чт 20 00 сб 12 00').config).toEqual({
      1: d('20:00', 60),
      3: d('20:00', 60),
      5: d('12:00', 60),
    });
    expect(parseScheduleShorthand('сб 19:00', { 5: d('18:00', 90) }).config).toEqual({ 5: d('19:00', 90) });
    expect(parseScheduleShorthand('mon wed 19:00').config).toEqual({ 0: d('19:00', 60), 2: d('19:00', 60) });
  });

  it('measures a range crossing midnight forward', () => {
    expect(parseScheduleShorthand('пт 23:30-00:30').config).toEqual({ 4: d('23:30', 60) });
  });

  it('never applies anything silently to the wrong day', () => {
    // The old tokenizer turned «18:00-19:00» into garbage and gave Monday Wednesday's time.
    const { config } = parseScheduleShorthand('пн 18:00-19:00 ср 19:00');
    expect(config).toEqual({ 0: d('18:00', 60), 2: d('19:00', 60) });
  });

  it('reports what it cannot read instead of ignoring it', () => {
    expect(parseScheduleShorthand('пн 18:00 хз').problems.some((p) => p.includes('хз'))).toBe(true);
    expect(parseScheduleShorthand('пн 18:00 ср').problems.some((p) => p.includes('ср'))).toBe(true);
    expect(parseScheduleShorthand('пн 18:00-18:05').problems.length).toBeGreaterThan(0); // 5 min is not a lesson
  });

  it('reports an orphaned range with no day before it, instead of dropping it', () => {
    const { config, problems } = parseScheduleShorthand('пн 18:00 19:00-20:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00-20:00'))).toBe(true);
  });

  it('reports an orphaned bare time with no day before it too', () => {
    const { config, problems } = parseScheduleShorthand('19:00 пн 18:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00'))).toBe(true);
  });

  it('ruling D2: a plain comma between two times is two tokens, not a decimal', () => {
    const { config, problems } = parseScheduleShorthand('пн 18:00,19:00');
    expect(config).toEqual({ 0: d('18:00', 60) });
    expect(problems.some((p) => p.includes('19:00'))).toBe(true);
  });

  it('ruling D2: a half-hour decimal comma still means 20:30', () => {
    expect(parseScheduleShorthand('сб вс 19–20,5').config).toEqual({ 5: d('19:00', 90), 6: d('19:00', 90) });
  });
});

describe('normalizeScheduleTime', () => {
  it('pads and clamps an HH:MM string', () => {
    expect(normalizeScheduleTime('9:5')).toBe('9:5'); // not HH:MM shaped, left as-is
    expect(normalizeScheduleTime('09:05')).toBe('09:05');
    expect(normalizeScheduleTime('23:59')).toBe('23:59');
  });
});

describe('applyShorthand', () => {
  it('replaces the selected day set instead of merging into it, so retyping removes a day', () => {
    // Ruling I: the old parser fully replaced the day set on every keystroke; a bare-time
    // merge would make it impossible to drop a day by leaving it out of the new line.
    const current = { 0: d('18:00', 60), 5: d('19:00', 90) };
    const { config, problems } = applyShorthand('сб 19:00', current);
    expect(config).toEqual({ 5: d('19:00', 90) }); // Monday gone, Saturday keeps its 90 min
    expect(problems).toEqual([]);
  });

  it('leaves the current config untouched when the line is empty or parses to nothing', () => {
    const current = { 0: d('18:00', 60), 5: d('19:00', 90) };
    expect(applyShorthand('', current).config).toBe(current);
    expect(applyShorthand('хз', current).config).toBe(current);
  });
});

describe('applyShorthand against a fixed base — Ruling L regression', () => {
  // The saved schedule: Mon/Fri 18:00×60, Sat/Sun 19:00×90. Every call below parses against
  // this SAME fixed snapshot — never against a previous call's result — because that is what
  // the component now does (the base is refreshed only by row edits, never by a shorthand
  // parse). Before the fix, the component fed each keystroke's own output back in as the next
  // keystroke's `current`, so a half-typed line dropped Sat/Sun out of it and they came back
  // at 60 minutes instead of their real 90.
  const base = { 0: d('18:00', 60), 4: d('18:00', 60), 5: d('19:00', 90), 6: d('19:00', 90) };
  const fullLine = 'пн пт 18:00-19:00 сб вс 19:00-20:30';

  it('keeps Sat/Sun correct through every prefix of the full line typed forward', () => {
    const stem = 'пн пт 18:00-19:00 сб вс ';
    // «пн» / «пн пт» alone complete nothing yet (Ruling I: an unparseable/empty-so-far line
    // leaves the current schedule untouched) — the base, Sat/Sun included, is shown as-is.
    for (const prefix of ['пн', 'пн пт']) {
      expect(applyShorthand(prefix, base).config).toEqual(base);
    }
    // Once Mon/Fri's range completes, the parse is non-empty and REPLACES the day set (Ruling
    // I) — Sat/Sun aren't mentioned yet, so they correctly drop out of the display for now.
    for (const prefix of ['пн пт 18:00-19:00', 'пн пт 18:00-19:00 сб', stem.trim()]) {
      const { config } = applyShorthand(prefix, base);
      expect(config[5]).toBeUndefined();
      expect(config[6]).toBeUndefined();
    }
    // The moment «19:00» is typed for Sat/Sun, before any dash follows, it's a bare time and
    // must inherit the base's 90 — this is the exact moment the pre-fix bug corrupted, because
    // the live, already-replaced scheduleConfig no longer had Sat/Sun's 90 stored by then.
    expect(applyShorthand(`${stem}19:00`, base).config[5]).toEqual(d('19:00', 90));
    expect(applyShorthand(`${stem}19:00`, base).config[6]).toEqual(d('19:00', 90));
    // «-20» (no minutes yet) is a genuinely different, complete hour-only range — 19:00 to
    // 20:00 is 60 minutes for real, not a bug; the parser has always accepted hour-only ranges
    // (see the «18-19» test above).
    expect(applyShorthand(`${stem}19:00-20`, base).config[5]).toEqual(d('19:00', 60));
    // Finishing the range restores the intended 90-minute lesson.
    expect(applyShorthand(fullLine, base).config).toEqual({
      0: d('18:00', 60),
      4: d('18:00', 60),
      5: d('19:00', 90),
      6: d('19:00', 90),
    });
  });

  it('restores Sat/Sun to their base length once the range is backspaced down to a bare time', () => {
    // «…сб вс 19:00-20:30» -> «…19:00-20:3» -> «…19:00-20» -> «…19:00», one keystroke at a time.
    const stem = 'пн пт 18:00-19:00 сб вс ';
    const afterFullRange = applyShorthand(`${stem}19:00-20:30`, base).config;
    const afterTrimmedDigit = applyShorthand(`${stem}19:00-20:3`, base).config;
    const afterBareTime = applyShorthand(`${stem}19:00`, base).config;

    expect(afterFullRange[5]).toEqual(d('19:00', 90));
    expect(afterFullRange[6]).toEqual(d('19:00', 90));
    // «…20:3» doesn't parse as a range or a time — Sat/Sun drop out of this step's config
    // entirely (reported, not silently kept) rather than freezing at a wrong duration.
    expect(afterTrimmedDigit[5]).toBeUndefined();
    expect(afterTrimmedDigit[6]).toBeUndefined();
    // The fully-backspaced, bare-time state inherits the BASE's 90 — not 60, and not whatever
    // the «…20:3» step happened to hold (it held nothing for these days at all).
    expect(afterBareTime[5]).toEqual(d('19:00', 90));
    expect(afterBareTime[6]).toEqual(d('19:00', 90));
  });

  it('keeps Sat/Sun at their base length when a fresh line gives them a bare time', () => {
    // The other reported regression: typing the whole line in one go, with Sat/Sun getting a
    // bare time, must inherit 90 from the base rather than default to 60.
    const { config } = applyShorthand('пн пт 18:00-19:00 сб вс 18:00', base);
    expect(config[5]).toEqual(d('18:00', 90));
    expect(config[6]).toEqual(d('18:00', 90));
  });
});

describe('configFromScheduleSlots / scheduleSlotsFromConfig', () => {
  it("carry each day's length both ways", () => {
    const config = configFromScheduleSlots([
      { day_of_week: 5, time_of_day: '19:00', duration_minutes: 90 },
      { day_of_week: 0, time_of_day: '18:00' },
    ]);
    expect(config).toEqual({ 0: d('18:00', 60), 5: d('19:00', 90) });
    expect(scheduleSlotsFromConfig(config)).toEqual([
      { day_of_week: 0, time_of_day: '18:00', duration_minutes: 60 },
      { day_of_week: 5, time_of_day: '19:00', duration_minutes: 90 },
    ]);
  });
});

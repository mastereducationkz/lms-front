import { describe, expect, it } from 'vitest';
import {
  applyShorthand,
  configFromScheduleSlots,
  normalizeScheduleTime,
  parseScheduleShorthand,
  scheduleSlotsFromConfig,
  type ScheduleConfig,
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
    // Ruling I: retyping the line fully replaces the day set; a bare-time merge would make it
    // impossible to drop a day by leaving it out of the new line.
    const base = { 0: d('18:00', 60), 5: d('19:00', 90) };
    const { config, problems } = applyShorthand('сб 19:00', base, base);
    expect(config).toEqual({ 5: d('19:00', 90) }); // Monday gone, Saturday keeps its 90 min
    expect(problems).toEqual([]);
  });

  it('falls back to `current` — not `base` — when the line is empty or parses to nothing', () => {
    // Review finding (Ruling L follow-up, "Important"): `applyShorthand` took a single
    // `current` argument that doubled as both the length source AND the empty-parse fallback.
    // Once the component started passing the stable base as that argument (Ruling L), an empty
    // or unparseable line snapped the schedule back to the ORIGINALLY LOADED base, discarding
    // whatever a previous valid parse had already applied. `base` and `current` are now two
    // separate arguments: lengths always come from `base`, but the fallback is `current` — the
    // schedule as currently displayed — by reference.
    const base = { 0: d('18:00', 60), 5: d('19:00', 90) };
    const current = applyShorthand('сб 19:00', base, base).config; // { 5: d('19:00', 90) }
    expect(applyShorthand('', base, current).config).toBe(current); // not `base`
    const garbage = applyShorthand('хз', base, current);
    expect(garbage.config).toBe(current);
    expect(garbage.problems.some((p) => p.includes('хз'))).toBe(true);
  });
});

describe('applyShorthand against a fixed base — Ruling L regression', () => {
  // Ported from crm-master frontend/tests/scheduleShorthand.test.mjs's
  // `nextConfigFromShorthand` regression suite (2026-09-16/17) — same function shape, same
  // scenarios. The saved schedule: Mon/Fri 18:00×60, Sat/Sun 19:00×90.
  const saved: ScheduleConfig = { 0: d('18:00', 60), 4: d('18:00', 60), 5: d('19:00', 90), 6: d('19:00', 90) };
  const FULL = 'пн пт 18:00-19:00 сб вс 19:00-20:30';

  /** What the component does per keystroke: the base stays put, the config follows the text. */
  const typeSequence = (texts: string[], base: ScheduleConfig, start: ScheduleConfig): ScheduleConfig => {
    let config = start;
    for (const text of texts) config = applyShorthand(text, base, config).config;
    return config;
  };

  it('typing the schedule key by key ends with Sat/Sun at 90', () => {
    const prefixes = Array.from({ length: FULL.length }, (_, index) => FULL.slice(0, index + 1));
    expect(typeSequence(prefixes, saved, saved)).toEqual(saved);
  });

  it('backspacing the range off Saturday/Sunday keeps their saved 90', () => {
    const target = 'пн пт 18:00-19:00 сб вс 19:00';
    const backspaces: string[] = [];
    for (let length = FULL.length - 1; length >= target.length; length -= 1) backspaces.push(FULL.slice(0, length));
    expect(backspaces[backspaces.length - 1]).toBe(target);
    expect(typeSequence(backspaces, saved, saved)).toEqual(saved);
  });

  it('a bare time typed from scratch keeps the saved length of that day', () => {
    const text = 'пн пт 18:00-19:00 сб вс 18:00';
    const prefixes = Array.from({ length: text.length }, (_, index) => text.slice(0, index + 1));
    expect(typeSequence(prefixes, saved, {})).toEqual({
      0: d('18:00', 60),
      4: d('18:00', 60),
      5: d('18:00', 90),
      6: d('18:00', 90),
    });
  });

  it('chaining against the live config instead of the base is the old bug, reproduced on purpose', () => {
    // This is what the component did before Ruling L: feed each keystroke's own output back in
    // as the NEXT keystroke's base (`base === current` at every step). It loses Sat/Sun's
    // length — proving why `base` must stay fixed and separate from `current`.
    let live = saved;
    const target = 'пн пт 18:00-19:00 сб вс 19:00';
    for (let length = FULL.length - 1; length >= target.length; length -= 1) {
      live = applyShorthand(FULL.slice(0, length), live, live).config;
    }
    expect(live[5].duration).toBe(60); // wrong — should be 90 — this is the bug, not the fix
  });

  it('text that yields no day leaves the config as it is, but still reports why', () => {
    const { config, problems } = applyShorthand('хз', saved, saved);
    expect(config).toBe(saved);
    expect(problems.some((problem) => problem.includes('хз'))).toBe(true);
    expect(applyShorthand('', saved, saved)).toEqual({ config: saved, problems: [] });
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

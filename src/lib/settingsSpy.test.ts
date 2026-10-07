import { describe, expect, it } from 'vitest';
import { isAtBottom, isScrollKey, spyActive, type SpySection } from './settingsSpy';

// A 900 px tall scrolling area; the band is 135–270 px.
const H = 900;
const at = (id: string, top: number, height = 300): SpySection => ({ id, top, bottom: top + height });

describe('spyActive', () => {
  it('marks the first section crossing the band (the rule before this fix)', () => {
    expect(spyActive([at('appearance', -400), at('language', 150), at('notifications', 500)], H, false, 'appearance')).toBe('language');
  });

  it('keeps the mark while the band falls in the gap between two sections', () => {
    expect(spyActive([at('a', -400, 300), at('b', 300)], H, false, 'a')).toBe('a');
  });

  it('at the bottom, the last section whose heading can be seen wins (owner bug: Help showed Security)', () => {
    // Security's heading is above the fold; Help and Install are on screen but can't reach the band.
    const sections = [at('security', -200, 500), at('help', 420, 150), at('install', 620, 150)];
    expect(spyActive(sections, H, false, 'security')).toBe('security');
    expect(spyActive(sections, H, true, 'security')).toBe('install');
  });

  it('at the bottom, a heading hidden under the edge does not count', () => {
    const sections = [at('help', 300, 150), at('install', H - 10, 150)];
    expect(spyActive(sections, H, true, 'x')).toBe('help');
  });
});

describe('isAtBottom', () => {
  it('within 2 px of the end, and only on a page that scrolls', () => {
    expect(isAtBottom(2100, 900, 3000)).toBe(true);
    expect(isAtBottom(2098, 900, 3000)).toBe(true);
    expect(isAtBottom(2090, 900, 3000)).toBe(false);
    expect(isAtBottom(0, 900, 900)).toBe(false);
  });
});

describe('isScrollKey', () => {
  it('scrolling keys, but not while typing in a field', () => {
    expect(isScrollKey('PageDown', false)).toBe(true);
    expect(isScrollKey(' ', false)).toBe(true);
    expect(isScrollKey(' ', true)).toBe(false);
    expect(isScrollKey('a', false)).toBe(false);
  });
});

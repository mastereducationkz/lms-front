import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLayer, paintLayer, supportsHighlightApi } from './paint';

const g = globalThis as { CSS?: unknown; Highlight?: unknown };
const range = {} as Range;

afterEach(() => {
  clearLayer('t');
  delete g.CSS;
  delete g.Highlight;
});

describe('painting highlights', () => {
  it('registers one Highlight per colour with the CSS registry', () => {
    const set = vi.fn();
    g.CSS = { highlights: { set, delete: vi.fn() } };
    g.Highlight = class { constructor(...ranges: Range[]) { (this as { ranges?: Range[] }).ranges = ranges; } };
    expect(supportsHighlightApi()).toBe(true);
    paintLayer('t', [{ range, color: 'pink' }]);
    expect(set).toHaveBeenCalledWith('ann-pink', expect.objectContaining({ ranges: [range] }));
  });

  it('is unsupported, and harmless, without the Highlight constructor (iOS < 17.2, or removed mid-session)', () => {
    g.CSS = { highlights: { set: vi.fn(), delete: vi.fn() } };
    expect(supportsHighlightApi()).toBe(false);
    expect(() => paintLayer('t', [{ range, color: 'yellow' }])).not.toThrow();
  });

  it('never throws into the page when the engine refuses a range', () => {
    g.CSS = { highlights: { set: vi.fn(), delete: vi.fn() } };
    g.Highlight = class { constructor() { throw new TypeError('bad range'); } };
    expect(() => paintLayer('t', [{ range, color: 'blue' }])).not.toThrow();
  });
});

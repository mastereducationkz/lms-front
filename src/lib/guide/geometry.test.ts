import { describe, expect, it } from 'vitest';
import { centerInViewport, clampToViewport, containedIn, EDGE, isRenderable, spotlightBox, visibleInViewport } from './geometry';
import { neighbourStep, settleStep, shownSteps, stepPosition, type StepLike } from './steps';

const view = { width: 1440, height: 800 };
const card = { width: 352, height: 240 };

describe('a card always lands fully inside the viewport', () => {
  it('leaves a card that already fits where it is', () => {
    expect(clampToViewport({ x: 300, y: 200 }, card, view)).toEqual({ x: 300, y: 200, clamped: false });
  });

  it('pulls back the old freeze positions: below the fold, above the top, off the left', () => {
    // Student 1440 step 5 (card at y 648, bottom 891 > 800); curator step 6 (top y=-118); x=-128 below 1024.
    expect(clampToViewport({ x: 851, y: 648 }, { width: 374, height: 243 }, view)).toMatchObject({ y: 800 - 243 - EDGE, clamped: true });
    expect(clampToViewport({ x: 270, y: -118 }, card, view)).toMatchObject({ y: EDGE, clamped: true });
    expect(clampToViewport({ x: -128, y: 300 }, card, { width: 390, height: 844 })).toMatchObject({ x: EDGE, clamped: true });
  });

  it('keeps every edge in, at every width the matrix runs', () => {
    for (const width of [1440, 1100, 768, 390]) {
      const viewport = { width, height: 800 };
      const size = { width: Math.min(352, width - 2 * EDGE), height: 260 };
      for (const pos of [{ x: -500, y: -500 }, { x: width, y: 900 }, { x: width / 2, y: 790 }]) {
        const p = clampToViewport(pos, size, viewport);
        expect(p.x).toBeGreaterThanOrEqual(EDGE);
        expect(p.y).toBeGreaterThanOrEqual(EDGE);
        expect(p.x + size.width).toBeLessThanOrEqual(width - EDGE);
        expect(p.y + size.height).toBeLessThanOrEqual(800 - EDGE);
      }
    }
  });

  it('pins a card taller than the screen to the top, where its own scroll takes over', () => {
    expect(clampToViewport({ x: 20, y: 400 }, { width: 300, height: 2000 }, view)).toMatchObject({ y: EDGE });
  });

  it('centres a card with no target, clamped like the rest', () => {
    expect(centerInViewport(card, view)).toEqual({ x: (1440 - 352) / 2, y: (800 - 240) / 2 });
    expect(centerInViewport({ width: 500, height: 900 }, { width: 390, height: 600 })).toEqual({ x: EDGE, y: EDGE });
  });
});

describe('what counts as on screen', () => {
  it('a hidden desktop sidebar link (0×0, display none) is not a target', () => {
    expect(isRenderable({ width: 0, height: 0 }, { display: 'block', visibility: 'visible' })).toBe(false);
    expect(isRenderable({ width: 200, height: 40 }, { display: 'none', visibility: 'visible' })).toBe(false);
    expect(isRenderable({ width: 200, height: 40 }, { display: 'flex', visibility: 'hidden' })).toBe(false);
    expect(isRenderable({ width: 200, height: 40 }, { display: 'flex', visibility: 'visible' })).toBe(true);
  });

  it('needs a real part of the element inside the viewport', () => {
    expect(visibleInViewport({ left: 10, top: 10, width: 100, height: 40 }, view)).toBe(true);
    expect(visibleInViewport({ left: 10, top: 1916, width: 100, height: 40 }, view)).toBe(false);
    expect(visibleInViewport({ left: 10, top: 796, width: 100, height: 40 }, view)).toBe(false);
  });

  it('knows when an element sits inside a scrolled sidebar’s visible box', () => {
    const nav = { left: 0, top: 100, width: 256, height: 600 };
    expect(containedIn({ left: 16, top: 140, width: 224, height: 40 }, nav)).toBe(true);
    expect(containedIn({ left: 16, top: 760, width: 224, height: 40 }, nav)).toBe(false);
  });

  it('pads the spotlight and trims it to the viewport', () => {
    expect(spotlightBox({ left: 20, top: 100, width: 200, height: 40 }, view)).toEqual({ left: 14, top: 94, width: 212, height: 52 });
    expect(spotlightBox({ left: -50, top: 780, width: 100, height: 40 }, view)).toEqual({ left: 0, top: 774, width: 56, height: 26 });
  });
});

describe('stepping through a tour', () => {
  const steps: StepLike[] = [
    { id: 'welcome' },
    { id: 'calendar', target: '#calendar' },
    { id: 'gone', target: '#gone' },
    { id: 'homework', target: '#homework' },
    { id: 'menu', target: '#menu' },
    { id: 'stars', target: '#stars' },
  ];
  const desktop = (sel: string) => ['#calendar', '#homework', '#stars'].includes(sel);
  const phone = (sel: string) => ['#menu', '#stars'].includes(sel);

  it('skips a stop whose element is missing, both ways', () => {
    expect(neighbourStep(steps, 'calendar', 1, desktop)?.id).toBe('homework');
    expect(neighbourStep(steps, 'homework', -1, desktop)?.id).toBe('calendar');
    expect(neighbourStep(steps, 'stars', 1, desktop)).toBeNull();
    expect(neighbourStep(steps, 'welcome', -1, desktop)).toBeNull();
  });

  it('a phone gets the menu stop instead of the hidden sidebar', () => {
    expect(shownSteps(steps, phone).map((s) => s.id)).toEqual(['welcome', 'menu', 'stars']);
    expect(shownSteps(steps, desktop).map((s) => s.id)).toEqual(['welcome', 'calendar', 'homework', 'stars']);
  });

  it('counts only the stops that can show', () => {
    expect(stepPosition(steps, 'homework', desktop)).toEqual({ index: 2, total: 4 });
    expect(stepPosition(steps, 'stars', phone)).toEqual({ index: 2, total: 3 });
  });

  it('after a resize to a phone, moves on to the next stop that shows, else back', () => {
    expect(settleStep(steps, 'calendar', phone)?.id).toBe('menu');
    expect(settleStep(steps, 'stars', phone)?.id).toBe('stars');
    expect(settleStep(steps, 'homework', (sel) => sel === '#calendar')?.id).toBe('calendar');
    expect(settleStep(steps, 'nope', desktop)?.id).toBe('welcome');
  });
});

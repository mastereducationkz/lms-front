// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});

import TipsLayer from './TipsLayer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lays nothing out: every element counts as shown, in a phone-sized viewport.
vi.mock('./dom', () => ({
  viewportSize: () => ({ width: 375, height: 844 }),
  isShown: () => true,
  findShown: (selector: string) => document.querySelector<HTMLElement>(selector),
  otherDialogOpen: () => false,
}));

// The phone layout is whatever this says: the tip layer asks for `max-width: 639px`.
let phone = false;
window.matchMedia = ((query: string) => ({
  get matches() { return phone && query.includes('max-width: 639px'); },
  media: query,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  onchange: null, dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

let host: HTMLDivElement;
let root: Root;
let anchor: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  anchor = document.createElement('div');
  anchor.setAttribute('data-tip', 'homework-due');
  anchor.getBoundingClientRect = () => ({ left: 16, top: 200, width: 200, height: 24, right: 216, bottom: 224, x: 16, y: 200, toJSON: () => ({}) });
  document.body.appendChild(anchor);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function show(onDismiss: (key: string) => void) {
  act(() => {
    root.render(<TipsLayer role="student" pathname="/homework/42" busy={false} dismissed={() => false} onDismiss={onDismiss} />);
  });
  // The anchor has to stay in view a moment before the tip shows.
  act(() => { vi.advanceTimersByTime(1500); });
  return document.querySelector<HTMLElement>('[data-guide="tip"]');
}

describe('TipsLayer on phones and desktops', () => {
  it('shows the tip as a bar at the bottom of a phone screen, not a bubble on the anchor', () => {
    phone = true;
    const tip = show(() => {});
    expect(tip).not.toBeNull();
    expect(tip!.dataset.variant).toBe('bar');
    expect(tip!.dataset.tipKey).toBe('homework.late');
    expect(tip!.className).toMatch(/\bfixed\b/);
    expect(tip!.className).toMatch(/\bbottom-0\b/);
    expect(tip!.className).toMatch(/safe-area-inset-bottom/);
    // Above the page and the Topbar (z-30), under dialogs (z-50).
    expect(tip!.className).toMatch(/\bz-40\b/);
    expect(tip!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.getElementById(tip!.getAttribute('aria-labelledby')!)?.textContent).toBeTruthy();
  });

  it('keeps the anchored bubble on a desktop', () => {
    phone = false;
    const tip = show(() => {});
    expect(tip).not.toBeNull();
    expect(tip!.dataset.variant).toBe('anchored');
    expect(tip!.dataset.tipKey).toBe('homework.late');
  });

  it.each([
    ['phone', true],
    ['desktop', false],
  ])('«Got it» marks the tip seen and hides it (%s)', (_label, isPhone) => {
    phone = isPhone;
    const onDismiss = vi.fn();
    const tip = show(onDismiss);
    const button = tip!.querySelector<HTMLButtonElement>('[data-guide-action="got-it"]');
    expect(button).not.toBeNull();
    act(() => button!.click());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledWith('homework.late');
    expect(document.querySelector('[data-guide="tip"]')).toBeNull();
  });
});

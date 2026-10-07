// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Bell, Download, LifeBuoy, Palette, ShieldCheck } from 'lucide-react';
import SettingsNav, { type NavItem } from './SettingsNav';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A fake page: a 900 px tall <main> that scrolls (scrollHeight 3000), five sections whose
// on-screen tops the test moves around. The last two are short, like Help and Install.
const items: NavItem[] = [
  { id: 'appearance', title: 'Appearance', icon: Palette },
  { id: 'notifications', title: 'Notifications', icon: Bell },
  { id: 'security', title: 'Security', icon: ShieldCheck },
  { id: 'help', title: 'Help', icon: LifeBuoy },
  { id: 'install', title: 'Install the app', icon: Download },
];
const H = 900;
let tops: Record<string, number>;
let scrollTop = 0;
let root: Root | null = null;
let main: HTMLElement;

function layout(next: Record<string, number>, top: number) {
  tops = next;
  scrollTop = top;
}

beforeEach(async () => {
  // A frame later, as in a browser (a microtask, which act() flushes).
  let frames = 0;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    queueMicrotask(() => cb(0));
    return ++frames;
  };
  window.cancelAnimationFrame = () => undefined;
  window.matchMedia = ((q: string) => ({ matches: false, media: q })) as unknown as typeof window.matchMedia;
  Element.prototype.scrollIntoView = vi.fn();
  layout({ appearance: 0, notifications: 400, security: 1500, help: 2300, install: 2600 }, 0);

  main = document.createElement('main');
  main.style.overflowY = 'auto';
  Object.defineProperty(main, 'clientHeight', { get: () => H, configurable: true });
  Object.defineProperty(main, 'scrollHeight', { get: () => 3000, configurable: true });
  Object.defineProperty(main, 'scrollTop', { get: () => scrollTop, configurable: true });
  main.getBoundingClientRect = () => ({ top: 0, bottom: H, left: 0, right: 1280, width: 1280, height: H, x: 0, y: 0, toJSON() {} });
  document.body.appendChild(main);
  const heights: Record<string, number> = { appearance: 300, notifications: 900, security: 700, help: 150, install: 150 };
  for (const item of items) {
    const section = document.createElement('section');
    section.id = item.id;
    section.getBoundingClientRect = () => {
      const top = tops[item.id] - scrollTop;
      return { top, bottom: top + heights[item.id], left: 0, right: 800, width: 800, height: heights[item.id], x: 0, y: top, toJSON() {} };
    };
    main.appendChild(section);
  }
  const host = document.createElement('div');
  main.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<SettingsNav items={items} label="Sections" />));
});

afterEach(() => {
  act(() => root?.unmount());
  main.remove();
});

const current = () => main.querySelector('a[aria-current="true"]')?.textContent;
const link = (title: string) => [...main.querySelectorAll('a')].find((a) => a.textContent === title)!;
const scrollTo = async (top: number) => {
  scrollTop = top;
  await act(async () => main.dispatchEvent(new Event('scroll')));
};

describe('Settings index', () => {
  it('follows the section crossing the band near the top', async () => {
    expect(current()).toBe('Appearance');
    await scrollTo(300);
    expect(current()).toBe('Notifications');
  });

  it('clicking the last two items marks them, through the scroll the click starts', async () => {
    await act(async () => link('Help').click());
    expect(current()).toBe('Help');
    await scrollTo(2100); // the bottom: Help can't reach the top; before the fix the spy said Security
    expect(current()).toBe('Help');
    await act(async () => link('Install the app').click());
    expect(current()).toBe('Install the app');
    await scrollTo(2100);
    expect(current()).toBe('Install the app');
  });

  it('scrolled to the bottom by hand, the last visible section is marked', async () => {
    await scrollTo(2100);
    expect(current()).toBe('Install the app');
  });

  it('a manual scroll after a click hands the mark back to the spy', async () => {
    await act(async () => link('Help').click());
    await scrollTo(300);
    expect(current()).toBe('Help'); // still the click's own scroll
    await act(async () => window.dispatchEvent(new Event('wheel')));
    expect(current()).toBe('Notifications');
  });

  it('a scrolling key releases it too, but not typing in a field', async () => {
    await act(async () => link('Help').click());
    await scrollTo(300);
    const input = document.createElement('input');
    main.appendChild(input);
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(current()).toBe('Help');
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' })));
    expect(current()).toBe('Notifications');
  });

  it('respects reduced motion when scrolling to a section', async () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q })) as unknown as typeof window.matchMedia;
    await act(async () => link('Security').click());
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
  });
});

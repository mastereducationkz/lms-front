// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonProvider, useSeason } from './SeasonProvider';
import UserAvatar from '../components/mascot/UserAvatar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let seen: ReturnType<typeof useSeason> | null = null;

function Probe() {
  seen = useSeason();
  return null;
}

function mount(path = '/dashboard', extra: React.ReactNode = null) {
  act(() => root.render(
    <MemoryRouter initialEntries={[path]}>
      <SeasonProvider><Probe />{extra}</SeasonProvider>
    </MemoryRouter>,
  ));
}

const html = () => document.documentElement.classList;

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(new Date('2026-10-28T10:00:00+05:00'));
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  seen = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('SeasonProvider', () => {
  it('wears Halloween colours and decorations during the season', () => {
    mount();
    expect(html().contains('season-halloween')).toBe(true);
    expect(seen).toMatchObject({ season: 'halloween', enabled: true, decorate: true });
  });

  it('keeps the colours but no decorations on a quiet screen', () => {
    mount('/quiz/5');
    expect(html().contains('season-halloween')).toBe(true);
    expect(seen?.decorate).toBe(false);
  });

  it('takes everything down for this device when switched off, and remembers it', () => {
    mount();
    act(() => seen!.setEnabled(false));
    expect(html().contains('season-halloween')).toBe(false);
    expect(seen).toMatchObject({ season: 'halloween', enabled: false, decorate: false });
    act(() => root.unmount());
    root = createRoot(container);
    mount();
    expect(seen?.enabled).toBe(false);
    expect(html().contains('season-halloween')).toBe(false);
  });

  it('switches itself off at midnight in Almaty with the tab still open', () => {
    vi.setSystemTime(new Date('2026-10-31T23:59:00+05:00'));
    mount();
    expect(html().contains('season-halloween')).toBe(true);
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(seen?.season).toBeNull();
    expect(html().contains('season-halloween')).toBe(false);
  });

  it('does nothing outside a season', () => {
    vi.setSystemTime(new Date('2026-11-05T12:00:00+05:00'));
    mount();
    expect(seen).toMatchObject({ season: null, enabled: false, decorate: false });
    expect(html().contains('season-halloween')).toBe(false);
  });
});

describe('UserAvatar in a season', () => {
  it('moves the caller\'s classes to a box of the avatar\'s size, so «hidden md:block» still works', () => {
    mount('/dashboard', <UserAvatar name="Aida Serikova" size={26} className="hidden md:block" />);
    const outer = container.querySelector('span.relative') as HTMLElement;
    expect(outer.className).toContain('hidden md:block');
    expect(outer.style.width).toBe('26px');
    expect(outer.firstElementChild?.className).not.toContain('hidden');
  });

  it('is left exactly as it was on a quiet screen', () => {
    mount('/review', <UserAvatar name="Aida Serikova" size={26} className="hidden md:block" />);
    expect(container.querySelector('span.relative')).toBeNull();
    expect(container.querySelector('div.hidden')).not.toBeNull();
  });
});

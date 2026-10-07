// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Node 25 ships a half-working global localStorage that shadows jsdom's: plain in-memory ones.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
  };
}
for (const name of ['localStorage', 'sessionStorage'] as const) {
  const store = memoryStorage();
  vi.stubGlobal(name, store);
  Object.defineProperty(window, name, { value: store, configurable: true });
}

let currentUser: Record<string, unknown> | null = null;
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: currentUser }) }));

import { dismissSpotlight } from '../mascot/spotlight';
import { tourStore } from '../guide/tourStore';
import { QUIET_GRACE_MS } from '../../lib/attention';
import { useDashboardPrompt } from './useDashboardPrompt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let seen: { allowed: boolean; noteShown: () => void } | null = null;
function Probe() {
  seen = useDashboardPrompt();
  return null;
}

let root: Root | null = null;
async function mount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Probe />
      </MemoryRouter>,
    );
  });
}
const rerender = () => act(async () => undefined);
// A tour already seen, so onboarding isn't owed (lib/guide/state).
const seenTour = { tour_version_seen: 999, tips: {} };

describe('useDashboardPrompt', () => {
  beforeEach(async () => {
    // Past the attention queue's grace period after a page load, so a visit can be quiet.
    await new Promise((r) => setTimeout(r, QUIET_GRACE_MS + 50));
  });
  afterEach(() => {
    act(() => root?.unmount());
    tourStore.stop();
    tourStore.setTip(false);
  });

  it('a student with the automatic orca: the Kasatik spotlight goes first; after «Later» the install card may show', async () => {
    currentUser = { id: 41, role: 'student', mascot: null, assignment_zero_completed: true, ui_state: seenTour };
    localStorage.setItem('attention:first-visit-done:41', '1');
    await mount();
    expect(seen!.allowed).toBe(false);
    await act(async () => dismissSpotlight(41));
    expect(seen!.allowed).toBe(true);
  });

  it('waits while a tip is open or a tour runs', async () => {
    currentUser = { id: 42, role: 'student', mascot: 'orca-1', assignment_zero_completed: true, ui_state: seenTour };
    localStorage.setItem('attention:first-visit-done:42', '1');
    await mount();
    expect(seen!.allowed).toBe(true);
    await act(async () => tourStore.setTip(true));
    expect(seen!.allowed).toBe(false);
    await act(async () => tourStore.setTip(false));
    await act(async () => tourStore.start({ kind: 'student', stepId: 's1', origin: 'replay', path: '/dashboard' } as never));
    expect(seen!.allowed).toBe(false);
  });

  it('never while the onboarding tour is still owed (the first visit)', async () => {
    currentUser = { id: 43, role: 'student', mascot: 'orca-1', assignment_zero_completed: true, ui_state: { tour_version_seen: 0, tips: {} } };
    await mount();
    await rerender();
    expect(seen!.allowed).toBe(false);
  });

  it('once shown it stays when a tip opens later in the visit', async () => {
    currentUser = { id: 44, role: 'student', mascot: 'orca-1', assignment_zero_completed: true, ui_state: seenTour };
    localStorage.setItem('attention:first-visit-done:44', '1');
    await mount();
    expect(seen!.allowed).toBe(true);
    await act(async () => seen!.noteShown());
    await act(async () => tourStore.setTip(true));
    expect(seen!.allowed).toBe(true);
  });

  it('teachers have no queue or spotlight: only the tour and tips hold them back', async () => {
    currentUser = { id: 45, role: 'teacher', mascot: null, onboarding_completed: false };
    await mount();
    expect(seen!.allowed).toBe(true);
    await act(async () => tourStore.setTip(true));
    expect(seen!.allowed).toBe(false);
  });
});

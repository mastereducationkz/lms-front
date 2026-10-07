/**
 * The running tour, shared by whoever starts it (the guide manager, «Replay tour» in the menu and
 * Settings) and whatever must stay quiet while it runs (tips, the achievements celebration, the
 * Kasatik spotlight). A module store, so it outlives the AppLayout remount on every route change.
 */
import { useSyncExternalStore } from 'react';
import type { TourKind } from '@/lib/guide/state';

export type TourOrigin = 'auto' | 'replay';

export interface TourSession {
  kind: TourKind;
  stepId: string;
  origin: TourOrigin;
  /** The page it runs on; leaving it pauses (auto) or ends (replay) the tour, never «completes» it. */
  path: string;
}

export interface GuideSnapshot {
  session: TourSession | null;
  /** «Replay tour» was asked for; the manager starts it on the dashboard. */
  replayRequested: boolean;
  /** The full-screen welcome is up. */
  welcome: boolean;
  /** A one-time page tip is on screen (TipsLayer): dashboard prompts wait for it. */
  tip: boolean;
}

let snapshot: GuideSnapshot = { session: null, replayRequested: false, welcome: false, tip: false };
const listeners = new Set<() => void>();

function set(next: Partial<GuideSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export const tourStore = {
  get: (): GuideSnapshot => snapshot,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  start(session: TourSession): void {
    set({ session, replayRequested: false, welcome: false });
  },
  goTo(stepId: string): void {
    if (snapshot.session && snapshot.session.stepId !== stepId) set({ session: { ...snapshot.session, stepId } });
  },
  stop(): void {
    if (snapshot.session) set({ session: null });
  },
  requestReplay(): void {
    set({ replayRequested: true });
  },
  clearReplay(): void {
    if (snapshot.replayRequested) set({ replayRequested: false });
  },
  setWelcome(welcome: boolean): void {
    if (snapshot.welcome !== welcome) set({ welcome });
  },
  setTip(tip: boolean): void {
    if (snapshot.tip !== tip) set({ tip });
  },
};

export function useGuide(): GuideSnapshot {
  return useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get);
}

/** The tour (or the welcome before it) is on screen: popups and tips wait. */
export function useTourActive(): boolean {
  const g = useGuide();
  return g.session !== null || g.welcome;
}

/**
 * «Replay tour»: asks for it and goes to the dashboard, where every tour starts. Callers pass their
 * router's navigate and current path.
 */
export function requestTourReplay(navigate: (to: string) => void, pathname: string): void {
  tourStore.stop();
  tourStore.requestReplay();
  if (pathname !== '/dashboard') navigate('/dashboard');
}

/**
 * Seasonal decorations (owner, 2026-10-26): one provider decides whether a season is on, and the
 * rest of the app asks it through `useSeason()` / `<SeasonSlot>` without knowing which season.
 *
 *   on        — the calendar says a season is running (calendar.ts, Almaty time). Re-checked at the
 *               exact moment it ends, and whenever the tab comes back, so an open tab or a PWA
 *               left running drops the decorations at midnight with no deploy.
 *   enabled   — on, and this device has not switched it off (Settings → Appearance, or the
 *               greeting's «Turn off decorations»). Tabs stay in step through the storage event.
 *   decorate  — enabled, and this screen is not a quiet one (quietRoutes.ts). The palette follows
 *               `enabled`; pumpkins, bats, costumes and the hunt follow `decorate`.
 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { nextChangeAt, seasonAt, type SeasonId } from './calendar';
import { isQuietRoute } from './quietRoutes';
import './halloween/palette.css';

export interface SeasonState {
  season: SeasonId | null;
  enabled: boolean;
  decorate: boolean;
  setEnabled: (on: boolean) => void;
}

const OFF: SeasonState = { season: null, enabled: false, decorate: false, setEnabled: () => undefined };
const SeasonContext = createContext<SeasonState>(OFF);

// setTimeout fires at once beyond 2^31-1 ms; re-check at least every six hours instead.
const MAX_WAIT = 6 * 60 * 60 * 1000;

const offKey = (season: SeasonId) => `seasonal:${season}:off`;

function readOff(season: SeasonId | null): boolean {
  if (!season) return false;
  try {
    return window.localStorage.getItem(offKey(season)) === '1';
  } catch {
    return false;
  }
}

function useSeasonClock(): SeasonId | null {
  const [season, setSeason] = useState(() => seasonAt(Date.now()));
  useEffect(() => {
    let timer: number | undefined;
    const check = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      setSeason(seasonAt(now));
      const next = nextChangeAt(now);
      if (next !== null) timer = window.setTimeout(check, Math.min(next - now + 50, MAX_WAIT));
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return season;
}

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const season = useSeasonClock();
  const { pathname } = useLocation();
  const [off, setOff] = useState(() => readOff(season));

  useEffect(() => {
    setOff(readOff(season));
    if (!season) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === offKey(season)) setOff(event.newValue === '1');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [season]);

  const setEnabled = useCallback((on: boolean) => {
    if (!season) return;
    setOff(!on);
    try {
      if (on) window.localStorage.removeItem(offKey(season));
      else window.localStorage.setItem(offKey(season), '1');
    } catch {
      // Private mode: the choice holds for this visit.
    }
  }, [season]);

  const enabled = season !== null && !off;
  const decorate = enabled && !isQuietRoute(pathname);

  // Before paint, so the first frame already wears the season's colours.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!season || !enabled) return;
    const className = `season-${season}`;
    root.classList.add(className);
    return () => root.classList.remove(className);
  }, [season, enabled]);

  const value = useMemo<SeasonState>(() => ({ season, enabled, decorate, setEnabled }), [season, enabled, decorate, setEnabled]);
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

/** The season as this screen sees it. Outside the provider (the Meet add-on) it is always off. */
export function useSeason(): SeasonState {
  return useContext(SeasonContext);
}

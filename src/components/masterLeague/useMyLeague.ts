/**
 * The student's league season, fetched on mount and again when the tab comes back after a while
 * (an attendance mark or a handed-in homework lands in the banner without a reload). `null` while
 * loading and for anyone without a live season: the banner then renders nothing.
 */
import { useEffect, useState } from 'react';
import { getMyLeague, type MyLeague } from '@/services/api/masterLeague';

const REFRESH_AFTER_MS = 5 * 60 * 1000;

export function useMyLeague(enabled: boolean): MyLeague | null {
  const [league, setLeague] = useState<MyLeague | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLeague(null);
      return undefined;
    }
    let alive = true;
    let lastLoad = 0;
    const load = () => {
      lastLoad = Date.now();
      getMyLeague().then((res) => { if (alive) setLeague(res); });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad > REFRESH_AFTER_MS) load();
    };
    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);

  return league;
}

/** A clock that ticks every `everyMs` while `active`, else holds the moment it was last read. */
export function useNow(active: boolean, everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [active, everyMs]);
  return now;
}

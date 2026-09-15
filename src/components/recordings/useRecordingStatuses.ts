import { useEffect, useRef, useState } from 'react';
import { getRecordingStatuses, type RecordingStatusEntry } from '../../services/api/recordings';
import { nextRecordingPoll } from '../../lib/calendarRecordingStatus';

// An older server has no status route, and a failing one should not be asked every few seconds.
const BACKOFF_MS = 60_000;

/**
 * The live recording status of a handful of lessons — the calendar's open day (2026-09-15).
 *
 * Unlike the library's cards, calendar lessons carry only a cached summary, so this asks at once
 * when the lessons change, then again at the pace the busiest one needs, and stops when none is on
 * its way. One batched request, never one per lesson; only while the tab is in view, and at once
 * when it comes back.
 */
export function useRecordingStatuses(eventIds: number[], enabled = true): Record<string, RecordingStatusEntry> {
  const key = eventIds.join(',');
  const [entries, setEntries] = useState<Record<string, RecordingStatusEntry>>({});
  const latest = useRef(entries);

  useEffect(() => {
    if (!enabled || !key) return undefined;
    const ids = key.split(',').map(Number);
    let cancelled = false;
    let settled = false;
    let timer: number | undefined;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, ms);
    };
    async function tick() {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const fresh = await getRecordingStatuses(ids);
        if (cancelled) return;
        latest.current = { ...latest.current, ...fresh };
        setEntries(latest.current);
        const ms = nextRecordingPoll(ids, latest.current);
        settled = ms == null;
        if (ms != null) schedule(ms);
      } catch {
        if (!cancelled) schedule(BACKOFF_MS);
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !settled) {
        window.clearTimeout(timer);
        tick();
      }
    };

    tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, key]);

  return entries;
}

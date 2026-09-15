import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from 'react';
import { getRecordingStatuses, type RecordingLibraryItem } from '../../services/api/recordings';
import { fastestPoll, liveEventIds, mergeRecordingStatus } from '../../lib/recordingProgress';

// An older server has no status route, and a failing one should not be asked every few seconds.
const BACKOFF_MS = 60_000;

/**
 * Keeps the library's cards live while any of them is on its way (2026-09-15): one batched
 * request for all of them at the pace the busiest one needs — never a request per card, which
 * would exhaust the database pool — only while the tab is in view, and at once when it comes
 * back. Stops by itself when every card is ready or failed.
 */
export function useLiveRecordings(
  items: RecordingLibraryItem[],
  setItems: Dispatch<SetStateAction<RecordingLibraryItem[]>>,
  enabled = true,
) {
  const key = useMemo(() => liveEventIds(items).join(','), [items]);
  const interval = useMemo(() => fastestPoll(items), [items]);
  const failures = useRef(0);

  useEffect(() => {
    if (!enabled || !key || interval == null) return;
    const eventIds = key.split(',').map(Number);
    let cancelled = false;
    let inFlight = false;
    let timer: number | undefined;

    const schedule = (ms: number) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, ms);
    };
    async function tick() {
      if (cancelled || inFlight) return;
      if (document.visibilityState !== 'visible') { schedule(interval as number); return; }
      inFlight = true;
      try {
        const entries = await getRecordingStatuses(eventIds);
        if (cancelled) return;
        failures.current = 0;
        setItems((prev) => prev.map((item) => {
          const entry = entries[String(item.event_id)];
          return entry ? mergeRecordingStatus(item, entry) : item;
        }));
      } catch {
        failures.current += 1;
      } finally {
        inFlight = false;
      }
      if (!cancelled) schedule(failures.current ? BACKOFF_MS : (interval as number));
    }
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };

    schedule(interval);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, key, interval, setItems]);
}

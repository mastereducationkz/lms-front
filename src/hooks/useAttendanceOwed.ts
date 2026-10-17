import { useCallback, useState } from 'react';
import { getAttendanceOwed, type AttendanceOwed } from '../services/api/attendanceOwed';
import { useVisiblePolling } from './useVisiblePolling';

// Marks and scores are given in other tabs and on other pages: look again now and then.
const REFRESH_MS = 60_000;

/**
 * What the signed-in teacher still owes (`GET /dashboard/attendance-owed`). `owed` stays null until the
 * first answer and for a server that has no such endpoint yet — then a screen shows what it showed before.
 * Read on mount, then every minute while the tab is in view.
 */
export function useAttendanceOwed(): { owed: AttendanceOwed | null; loaded: boolean; reload: () => void } {
  const [owed, setOwed] = useState<AttendanceOwed | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await getAttendanceOwed();
      // The journal below re-renders with this page: an unchanged answer keeps the state as it was.
      setOwed((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch {
      // Keep what we had: a failed minute is not a reason to empty the list.
    }
    setLoaded(true);
  }, []);

  useVisiblePolling(() => { void load(); }, REFRESH_MS);

  return { owed, loaded, reload: () => { void load(); } };
}

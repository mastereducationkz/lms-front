import { useEffect, useState } from 'react';
import { msUntilOpen } from '../lib/attendanceStart';

/** A sleeping laptop holds its timers: look again at least this often while a lesson waits to open. */
const MAX_WAIT_MS = 60 * 60_000;

/**
 * «Now» for the attendance controls: read again when the next of these lessons opens for marks, so a
 * control closed before the start opens at the start minute without a reload. Also on coming back to
 * the tab. The timer goes with the screen.
 */
export function useAttendanceClock(starts: (string | null | undefined)[]): Date {
  const [now, setNow] = useState(() => new Date());
  const key = starts.join('|');

  useEffect(() => {
    const waits = starts.map((s) => msUntilOpen(s, now)).filter((ms): ms is number => ms != null);
    if (waits.length === 0) return;
    const id = window.setTimeout(() => setNow(new Date()), Math.min(...waits, MAX_WAIT_MS));
    const onVisible = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // `key` stands for `starts`: a fresh array each render must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, now]);

  return now;
}

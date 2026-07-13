import { useEffect, useRef } from 'react';

/**
 * Runs `callback` on an interval, but ONLY while the tab is visible. Polling pauses when the page
 * is hidden (background tab, locked phone) and fires one immediate refresh when it becomes visible
 * again. This keeps sidebar/chat badges fresh without thousands of idle background tabs hammering
 * the backend every few seconds — a meaningful share of the load the app was generating.
 *
 * The callback is kept in a ref so passing a fresh inline function each render does not restart
 * the interval; only `intervalMs` and `enabled` do.
 */
export function useVisiblePolling(
  callback: () => void,
  intervalMs: number,
  enabled: boolean = true,
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer == null) {
        timer = setInterval(() => {
          if (!document.hidden) savedCallback.current();
        }, intervalMs);
      }
    };
    const stop = () => {
      if (timer != null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        savedCallback.current();
        start();
      }
    };

    // Prime immediately, then poll while visible.
    if (!document.hidden) savedCallback.current();
    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, enabled]);
}

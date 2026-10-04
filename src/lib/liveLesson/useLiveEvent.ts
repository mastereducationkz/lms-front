import { useEffect, useRef } from 'react';
import type { LiveSocket } from './useLiveLesson';

/**
 * Listen to one live socket event (`live:reaction`, `live:lost`) for this lesson (owner,
 * 2026-10-04). The page has already joined the lesson's rooms through useLiveLesson.
 */
export function useLiveEvent<T extends { event_id?: number }>(socket: LiveSocket | null | undefined, eventId: number,
  name: string, handler: (payload: T) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload: T) => { if (payload?.event_id === eventId) latest.current(payload); };
    socket.on(name, listener);
    return () => { socket.off(name, listener); };
  }, [socket, eventId, name]);
}

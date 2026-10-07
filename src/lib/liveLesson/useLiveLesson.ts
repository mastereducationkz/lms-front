import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveApi } from './api';
import { clockOffset, timerLeft } from './logic';
import { RECONNECT_BUDGET_MS, backoffDelay, isTransient, liveErrorText, withReconnect } from './resilience';
import type { LiveState } from './types';
import { t } from '../i18n';
import '@/lib/i18n/catalogs/live';

/** The bit of socket.io-client's `Socket` this hook uses, so either app's socket fits. */
export interface LiveSocket {
  connected: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event: string, listener: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
}

// A lost nudge must not leave a screen stale for long: refetch anyway, faster while answers flow.
const POLL_ACTIVE_MS = 8_000;
const POLL_IDLE_MS = 25_000;
const HEARTBEAT_MS = 30_000;

/** For a write that isn't safe to send twice: does this fresh state show it landed already? */
export interface WriteOptions {
  landed?: (fresh: LiveState) => boolean;
}

/** Run a write through the live lesson: rides out a blip, then refreshes the screen. */
export type LiveAct = <T>(write: () => Promise<T>, options?: WriteOptions) => Promise<T | undefined>;

interface Options {
  eventId: number | null;
  api: LiveApi;
  socket?: LiveSocket | null;
  /** Students tell the server their page is open (the picker and participation read it). */
  heartbeat?: boolean;
  onLost?: (error: unknown) => boolean;
}

/**
 * One live lesson's state for one screen: fetched, refetched on each `live:update` nudge (the
 * server sends a version, never data), on a slow poll in case a nudge is lost, and when a timer
 * or an attached question runs out. `now()` is the server's clock, so every countdown agrees.
 *
 * A blip (a deploy drops the API for ~20 s) shows as `reconnecting`: a failed refresh retries on a
 * short backoff, writes resend (lib/liveLesson/resilience), and only after ~25 s does `error` say
 * "Couldn't reach the server" — it clears itself on the next refresh that works. `syncedAt` is when
 * the last good refresh started (performance.now()), so a screen can drop an older error by itself.
 */
export function useLiveLesson({ eventId, api, socket, heartbeat, onLost }: Options) {
  const [state, setState] = useState<LiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadDown, setLoadDown] = useState(false);
  const [writesWaiting, setWritesWaiting] = useState(0);
  const [syncedAt, setSyncedAt] = useState(0);
  const offset = useRef(0);
  const version = useRef(-1);
  const pending = useRef<number | null>(null);
  const retry = useRef<number | null>(null);
  const downSince = useRef<number | null>(null);
  const failures = useRef(0);
  const lost = useRef(onLost);
  lost.current = onLost;

  const load = useCallback(async () => {
    if (eventId == null) return;
    const startedAt = performance.now();
    try {
      const next = await api.state(eventId);
      offset.current = clockOffset(next.server_now);
      version.current = next.version;
      downSince.current = null;
      failures.current = 0;
      setState(next);
      setError(null);
      setLoadDown(false);
      setSyncedAt(startedAt);
    } catch (e) {
      if (lost.current?.(e)) return;
      if (!isTransient(e)) {
        setError(liveErrorText(e));
        return;
      }
      // A blip: look again soon, and only call it an error once it has lasted the whole window.
      downSince.current ??= Date.now();
      failures.current += 1;
      const over = Date.now() - downSince.current >= RECONNECT_BUDGET_MS;
      setLoadDown(!over);
      if (over) setError(t('live.offline'));
      if (retry.current == null) {
        retry.current = window.setTimeout(() => {
          retry.current = null;
          void load();
        }, backoffDelay(failures.current));
      }
    }
  }, [api, eventId]);

  // Many phones nudged at once should not all ask in the same millisecond.
  const schedule = useCallback((delay: number) => {
    if (pending.current != null) return;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      void load();
    }, delay);
  }, [load]);

  useEffect(() => {
    version.current = -1;
    downSince.current = null;
    failures.current = 0;
    setState(null);
    void load();
    return () => {
      if (pending.current != null) window.clearTimeout(pending.current);
      if (retry.current != null) window.clearTimeout(retry.current);
      pending.current = null;
      retry.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!socket || eventId == null) return;
    const join = () => socket.emit('live:join', { event_id: eventId });
    const onUpdate = (message: { event_id?: number; version?: number }) => {
      if (message?.event_id !== eventId) return;
      if (typeof message.version === 'number' && message.version <= version.current) return;
      schedule(heartbeat ? 150 + Math.random() * 600 : 200);
    };
    if (socket.connected) join();
    socket.on('connect', join);
    socket.on('live:update', onUpdate);
    return () => {
      socket.off('connect', join);
      socket.off('live:update', onUpdate);
      socket.emit('live:leave', { event_id: eventId });
    };
  }, [socket, eventId, schedule, heartbeat]);

  const busy = Boolean(state?.activity?.status === 'open' || state?.timer);
  useEffect(() => {
    if (eventId == null) return;
    const tick = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, busy ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    return () => window.clearInterval(tick);
  }, [eventId, busy, load]);

  // When a timer (and so an attached question) runs out, look again just after.
  const endsAt = state?.timer?.ends_at ?? state?.activity?.closes_at ?? null;
  useEffect(() => {
    if (!endsAt) return;
    const wait = Date.parse(endsAt) - (Date.now() + offset.current) + 700;
    if (!Number.isFinite(wait) || wait < 0 || wait > 3_600_000) return;
    const timer = window.setTimeout(() => void load(), wait);
    return () => window.clearTimeout(timer);
  }, [endsAt, load]);

  useEffect(() => {
    if (!heartbeat || eventId == null) return;
    const beat = () => { if (document.visibilityState === 'visible') void api.seen(eventId).catch(() => undefined); };
    beat();
    const tick = window.setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [heartbeat, eventId, api]);

  const now = useCallback(() => Date.now() + offset.current, []);

  /** Run a write, then show its result at once (the nudge will follow for everyone else). A blip is
   *  waited out (resending; an unsafe write first checks it didn't land); a refused write (the
   *  question closed a moment ago) also refreshes, so the screen catches up. */
  const act: LiveAct = useCallback(async <T,>(write: () => Promise<T>, options?: WriteOptions): Promise<T | undefined> => {
    const landed = options?.landed && eventId != null
      ? async () => options.landed!(await api.state(eventId))
      : undefined;
    try {
      return await withReconnect(write, {
        landed,
        onReconnecting: (on) => setWritesWaiting((n) => Math.max(0, n + (on ? 1 : -1))),
      });
    } finally {
      await load();
    }
  }, [api, eventId, load]);

  return {
    state, error, reload: load, now, act, syncedAt,
    reconnecting: loadDown || writesWaiting > 0,
    secondsLeft: () => timerLeft(state?.timer ?? null, now()),
  };
}

/** Seconds left, re-rendered every quarter second while a timer runs. */
export function useCountdown(state: LiveState | null, now: () => number): number | null {
  const [, force] = useState(0);
  const running = Boolean(state?.timer?.ends_at);
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => force((n) => n + 1), 250);
    return () => window.clearInterval(tick);
  }, [running]);
  return timerLeft(state?.timer ?? null, now());
}

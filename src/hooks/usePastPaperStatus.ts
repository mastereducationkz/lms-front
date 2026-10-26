import { useCallback, useEffect, useRef, useState } from 'react';
import { getPastPaperStatus, type PastPaperAssignmentStatus } from '../services/api/pastPapers';

/** A returning tab refreshes at most this often. */
export const REFOCUS_REFETCH_MS = 10_000;

export interface PastPaperStatusState {
  status: PastPaperAssignmentStatus | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/**
 * The live state of every past-paper task in one homework, fetched once per homework (and student).
 * Pass `assignmentId = null` for a homework with no past paper: nothing is requested.
 * A student reading their own work passes no student (a NaN from `Number(undefined)` counts as none).
 * The paper is taken in another tab, so the status is read again (quietly, at most every 10 s) when
 * this tab becomes visible or gains focus.
 */
export function usePastPaperStatus(assignmentId: number | null | undefined, studentId?: number | null): PastPaperStatusState {
  const [status, setStatus] = useState<PastPaperAssignmentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const enabled = assignmentId != null && Number.isFinite(assignmentId);
  const student = studentId != null && Number.isFinite(studentId) ? studentId : null;

  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getPastPaperStatus(assignmentId as number, student)
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, assignmentId, student, attempt]);

  const lastFetchAt = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    lastFetchAt.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFetchAt.current < REFOCUS_REFETCH_MS) return;
      lastFetchAt.current = now;
      // Quiet: keep what is on screen if this read fails.
      getPastPaperStatus(assignmentId as number, student)
        .then((result) => {
          if (!cancelled) setStatus(result);
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled, assignmentId, student, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, loading, failed, reload };
}

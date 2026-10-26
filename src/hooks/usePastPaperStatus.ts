import { useCallback, useEffect, useState } from 'react';
import { getPastPaperStatus, type PastPaperAssignmentStatus } from '../services/api/pastPapers';

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

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, loading, failed, reload };
}

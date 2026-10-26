import { useCallback, useEffect, useState } from 'react';
import { getPastPaperCatalog, type PastPaperCatalog } from '../services/api/pastPapers';

export interface PastPaperCatalogState {
  /** null until the first answer, and after a failed read. */
  catalog: PastPaperCatalog | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

/** SAT's paper list for the homework builder, with "already done" counted for the chosen groups. */
export function usePastPaperCatalog(groupIds: number[] | undefined): PastPaperCatalogState {
  const [catalog, setCatalog] = useState<PastPaperCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const groupKey = (groupIds ?? []).join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getPastPaperCatalog(groupKey ? groupKey.split(',').map(Number) : [])
      .then((result) => {
        if (!cancelled) setCatalog(result);
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupKey, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { catalog, loading, failed, reload };
}

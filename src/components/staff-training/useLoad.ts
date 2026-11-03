import { useCallback, useEffect, useRef, useState } from 'react';

export interface Loaded<T> { data: T | null; error: unknown; loading: boolean; reload: () => void }

/** Loads on mount and whenever `key` changes; `reload` fetches again without blanking what is shown (`keepPrevious`: nor does a new key). A late answer for an old key is dropped. */
export function useLoad<T>(load: () => Promise<T>, key: string | number, options: { keepPrevious?: boolean } = {}): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const latest = useRef(load);
  latest.current = load;
  const lastKey = useRef(key);

  useEffect(() => {
    let cancelled = false;
    if (lastKey.current !== key) {
      lastKey.current = key;
      if (!options.keepPrevious) setData(null);
    }
    setLoading(true);
    setError(null);
    latest.current()
      .then((value) => { if (!cancelled) setData(value); })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, loading, reload };
}

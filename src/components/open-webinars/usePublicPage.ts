import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicApiError, type WebinarState } from '../../services/api/publicWebinars';

export type PageState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'missing' }
  | { kind: 'cancelled' }
  | { kind: 'error' };

/**
 * Loads a public webinar page and keeps it fresh, so «starts in …» turns into the join button without a reload.
 *  - A later 404 / 410 REPLACES the page that was shown (the webinar was removed or cancelled meanwhile); a flaky
 *    connection or a 5xx does not: the visitor keeps what they were reading.
 *  - Polling stops once the webinar is over or gone: nothing on the page changes by itself any more.
 */
export function usePublicPage<T extends { state: WebinarState }>(key: string, fetcher: (key: string) => Promise<T>, refreshMs: number) {
  const [state, setState] = useState<PageState<T>>({ kind: 'loading' });
  const latest = useRef(0);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    try {
      const data = await fetcher(key);
      if (mine === latest.current) setState({ kind: 'ready', data });
    } catch (failure) {
      if (mine !== latest.current) return;
      setState((now): PageState<T> => {
        if (failure instanceof PublicApiError && failure.status === 404) return { kind: 'missing' };
        if (failure instanceof PublicApiError && failure.status === 410) return { kind: 'cancelled' };
        return now.kind === 'ready' ? now : { kind: 'error' };
      });
    }
  }, [key, fetcher]);

  const finished = state.kind === 'missing' || state.kind === 'cancelled' || (state.kind === 'ready' && state.data.state === 'ended');

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => void load(), refreshMs);
    return () => window.clearInterval(id);
  }, [load, finished, refreshMs]);

  const retry = useCallback(() => { setState({ kind: 'loading' }); void load(); }, [load]);
  return { state, retry };
}

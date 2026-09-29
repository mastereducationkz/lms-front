import { useCallback, useEffect, useState } from 'react';
import type { LiveApi } from './api';
import type { ScoreSuggestion } from './types';

/**
 * Suggested activity scores from the live page (owner, 2026-09-29), for «Баллы за урок». Nothing is
 * saved until the teacher confirms, and a confirm writes the empty cells only.
 */
export function useScoreSuggestions(api: LiveApi, eventId: number, enabled: boolean, reloadKey?: unknown) {
  const [byUser, setByUser] = useState<Map<number, ScoreSuggestion>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) { setByUser(new Map()); return; }
    try {
      const found = await api.suggestions(eventId);
      setByUser(new Map(found.students.filter((s) => s.suggested != null).map((s) => [s.user_id, s])));
    } catch {
      setByUser(new Map());
    }
  }, [api, eventId, enabled]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const waiting = [...byUser.values()].filter((s) => s.current == null).length;

  const confirm = async (): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await api.confirm(eventId);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message || 'Could not save the suggested scores');
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { byUser, waiting, confirm, busy, error };
}

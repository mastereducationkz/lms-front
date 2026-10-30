import { useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ACCESS_REFUSED_EVENT } from '../../services/api/client';

const MIN_GAP_MS = 10_000;

/**
 * Keeps a trial prospect's grant current. An admin can revoke, shorten or extend it at any time
 * and the app only learns that from /auth/me, so this re-reads the user when the API refuses
 * something (ACCESS_REFUSED_EVENT) and when the tab comes back into view — at most once every
 * 10 s. ProtectedRoute then shows the expired panel, or lets the prospect back in.
 */
export function useTrialStatusRefresh(enabled: boolean): void {
  const { refreshUser } = useAuth();
  const refreshRef = useRef(refreshUser);
  refreshRef.current = refreshUser;
  const lastRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      const now = Date.now();
      if (now - lastRef.current < MIN_GAP_MS) return;
      lastRef.current = now;
      void refreshRef.current();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(ACCESS_REFUSED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(ACCESS_REFUSED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}

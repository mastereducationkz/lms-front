/**
 * How a live screen shows its connection (owner Q44): a quiet "Reconnecting…" while a blip is
 * waited out, a plain "Couldn't reach the server" only once it has lasted the whole window, and a
 * failed tap's message that clears itself on the next refresh that works, not only on the next tap.
 */
import { createContext, useContext, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { liveErrorText } from '../../lib/liveLesson/resilience';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/live';

export interface LiveConnection {
  reconnecting: boolean;
  /** The refresh's own error (already plain), once a blip has outlasted the window. */
  error: string | null;
  /** When the last good refresh started (performance.now()). */
  syncedAt: number;
}

export const LiveConnectionContext = createContext<LiveConnection>({ reconnecting: false, error: null, syncedAt: 0 });

export function useLiveConnection(): LiveConnection {
  return useContext(LiveConnectionContext);
}

/** A tap's failure, worded plainly, shown until the next good refresh (or the next tap). */
export function useWriteFailure() {
  const { syncedAt } = useLiveConnection();
  const [failure, setFailure] = useState<{ text: string; at: number } | null>(null);
  return {
    text: failure && failure.at > syncedAt ? failure.text : null,
    fail: (error: unknown) => setFailure({ text: liveErrorText(error), at: performance.now() }),
    clear: () => setFailure(null),
  };
}

export function ConnectionNote({ reconnecting, error, className = '' }: { reconnecting: boolean; error?: string | null; className?: string }) {
  const t = useT();
  if (reconnecting) {
    return (
      <p role="status" aria-live="polite"
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        {t('live.reconnecting')}
      </p>
    );
  }
  if (!error) return null;
  return (
    <p role="alert" className={`rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 ${className}`}>
      {error}
    </p>
  );
}

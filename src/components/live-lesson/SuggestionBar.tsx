import { Loader2, Sparkles } from 'lucide-react';

/** «Confirm suggested (N)» under «Баллы за урок»: fills the empty cells with the live page's suggestions. */
export default function SuggestionBar({ waiting, busy, error, onConfirm }: {
  waiting: number; busy: boolean; error: string | null; onConfirm: () => void;
}) {
  if (!waiting && !error) return null;
  return (
    <div className="my-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
        Suggested from the live page for {waiting} student{waiting === 1 ? '' : 's'} (shown faded). Only empty scores are filled.
      </span>
      <button type="button" disabled={busy || !waiting} onClick={onConfirm}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-semibold text-primary-foreground disabled:opacity-40">
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}Confirm suggested ({waiting})
      </button>
      {error && <p className="w-full text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}

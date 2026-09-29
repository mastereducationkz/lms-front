import { useEffect, useState } from 'react';
import { Loader2, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import type { LiveMode, LiveSettings } from '../../lib/liveLesson/types';
import { live } from '../../services/api/liveLesson';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const READERS = new Set(['admin', 'head_teacher', 'head_curator', 'teacher']);
const MODES: { key: LiveMode; label: string; hint: string }[] = [
  { key: 'off', label: 'Off', hint: 'Nobody starts live activities; students see nothing at /live.' },
  { key: 'admins', label: 'Admins only', hint: 'Only admins start activities, for testing on a real lesson. Students join wherever one runs.' },
  { key: 'everyone', label: 'Everyone', hint: 'Every teacher runs polls, clouds, pop-checks, the timer and the picker in their own lessons.' },
];

/**
 * The live-lesson switch beside the Register switch (owner, 2026-09-29): deployed Off, Admins only for
 * the prod test, then Everyone. Admins change it; heads and teachers see it. Also the kill switch.
 */
export function LiveSwitchButton({ role }: { role: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<LiveSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const canChange = role === 'admin';
  const visible = READERS.has(role ?? '') && role !== 'teacher';

  useEffect(() => {
    if (!visible) return;
    live.settings().then(setSettings).catch(() => setSettings(null));
  }, [visible]);

  if (!visible) return null;

  const change = async (mode: LiveMode) => {
    if (!settings || mode === settings.mode) return;
    setBusy(true);
    try {
      setSettings(await live.setMode(mode));
      toast.success(mode === 'off' ? 'Live lessons switched off' : mode === 'admins' ? 'Live lessons: admins only' : 'Live lessons on for every teacher');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change the switch');
    } finally {
      setBusy(false);
    }
  };
  const mode = settings?.mode;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" aria-hidden />
          Live lesson
          <span className={cn('rounded px-1.5 text-[11px] font-semibold uppercase',
            mode === 'everyone' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : mode === 'admins' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-muted text-muted-foreground')}>
            {mode === 'admins' ? 'admins' : mode ?? '…'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-3 p-4">
        <div className="text-sm font-semibold text-foreground">Who runs live activities</div>
        {!settings ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Live lesson mode" className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              {MODES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} disabled={!canChange || busy}
                  onClick={() => void change(m.key)}
                  className={cn('rounded-md px-2 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed',
                    mode === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{MODES.find((m) => m.key === mode)?.hint}</p>
            {settings.updated_by && <p className="text-xs text-muted-foreground">Last changed by {settings.updated_by}</p>}
            {!canChange && <p className="text-xs text-muted-foreground">Only admins can change this.</p>}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default LiveSwitchButton;

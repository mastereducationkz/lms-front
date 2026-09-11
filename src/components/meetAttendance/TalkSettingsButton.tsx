import { useEffect, useState } from 'react';
import { Loader2, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { APP_TIMEZONE } from '../../lib/datetime';
import { getTalkSettings, updateTalkSettings, type TalkSettings } from '../../services/api/meetTalk';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/** Who may see the switch: admins change it, heads read it. */
export const TALK_SETTINGS_READERS = new Set(['admin', 'head_curator', 'head_teacher']);

function Toggle({ id, checked, disabled, busy, onChange, label, hint }: {
  id: string;
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  onChange: () => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-hint`}
        disabled={disabled || busy}
        onClick={onChange}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 flex-none items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
          checked ? 'bg-primary' : 'bg-muted-foreground/30',
          disabled && 'opacity-60',
        )}
      >
        <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
        {busy && <Loader2 className="absolute -right-5 h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
      </button>
      <label htmlFor={id} className="min-w-0">
        <span className="block text-[13px] font-medium text-foreground">{label}</span>
        <span id={`${id}-hint`} className="block text-xs leading-snug text-muted-foreground">{hint}</span>
      </label>
    </div>
  );
}

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: APP_TIMEZONE });
}

interface Props {
  role: string | undefined;
  /** The switch moved: the page reloads what depends on it. */
  onChanged?: (settings: TalkSettings) => void;
}

/**
 * The talk-time switch, beside the page title: on, Meet transcribes every LMS lesson room from
 * the next lesson; off, it stops and saved talk time stays. Admins change it; heads can see it.
 */
export function TalkSettingsButton({ role, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<TalkSettings | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<'enabled' | 'transcripts' | null>(null);
  const canChange = role === 'admin';

  // Loaded once up front, so the button can say whether it is on.
  useEffect(() => {
    if (!TALK_SETTINGS_READERS.has(role ?? '')) return;
    getTalkSettings().then(setSettings).catch((e) => setFailed(e instanceof Error ? e.message : 'Could not load'));
  }, [role]);

  if (!TALK_SETTINGS_READERS.has(role ?? '')) return null;

  const flip = async (key: 'enabled' | 'transcripts') => {
    if (!settings) return;
    setBusy(key);
    try {
      const next = await updateTalkSettings({ [key]: !settings[key] });
      setSettings(next);
      onChanged?.(next);
      if (key === 'enabled') {
        toast.success(next.enabled ? 'Talk time is on' : 'Talk time is off', {
          description: next.enabled
            ? 'Meet starts transcribing LMS lesson rooms from the next lesson.'
            : 'Meet stops transcribing. Talk time already saved stays.',
        });
      } else {
        toast.success(next.transcripts ? 'Transcripts are on' : 'Transcripts are off', {
          description: next.transcripts ? 'New lessons get text and interaction figures.' : 'Talk time continues without text.',
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change the setting');
    } finally {
      setBusy(null);
    }
  };

  const on = settings?.enabled ?? false;
  const since = when(settings?.enabled_at ?? null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MessagesSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
          Talk time
          <span className={cn('h-2 w-2 rounded-full', settings === null ? 'bg-muted-foreground/30' : on ? 'bg-emerald-500' : 'bg-slate-400')}
            aria-label={settings === null ? undefined : on ? 'on' : 'off'} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-4 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">Talk time {settings ? (on ? 'is on' : 'is off') : ''}</div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            On: Meet transcribes every LMS lesson room from the next lesson; everyone in the call sees Meet&apos;s
            transcription notice. Off: it stops; talk time already saved stays.
          </p>
        </div>

        {failed && !settings && <p className="text-xs text-rose-600 dark:text-rose-400">{failed}</p>}
        {!settings && !failed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        )}

        {settings && (
          <>
            <div className="space-y-3">
              <Toggle id="talk-enabled" checked={settings.enabled} disabled={!canChange} busy={busy === 'enabled'}
                onChange={() => flip('enabled')} label="Talk time"
                hint={since && settings.enabled ? `On since ${since}${settings.updated_by ? ` · ${settings.updated_by}` : ''}` : 'Who spoke and for how long, from Meet.'} />
              <Toggle id="talk-transcripts" checked={settings.transcripts} disabled={!canChange || !settings.deepgram_configured}
                busy={busy === 'transcripts'} onChange={() => flip('transcripts')} label="Transcripts"
                hint={settings.deepgram_configured
                  ? 'Readable text, searchable, and the interaction figures. Paid per audio hour (Deepgram).'
                  : 'Needs a Deepgram key on the server.'} />
            </div>
            {!canChange && <p className="text-xs text-muted-foreground">Only admins can change these.</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
              <dt className="text-muted-foreground">This month</dt>
              <dd className="tabular-nums text-foreground">
                {settings.usage.lessons} lesson{settings.usage.lessons === 1 ? '' : 's'} · {settings.usage.audio_hours.toLocaleString('en-GB', { maximumFractionDigits: 1 })} h audio · ≈ ${settings.usage.estimated_usd.toFixed(2)}
              </dd>
              <dt className="text-muted-foreground">Deepgram</dt>
              <dd className="text-foreground">{settings.deepgram_configured ? 'Configured' : 'Not configured'}</dd>
            </dl>
            {settings.last_error && (
              <p className="rounded-md bg-rose-50 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {settings.last_error}
              </p>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

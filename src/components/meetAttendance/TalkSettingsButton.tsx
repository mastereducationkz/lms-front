import { useEffect, useState } from 'react';
import { Loader2, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getTalkSettings, updateTalkSettings, type TalkSettings } from '../../services/api/meetTalk';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { formatDateTime, formatNumber } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

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
        <span className={cn('inline-block h-4 w-4 rounded-full bg-card shadow transition', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
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
  return formatDateTime(iso) || null;
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
  const t = useT();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<TalkSettings | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<'enabled' | 'transcripts' | null>(null);
  const canChange = role === 'admin';

  // Loaded once up front, so the button can say whether it is on.
  useEffect(() => {
    if (!TALK_SETTINGS_READERS.has(role ?? '')) return;
    getTalkSettings().then(setSettings).catch((e) => setFailed(e instanceof Error ? e.message : t('meetViews.shared.couldNotLoad')));
  }, [role, t]);

  if (!TALK_SETTINGS_READERS.has(role ?? '')) return null;

  const flip = async (key: 'enabled' | 'transcripts') => {
    if (!settings) return;
    setBusy(key);
    try {
      const next = await updateTalkSettings({ [key]: !settings[key] });
      setSettings(next);
      onChanged?.(next);
      if (key === 'enabled') {
        toast.success(t(next.enabled ? 'meetViews.talkSettings.on' : 'meetViews.talkSettings.off'), {
          description: t(next.enabled ? 'meetViews.talkSettings.onHint' : 'meetViews.talkSettings.offHint'),
        });
      } else {
        toast.success(t(next.transcripts ? 'meetViews.talkSettings.transcriptsOn' : 'meetViews.talkSettings.transcriptsOff'), {
          description: t(next.transcripts ? 'meetViews.talkSettings.transcriptsOnHint' : 'meetViews.talkSettings.transcriptsOffHint'),
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('meetViews.talkSettings.changeFailed'));
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
          {t('meet.talkCard.title')}
          <span className={cn('h-2 w-2 rounded-full', settings === null ? 'bg-muted-foreground/30' : on ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-muted-foreground/40')}
            aria-label={settings === null ? undefined : t(on ? 'meetViews.talkSettings.dotOn' : 'meetViews.talkSettings.dotOff')} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-4 p-4">
        <div>
          <div className="text-sm font-semibold text-foreground">
            {settings ? t(on ? 'meetViews.talkSettings.on' : 'meetViews.talkSettings.off') : t('meet.talkCard.title')}
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {t('meetViews.talkSettings.about')}
          </p>
        </div>

        {failed && !settings && <p className="text-xs text-rose-600 dark:text-rose-400">{failed}</p>}
        {!settings && !failed && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}</div>
        )}

        {settings && (
          <>
            <div className="space-y-3">
              <Toggle id="talk-enabled" checked={settings.enabled} disabled={!canChange} busy={busy === 'enabled'}
                onChange={() => flip('enabled')} label={t('meet.talkCard.title')}
                hint={since && settings.enabled
                  ? `${t('meetViews.talkSettings.onSince', { date: since })}${settings.updated_by ? ` · ${settings.updated_by}` : ''}`
                  : t('meetViews.talkSettings.toggleHint')} />
              <Toggle id="talk-transcripts" checked={settings.transcripts} disabled={!canChange || !settings.deepgram_configured}
                busy={busy === 'transcripts'} onChange={() => flip('transcripts')} label={t('meetViews.talkSettings.transcripts')}
                hint={t(settings.deepgram_configured ? 'meetViews.talkSettings.transcriptsHint' : 'meetViews.talkSettings.needsKey')} />
            </div>
            {!canChange && <p className="text-xs text-muted-foreground">{t('meetViews.talkSettings.adminsOnly')}</p>}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
              <dt className="text-muted-foreground">{t('meetViews.talkSettings.thisMonth')}</dt>
              <dd className="tabular-nums text-foreground">
                {t('meetViews.talkSettings.usage', {
                  count: settings.usage.lessons,
                  hours: formatNumber(settings.usage.audio_hours, { maximumFractionDigits: 1 }),
                  usd: formatNumber(settings.usage.estimated_usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })}
              </dd>
              <dt className="text-muted-foreground">Deepgram</dt>
              <dd className="text-foreground">{t(settings.deepgram_configured ? 'meetViews.talkSettings.configured' : 'meetViews.talkSettings.notConfigured')}</dd>
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

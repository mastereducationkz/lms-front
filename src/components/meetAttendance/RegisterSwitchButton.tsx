import { useEffect, useState } from 'react';
import { ClipboardCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { getRegisterSettings, updateRegisterSettings, type RegisterMode, type RegisterSettings } from '../../services/api/meetRegister';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { TALK_SETTINGS_READERS } from './TalkSettingsButton';
import { formatDateTime, type MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meetViews';

const MODES: { key: RegisterMode; label: MessageKey; hint: MessageKey }[] = [
  { key: 'off', label: 'meetViews.shared.off', hint: 'meetViews.registerSwitch.offHint' },
  { key: 'shadow', label: 'meetViews.registerSwitch.shadow', hint: 'meetViews.registerSwitch.shadowHint' },
  { key: 'live', label: 'meetViews.registerSwitch.live', hint: 'meetViews.registerSwitch.liveHint' },
];

function when(iso: string | null): string | null {
  if (!iso) return null;
  return formatDateTime(iso) || null;
}

/**
 * The register switch beside the page title (owner, 2026-09-23). Admins change it; heads see it. Going
 * live asks once more — from that moment Meet's marks bill students and pay teachers like anyone's.
 */
export function RegisterSwitchButton({ role, onChanged }: { role: string | undefined; onChanged?: (s: RegisterSettings) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<RegisterSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const canChange = role === 'admin';

  useEffect(() => {
    if (!TALK_SETTINGS_READERS.has(role ?? '')) return;
    getRegisterSettings().then(setSettings).catch(() => setSettings(null));
  }, [role]);

  if (!TALK_SETTINGS_READERS.has(role ?? '')) return null;

  const change = async (mode: RegisterMode) => {
    if (!settings || mode === settings.mode) return;
    if (mode === 'live' && !confirmLive) { setConfirmLive(true); return; }
    setBusy(true);
    try {
      const next = await updateRegisterSettings(mode);
      setSettings(next);
      setConfirmLive(false);
      onChanged?.(next);
      toast.success(t(mode === 'live' ? 'meetViews.registerSwitch.nowLive' : mode === 'shadow' ? 'meetViews.registerSwitch.nowShadow' : 'meetViews.registerSwitch.nowOff'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('meetViews.shared.switchFailed'));
    } finally {
      setBusy(false);
    }
  };

  const mode = settings?.mode;
  const modeInfo = MODES.find((m) => m.key === mode);
  const since = mode === 'live' ? when(settings?.live_since ?? null) : mode === 'shadow' ? when(settings?.shadow_since ?? null) : null;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmLive(false); }}>
      <PopoverTrigger asChild>
        <button type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
          {t('meetViews.registerSwitch.button')}
          <span className={cn('rounded px-1.5 text-[11px] font-semibold uppercase',
            mode === 'live' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
              : mode === 'shadow' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                : 'bg-muted text-muted-foreground')}>
            {modeInfo ? t(modeInfo.label) : (mode ?? '…')}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] space-y-3 p-4">
        <div className="text-sm font-semibold text-foreground">{t('meetViews.registerSwitch.title')}</div>
        {!settings ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}</div>
        ) : (
          <>
            <div role="radiogroup" aria-label={t('meetViews.registerSwitch.mode')} className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
              {MODES.map((m) => (
                <button key={m.key} type="button" role="radio" aria-checked={mode === m.key} disabled={!canChange || busy}
                  onClick={() => change(m.key)}
                  className={cn('rounded-md px-2 py-1.5 text-[13px] font-medium transition disabled:cursor-not-allowed',
                    mode === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {t(m.label)}
                </button>
              ))}
            </div>
            <p className="text-xs leading-snug text-muted-foreground">{modeInfo ? t(modeInfo.hint) : null}</p>
            {since && <p className="text-xs text-muted-foreground">{t('meetViews.registerSwitch.since', { date: since })}{settings.updated_by ? ` · ${settings.updated_by}` : ''}</p>}
            {confirmLive && (
              <div className="space-y-2 rounded-md bg-amber-50 p-2.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p>{t('meetViews.registerSwitch.confirmLive')}</p>
                <button type="button" disabled={busy} onClick={() => change('live')}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white disabled:opacity-60">{t('meetViews.registerSwitch.goLive')}</button>
              </div>
            )}
            {!canChange && <p className="text-xs text-muted-foreground">{t('meetViews.shared.adminsOnly')}</p>}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default RegisterSwitchButton;

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { POLL_MS, atUsername, isTelegramLink, telegramPhase } from '../../lib/telegramLink';
import { createTelegramLink, getTelegramStatus, unlinkTelegram, type TelegramStatus } from '../../services/api/notificationCenter';
import { SOLID, SettingsRow, SettingsSection } from './SettingsSection';

/**
 * The personal Telegram link (owner Q12–Q14): «Connect» asks the server for a t.me deep link, the
 * person opens it and taps Start, and this row polls until Telegram confirms (also on returning to
 * the tab). The link is a real anchor, not a script-opened window, so no popup blocker eats it.
 */
export default function TelegramSection() {
  const t = useT();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState<{ url: string; at: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const phase = telegramPhase(status, link?.at ?? null, now);

  const check = useCallback(() => {
    getTelegramStatus()
      .then((s) => {
        setStatus(s);
        setNow(Date.now());
        if (s.linked) setLink(null);
      })
      .catch(() => setNow(Date.now()));
  }, []);
  useEffect(check, [check]);

  // While waiting for Start: ask every few seconds, and at once when the person comes back.
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const timer = window.setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, check]);

  const connect = async () => {
    setBusy(true);
    try {
      const { deep_link } = await createTelegramLink();
      if (!isTelegramLink(deep_link)) throw new Error('not a Telegram link');
      setLink({ url: deep_link, at: Date.now() });
      setNow(Date.now());
    } catch {
      toast.error(t('settings.telegram.failed'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await unlinkTelegram());
      toast.success(t('settings.telegram.disconnected'));
    } catch {
      toast.error(t('settings.notifications.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const name = atUsername(status?.telegram_username);
  let description: string;
  let control: JSX.Element | null = null;
  switch (phase) {
    case 'checking':
      description = t('common.loading');
      break;
    case 'connected':
      description = status?.muted ? t('settings.telegram.muted') : t('settings.telegram.connectedNote');
      control = (
        <Button type="button" variant="outline" disabled={busy} onClick={disconnect}>
          {t('settings.telegram.disconnect')}
        </Button>
      );
      break;
    case 'waiting':
    case 'timed-out':
      description = phase === 'waiting' ? t('settings.telegram.waiting') : t('settings.telegram.timedOut');
      control = (
        <>
          <Button asChild className={`gap-2 ${SOLID}`}>
            <a href={link!.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" aria-hidden />
              {t('settings.telegram.open')}
            </a>
          </Button>
          {phase === 'timed-out' && (
            <Button type="button" variant="outline" disabled={busy} onClick={connect}>
              {t('settings.telegram.connect')}
            </Button>
          )}
        </>
      );
      break;
    default:
      description = phase === 'blocked' ? t('settings.telegram.blocked') : t('settings.telegram.notConnected');
      control = (
        <Button type="button" disabled={busy} onClick={connect} className={`gap-2 ${SOLID}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          {t('settings.telegram.connect')}
        </Button>
      );
  }

  const label =
    phase === 'connected' ? (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        {name ? t('settings.telegram.connected', { username: name }) : t('settings.telegram.connectedNoName')}
      </span>
    ) : phase === 'waiting' ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />
        {t('settings.telegram.title')}
      </span>
    ) : (
      t('settings.telegram.title')
    );

  return (
    <SettingsSection id="telegram" title={t('settings.telegram.title')} description={t('settings.telegram.description')}>
      <SettingsRow
        label={label}
        description={
          <>
            <span role="status">{description}</span>
            {status?.stale && <span className="mt-1 block text-xs">{t('settings.telegram.stale')}</span>}
          </>
        }
      >
        {control}
      </SettingsRow>
    </SettingsSection>
  );
}

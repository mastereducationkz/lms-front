import { useState } from 'react';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { disablePush, enablePush, usePushStatus } from '../../services/webPush';
import { useInstallFlow } from '../pwa/useInstallFlow';
import { SOLID, SettingsRow, SettingsSection } from './SettingsSection';

/**
 * Push on this device (web push, services/webPush): the one switch for it, formerly the «Lesson
 * reminders» card. Permission is asked only from the «Turn on» tap. An iPhone gets push only from
 * the installed app, so a Safari tab explains installing instead.
 */
export default function PushSection() {
  const t = useT();
  const status = usePushStatus();
  const { snapshot, t: copy, start, sheet } = useInstallFlow('settings');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(copy.remindersFailed);
    } finally {
      setBusy(false);
    }
  };

  const os = snapshot.platform.platform;
  const denied = os.startsWith('ios') ? copy.remindersDeniedIos : os.startsWith('android') ? copy.remindersDeniedAndroid : copy.remindersDeniedDesktop;
  const line =
    status === null
      ? copy.remindersChecking
      : status === 'unsupported'
        ? t('settings.push.unsupported')
        : status === 'needs-install'
          ? copy.remindersNeedsInstall
          : status === 'granted'
            ? copy.remindersOn
            : status === 'denied'
              ? denied
              : copy.remindersOff;

  return (
    <SettingsSection id="push" title={t('settings.push.title')} description={t('settings.push.description')}>
      <SettingsRow
        label={
          <span className="inline-flex items-center gap-2">
            {status === 'granted' ? <BellRing className="h-4 w-4 text-brand" aria-hidden /> : <BellOff className="h-4 w-4 text-muted-foreground" aria-hidden />}
            {copy.remindersTitle}
          </span>
        }
        description={<span role="status">{line}</span>}
      >
        {status === 'default' && (
          // enablePush must be the first await of the tap (services/webPush.ts).
          <Button type="button" disabled={busy} className={`gap-2 ${SOLID}`} onClick={() => run(enablePush)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {copy.turnOn}
          </Button>
        )}
        {status === 'granted' && (
          <Button type="button" variant="outline" disabled={busy} className="gap-2" onClick={() => run(disablePush)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {copy.turnOff}
          </Button>
        )}
        {status === 'needs-install' && (
          <>
            <Button type="button" variant="outline" onClick={start}>
              {copy.showMeHow}
            </Button>
            {sheet}
          </>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

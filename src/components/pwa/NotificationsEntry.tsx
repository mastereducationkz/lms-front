import { useState } from 'react';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { disablePush, enablePush, usePushStatus } from '../../services/webPush';
import { useInstallFlow } from './useInstallFlow';

const SOLID = 'bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover';

/**
 * «Lesson reminders» for the Settings page: this device's web push switch. Hidden when the
 * browser or the server can't do push at all.
 */
export default function NotificationsEntry() {
  const status = usePushStatus();
  const { snapshot, t, start, sheet } = useInstallFlow('settings');
  const [busy, setBusy] = useState(false);
  if (status === 'unsupported') return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } catch {
      toast.error(t.remindersFailed);
    } finally {
      setBusy(false);
    }
  };

  const os = snapshot.platform.platform;
  const denied = os.startsWith('ios') ? t.remindersDeniedIos : os.startsWith('android') ? t.remindersDeniedAndroid : t.remindersDeniedDesktop;
  const line =
    status === null
      ? t.remindersChecking
      : status === 'needs-install'
        ? t.remindersNeedsInstall
        : status === 'granted'
          ? t.remindersOn
          : status === 'denied'
            ? denied
            : t.remindersOff;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.remindersTitle}</CardTitle>
        <CardDescription>{t.remindersDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-64 items-start gap-3">
          <span
            className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${
              status === 'granted' ? 'bg-brand-subtle text-brand-subtle-foreground' : 'bg-muted text-muted-foreground'
            }`}
          >
            {status === 'granted' ? <BellRing className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
          </span>
          <p className="min-w-0 pt-1 text-sm text-foreground" role="status">
            {line}
          </p>
        </div>
        {status === 'default' && (
          // enablePush must be the first await of the tap (see services/webPush.ts).
          <Button type="button" disabled={busy} className={`gap-2 ${SOLID}`} onClick={() => run(enablePush)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t.turnOn}
          </Button>
        )}
        {status === 'granted' && (
          <Button type="button" variant="outline" disabled={busy} className="gap-2" onClick={() => run(disablePush)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {t.turnOff}
          </Button>
        )}
        {status === 'needs-install' && (
          <>
            <Button type="button" variant="outline" onClick={start}>
              {t.showMeHow}
            </Button>
            {sheet}
          </>
        )}
      </CardContent>
    </Card>
  );
}

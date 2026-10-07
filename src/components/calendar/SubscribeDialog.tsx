import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Info, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  getCalendarSubscriptions, rotatePersonalFeed, type CalendarSubscriptions,
} from '../../services/api/calendarFeeds';
import { sortGroupCalendars, webcalUrl } from '../../lib/calendarFeeds';
import { inAppBrowser } from '../../lib/calendarApps';
import type { PlatformEnv } from '../../lib/pwaPlatform';
import AddToCalendar from './AddToCalendar';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/calendar';

/**
 * «Подписаться» on the Calendar page (and Settings → Calendar): each group calendar and the
 * personal feed of one's own lessons and deadlines, with a one-tap button for the device's
 * calendar app (owner, 2026-10-07; lib/calendarApps), the other apps in a menu, and "Copy link".
 * A group's real Google Calendar (kept in sync, so changes show at once) is the Google option
 * where the LMS has made one.
 */
export default function SubscribeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<CalendarSubscriptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const t = useT();
  const env = useMemo<PlatformEnv>(() => ({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    telegramWebview: 'TelegramWebviewProxy' in window,
  }), []);
  const inApp = inAppBrowser(env);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getCalendarSubscriptions()
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Copies the subscribe (webcal) form of an https feed, as before; never builds one from http.
  const copy = (icsUrl: string) => {
    navigator.clipboard.writeText(webcalUrl(icsUrl) ?? icsUrl).then(
      () => toast.success(t('calendar.subscribe.copied'), { description: t('calendar.subscribe.copiedHint') }),
      () => toast.error(t('calendar.subscribe.copyFailed')),
    );
  };

  const reset = async () => {
    setResetting(true);
    try {
      const personal = await rotatePersonalFeed();
      setData((prev) => (prev ? { ...prev, personal } : prev));
      toast.success(t('calendar.subscribe.linkReset'), { description: t('calendar.subscribe.linkResetHint') });
    } catch {
      toast.error(t('calendar.subscribe.resetFailed'));
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  };

  const groups = data ? sortGroupCalendars(data.groups) : [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-xl flex-col gap-0">
          <DialogHeader className="flex-shrink-0 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5 text-primary" />
              {t('calendar.subscribe.title')}
            </DialogTitle>
            <DialogDescription>
              {t('calendar.subscribe.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-6 flex-1 overflow-y-auto px-6 pb-2">
            {loading && (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {failed && !loading && (
              <p className="py-6 text-center text-sm text-destructive">{t('calendar.subscribe.loadFailed')}</p>
            )}

            {data && !loading && (
              <div className="space-y-5">
                {inApp.inApp && (
                  <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {inApp.appName ? t('calendar.subscribe.inApp', { app: inApp.appName }) : t('calendar.subscribe.inAppGeneric')}
                  </p>
                )}
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('calendar.subscribe.groupCalendars')}</h3>
                  {groups.length === 0 && <p className="text-sm text-muted-foreground">{t('calendar.subscribe.noGroups')}</p>}
                  {groups.map((row) => (
                    <div key={row.group_id} className="rounded-xl border border-border p-3">
                      <div className="mb-2 text-sm font-medium">{row.group_name}</div>
                      <AddToCalendar
                        source={{ icsUrl: row.ics_url, name: row.group_name, googleUrl: row.google_url }}
                        env={env}
                        onCopy={() => copy(row.ics_url)}
                      />
                    </div>
                  ))}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('calendar.subscribe.myCalendar')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('calendar.subscribe.myCalendarHint')}
                  </p>
                  <AddToCalendar
                    source={{ icsUrl: data.personal.ics_url, name: t('calendar.subscribe.personalName') }}
                    env={env}
                    onCopy={() => copy(data.personal.ics_url)}
                  >
                    <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} disabled={resetting}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {t('calendar.subscribe.resetLink')}
                    </Button>
                  </AddToCalendar>
                </section>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('calendar.subscribe.resetConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('calendar.subscribe.resetConfirmBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void reset(); }} disabled={resetting}>
              {t('calendar.subscribe.reset')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

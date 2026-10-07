import { useEffect, useState } from 'react';
import { CalendarPlus, Copy, Loader2, RefreshCw } from 'lucide-react';
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
import { canAddToGoogle, sortGroupCalendars, webcalUrl } from '../../lib/calendarFeeds';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/calendar';

/**
 * «Подписаться» on the Calendar page: add a group's calendar to Google (a real Google Calendar
 * the LMS keeps in sync, so changes show up at once), or subscribe from Apple Calendar / Outlook
 * with the ICS link, or take a personal feed of all one's own lessons and deadlines.
 */
export default function SubscribeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = useState<CalendarSubscriptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const t = useT();

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

  const copy = (url: string) => {
    navigator.clipboard.writeText(webcalUrl(url)).then(
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
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('calendar.subscribe.groupCalendars')}</h3>
                  {groups.length === 0 && <p className="text-sm text-muted-foreground">{t('calendar.subscribe.noGroups')}</p>}
                  {groups.map((row) => (
                    <div key={row.group_id} className="rounded-xl border border-border p-3">
                      <div className="text-sm font-medium">{row.group_name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {canAddToGoogle(row) ? (
                          <Button size="sm" asChild>
                            <a href={row.google_url ?? undefined} target="_blank" rel="noopener noreferrer">
                              {t('calendar.subscribe.addToGoogle')}
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t('calendar.subscribe.googlePending')}</span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => copy(row.webcal_url || row.ics_url)}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Apple / Outlook
                        </Button>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('calendar.subscribe.myCalendar')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('calendar.subscribe.myCalendarHint')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(data.personal.webcal_url || data.personal.ics_url)}>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {t('calendar.subscribe.copyLink')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} disabled={resetting}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {t('calendar.subscribe.resetLink')}
                    </Button>
                  </div>
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

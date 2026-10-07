import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { applyToggle, toggleUpdate, type ColumnKey } from '../../lib/notificationMatrix';
import {
  getNotificationSettings,
  saveNotificationSettings,
  type NotificationSettings,
  type QuietHours,
} from '../../services/api/notificationCenter';
import { SettingsSection } from './SettingsSection';
import NotificationGrid from './NotificationGrid';
import QuietHoursRow from './QuietHoursRow';

/**
 * Which notifications reach this person, and on which channels (GET/PUT /me/notification-settings).
 * Works whether the notification center is switched on or not: switches set now apply once it is.
 * Each flip moves at once and is sent on its own; a refused save puts the switch back.
 */
export default function NotificationsSection() {
  const t = useT();
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef<NotificationSettings | null>(null);
  latest.current = settings;

  const load = useCallback(() => {
    setFailed(false);
    getNotificationSettings()
      .then(setSettings)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const save = async (optimistic: NotificationSettings, request: Parameters<typeof saveNotificationSettings>[0]) => {
    const before = latest.current;
    setSettings(optimistic);
    try {
      setSettings(await saveNotificationSettings(request));
    } catch {
      setSettings(before);
      toast.error(t('settings.notifications.saveFailed'));
    }
  };

  const onToggle = (eventKey: string, column: ColumnKey, on: boolean) => {
    if (!settings) return;
    const event = settings.events.find((e) => e.key === eventKey);
    if (!event) return;
    void save(applyToggle(settings, eventKey, column, on), toggleUpdate(event, column, on));
  };

  const onQuiet = (quiet: QuietHours) => {
    if (!settings) return;
    void save({ ...settings, quiet_hours: quiet }, { quiet_hours: quiet });
  };

  return (
    <SettingsSection id="notifications" title={t('settings.notifications.title')} description={t('settings.notifications.description')}>
      {settings ? (
        <>
          <NotificationGrid settings={settings} onToggle={onToggle} />
          <QuietHoursRow value={settings.quiet_hours} onSave={onQuiet} />
          <p className="border-t border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground sm:px-5">{t('settings.notifications.reachHint')}</p>
        </>
      ) : failed ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <p className="text-sm text-foreground">{t('settings.notifications.loadFailed')}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            {t('common.retry')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground sm:px-5">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('common.loading')}
        </div>
      )}
    </SettingsSection>
  );
}

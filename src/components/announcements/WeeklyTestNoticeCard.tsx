import { useEffect, useState } from 'react';
import { CalendarCheck2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { toast } from '../Toast';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from './shared';
import { getGroupBotSettings, setWeeklyTestNotice, type GroupBotSettings } from '../../services/api/announcements';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/announcements';

/**
 * Saturday's weekly-test notice (owner, 2026-10-01): at 11:00 Almaty the bot tells every linked SAT,
 * IELTS and NUET chat that this week's test is open. Only an admin flips it; people who may not read
 * the bot's settings never see the card.
 */
export function WeeklyTestNoticeCard() {
  const { user } = useAuth();
  const t = useT();
  const [settings, setSettings] = useState<GroupBotSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGroupBotSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  // An older backend has no weekly-test fields: say nothing rather than a misleading «off».
  if (!settings || typeof settings.weekly_test_flag !== 'boolean') return null;
  const on = settings.weekly_test_enabled && settings.weekly_test_flag;

  async function flip() {
    if (!settings) return;
    setSaving(true);
    try {
      setSettings(await setWeeklyTestNotice(!settings.weekly_test_enabled));
    } catch (error) {
      toast(errorMessage(error, t('announcements.weeklyNotice.saveFailed')), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CalendarCheck2 className="mt-0.5 h-5 w-5 flex-none text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {on ? t('announcements.weeklyNotice.titleOn') : t('announcements.weeklyNotice.titleOff')}
            </p>
            <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">
              {t('announcements.weeklyNotice.description')}
              {!settings.weekly_test_flag && ` ${t('announcements.weeklyNotice.jobOff')}`}
            </p>
          </div>
        </div>
        {user?.role === 'admin' && (
          <Button variant="outline" size="sm" onClick={flip} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
            {settings.weekly_test_enabled ? t('announcements.weeklyNotice.switchOff') : t('announcements.weeklyNotice.switchOn')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

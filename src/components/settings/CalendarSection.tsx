import { lazy, Suspense, useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import { SettingsRow, SettingsSection } from './SettingsSection';

// The calendar page's own «Subscribe» dialog (group calendars + the personal feed), loaded on demand.
const SubscribeDialog = lazy(() => import('../calendar/SubscribeDialog'));

export default function CalendarSection() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <SettingsSection id="calendar" title={t('settings.calendar.title')}>
      <SettingsRow label={t('settings.calendar.row')} description={t('settings.calendar.description')}>
        <Button type="button" variant="outline" className="gap-2" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-4 w-4" aria-hidden />
          {t('settings.calendar.open')}
        </Button>
      </SettingsRow>
      {open && (
        <Suspense fallback={null}>
          <SubscribeDialog open={open} onOpenChange={setOpen} />
        </Suspense>
      )}
    </SettingsSection>
  );
}

import { useLocation, useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { Button } from '../ui/button';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import type { TourKind } from '../../lib/guide/state';
import { replayLabel } from '../guide/tours';
import { requestTourReplay } from '../guide/tourStore';
import { SettingsRow, SettingsSection } from './SettingsSection';

/** «Replay tour», the same as the menu under the name; the page leaves it out for roles without one. */
export default function HelpSection({ kind }: { kind: TourKind }) {
  const t = useT();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <SettingsSection id="help" title={t('settings.help.title')}>
      <SettingsRow label={t('settings.tour.title')} description={t('settings.tour.description')}>
        <Button type="button" variant="outline" className="gap-2" onClick={() => requestTourReplay(navigate, pathname)}>
          <Play className="h-4 w-4" aria-hidden />
          {replayLabel(kind)}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}

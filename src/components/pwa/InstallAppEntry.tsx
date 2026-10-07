import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { SOLID, SettingsRow } from '../settings/SettingsSection';
import { useInstallFlow } from './useInstallFlow';

/**
 * «Install the app», as a Settings row: always findable there, unlike the paced dashboard card.
 * The page leaves the whole section out inside the installed app (services/pwaInstall isInstalled).
 */
export default function InstallAppEntry() {
  const { snapshot, t, start, sheet, oneTap } = useInstallFlow('settings');
  const unsupported = snapshot.platform.platform === 'unsupported';

  return (
    <SettingsRow
      label={
        <span className="inline-flex items-center gap-3">
          <img src="/icons/icon-96.png" alt="" width={40} height={40} className="h-10 w-10 flex-none rounded-xl ring-1 ring-border" />
          {t.appName}
        </span>
      }
      description={unsupported ? t.entryUnsupported : t.entryDescription}
    >
      {!unsupported && (
        <>
          <Button type="button" onClick={start} className={`gap-2 ${SOLID}`}>
            <Download className="h-4 w-4" aria-hidden />
            {oneTap ? t.installApp : t.showMeHow}
          </Button>
          {sheet}
        </>
      )}
    </SettingsRow>
  );
}

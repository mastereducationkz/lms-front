import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { isInstalled } from '../../services/pwaInstall';
import { useInstallFlow } from './useInstallFlow';

const SOLID = 'bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover';

/**
 * «Install the app» for the Settings page: always findable there, unlike the paced dashboard
 * card. Hidden inside the installed app and once the person said it's installed.
 */
export default function InstallAppEntry() {
  const { snapshot, t, start, sheet, oneTap } = useInstallFlow('settings');
  if (isInstalled(snapshot)) return null;
  const unsupported = snapshot.platform.platform === 'unsupported';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.entryTitle}</CardTitle>
        <CardDescription>{unsupported ? t.entryUnsupported : t.entryDescription}</CardDescription>
      </CardHeader>
      {!unsupported && (
        <CardContent className="flex flex-wrap items-center gap-4">
          <img src="/icons/icon-96.png" alt="" width={48} height={48} className="h-12 w-12 flex-none rounded-xl ring-1 ring-border" />
          <Button type="button" onClick={start} className={`gap-2 ${SOLID}`}>
            <Download className="h-4 w-4" aria-hidden />
            {oneTap ? t.installApp : t.showMeHow}
          </Button>
          {sheet}
        </CardContent>
      )}
    </Card>
  );
}

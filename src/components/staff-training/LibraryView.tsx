import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale, useT } from '@/lib/i18n/react';
import { getTrainingLibrary } from '@/services/api/staffTraining';
import { LoadError, Loading } from './PageShell';
import TrackSteps from './TrackSteps';
import { errorText, pick } from './model';
import { useLoad } from './useLoad';
import '@/lib/i18n/catalogs/staffTraining';

/** Every active track and its steps. Any staff member may watch any clip; the track picker starts on the viewer's own role. */
export default function LibraryView() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const { data: tracks, error, reload } = useLoad(getTrainingLibrary, 'library');
  const [picked, setPicked] = useState<string | null>(null);

  const current = useMemo(() => {
    if (!tracks?.length) return null;
    const wanted = picked ?? (tracks.find((track) => track.role === user?.role) ?? tracks[0]).id.toString();
    return tracks.find((track) => String(track.id) === wanted) ?? tracks[0];
  }, [tracks, picked, user?.role]);

  if (error) return <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} />;
  if (!tracks) return <Loading />;
  if (!current) return <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.library.empty')}</p>;

  return (
    <div className="space-y-4">
      {tracks.length > 1 && (
        <div className="max-w-sm space-y-1">
          <Label htmlFor="st-library-track" className="block text-xs">{t('staffTraining.library.track')}</Label>
          <NativeSelect id="st-library-track" className="flex w-full" value={String(current.id)} onValueChange={setPicked}>
            {tracks.map((track) => <option key={track.id} value={String(track.id)}>{pick(track.title, locale)}</option>)}
          </NativeSelect>
        </div>
      )}
      <TrackSteps items={current.items} locale={locale} showRequired={false} />
    </div>
  );
}

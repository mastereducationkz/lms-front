import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { toast } from '@/components/Toast';
import { useLocale, useT } from '@/lib/i18n/react';
import { assignTraining, getTrainingLibrary, type ClipSummary } from '@/services/api/staffTraining';
import Segmented from './Segmented';
import { errorText, pick } from './model';
import { useLoad } from './useLoad';
import '@/lib/i18n/catalogs/staffTraining';

type Mode = 'clips' | 'track';

/**
 * Assigns videos (or a whole track) to the people picked on the progress page. The date is a hint on their page,
 * nothing more: no assignment ever locks anyone out of real work (decision D10).
 */
export default function AssignDialog({ onClose, people, onAssigned }: {
  /** The caller mounts the dialog only while it is open, so the library is fetched when it is needed. */
  onClose: () => void;
  people: { id: number; name: string }[];
  onAssigned: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { data: library } = useLoad(getTrainingLibrary, 'library');
  const [mode, setMode] = useState<Mode>('clips');
  const [trackId, setTrackId] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [required, setRequired] = useState(true);
  const [dueAt, setDueAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const seen = new Set<number>();
    const needle = query.trim().toLowerCase();
    return (library ?? []).map((track) => ({
      id: track.id,
      title: pick(track.title, locale),
      clips: track.items.flatMap((item): ClipSummary[] => {
        const clip = item.kind === 'clip' ? item.clip : undefined;
        if (!clip || seen.has(clip.id)) return [];
        if (needle && !pick(clip.title, locale).toLowerCase().includes(needle)) return [];
        seen.add(clip.id);
        return [clip];
      }),
    })).filter((group) => group.clips.length > 0);
  }, [library, locale, query]);

  const effectiveTrack = trackId || String(library?.[0]?.id ?? '');
  const toggle = (id: number) => setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));

  const submit = async () => {
    setError(null);
    if (mode === 'clips' ? picked.length === 0 : !effectiveTrack) {
      setError(t('staffTraining.assign.nothingPicked'));
      return;
    }
    setBusy(true);
    try {
      const result = await assignTraining({
        user_ids: people.map((p) => p.id),
        track_id: mode === 'track' ? Number(effectiveTrack) : null,
        clip_ids: mode === 'clips' ? picked : null,
        required,
        due_at: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null,
      });
      toast(t('staffTraining.assign.result', { created: result.created, skipped: result.skipped_existing }), 'success');
      setPicked([]);
      onClose();
      onAssigned();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="@container max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('staffTraining.assign.title')}</DialogTitle>
          <DialogDescription>{t('staffTraining.assign.to', { names: people.map((p) => p.name).join(', ') })}</DialogDescription>
        </DialogHeader>

        <Segmented<Mode>
          label={t('staffTraining.assign.title')}
          value={mode}
          onChange={setMode}
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'clips', label: t('staffTraining.assign.mode.clips') },
            { value: 'track', label: t('staffTraining.assign.mode.track') },
          ]}
        />

        {mode === 'track' ? (
          <div className="space-y-1">
            <Label htmlFor="st-assign-track" className="block text-xs">{t('staffTraining.assign.track')}</Label>
            <NativeSelect id="st-assign-track" className="flex w-full" value={effectiveTrack} onValueChange={setTrackId}>
              {(library ?? []).map((track) => <option key={track.id} value={String(track.id)}>{pick(track.title, locale)}</option>)}
            </NativeSelect>
          </div>
        ) : (
          <div className="space-y-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('staffTraining.assign.search')} aria-label={t('staffTraining.assign.search')} />
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-2">
              {!library && <Loader2 className="m-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
              {library && groups.length === 0 && <p className="p-2 text-sm text-muted-foreground">{t('staffTraining.assign.none')}</p>}
              {groups.map((group) => (
                <fieldset key={group.id}>
                  <legend className="px-2 pb-1 text-xs font-semibold text-muted-foreground">{group.title}</legend>
                  {group.clips.map((clip) => (
                    <label key={clip.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]" checked={picked.includes(clip.id)} onChange={() => toggle(clip.id)} data-clip={clip.id} />
                      <span className="min-w-0">{pick(clip.title, locale)}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('staffTraining.assign.picked', { count: picked.length })}</p>
          </div>
        )}

        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          {t('staffTraining.assign.required')}
        </label>
        <div className="space-y-1">
          <Label htmlFor="st-assign-due" className="block text-xs">{t('staffTraining.assign.dueAt')}</Label>
          <Input id="st-assign-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="max-w-48" />
          <p className="text-xs text-muted-foreground">{t('staffTraining.assign.dueHint')}</p>
        </div>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {t('staffTraining.assign.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

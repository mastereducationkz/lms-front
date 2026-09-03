import { useEffect, useState, type FormEvent } from 'react';
import { Pencil, Target, X } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import {
  band,
  getMyTargets,
  score,
  setMyTarget,
  trendArrow,
  type IeltsModule,
  type TargetsPayload,
  type TargetTrack,
} from '../../services/api/targets';

/**
 * Student home: target vs current level per exam track.
 * IELTS "now" = the latest scored band per module within the last four weekly sets ("—" when
 * none), the second line the all-time best; the overall is the IELTS rounding of the four latest
 * bands and only appears when all four exist. SAT "now" = the latest completed weekly-set scaled
 * scores. Hides itself when the feature is off (503), when the student has no track, or on error.
 */

const MODULES: IeltsModule[] = ['listening', 'reading', 'writing', 'speaking'];
const SHORT: Record<IeltsModule, string> = { listening: 'L', reading: 'R', writing: 'W', speaking: 'S' };
const LABEL: Record<IeltsModule, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' };

const sourceLabel = (source: string | undefined): string =>
  source === 'staff' ? 'set by your curator' : source === 'assignment_zero' ? 'from Assignment Zero' : '';

function NumberField({ label, value, onChange, step, min, max }: {
  label: string; value: string; onChange: (v: string) => void; step: number; min: number; max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 rounded-md border border-border bg-background px-2 py-1 text-right"
      />
    </label>
  );
}

function IeltsBlock({ data, onSaved }: { data: TargetsPayload; onSaved: (next: TargetsPayload) => void }) {
  const record = data.targets.ielts;
  const targets = record?.targets ?? {};
  const progress = data.progress.ielts;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const startEdit = () => {
    setForm({
      overall: targets.overall != null ? String(targets.overall) : '',
      ...Object.fromEntries(MODULES.map((m) => [m, targets[m] != null ? String(targets[m]) : ''])),
    });
    setError(null);
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, number> = {};
    for (const [key, raw] of Object.entries(form)) {
      if (raw.trim() === '') continue;
      payload[key] = Number(raw.replace(',', '.'));
    }
    if (!('overall' in payload)) {
      setError('Set at least the overall band.');
      return;
    }
    setSaving(true);
    try {
      await setMyTarget('ielts', payload);
      onSaved(await getMyTargets());
      setEditing(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save the target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">IELTS</p>
          <p className="text-lg font-semibold">
            {progress?.start?.overall != null && (
              <span className="text-muted-foreground font-normal" title="Diagnostic entry band">start {band(progress.start.overall)} → </span>
            )}
            Target {band(targets.overall)} <span className="text-muted-foreground font-normal">·</span> now{' '}
            <span className={progress?.reached ? 'text-emerald-600 dark:text-emerald-400' : ''}>{band(progress?.overall_now)}</span>
            {progress?.overall_best != null && <span className="ml-2 text-xs font-normal text-muted-foreground">best {band(progress.overall_best)}</span>}
          </p>
          {progress && progress.overall_now == null && progress.overall_missing.length > 0 && progress.overall_missing.length < 4 && (
            <p className="text-xs text-muted-foreground">Overall needs {progress.overall_missing.map((m) => LABEL[m]).join(', ')}</p>
          )}
          {record && sourceLabel(record.source) && <p className="text-[11px] text-muted-foreground">{sourceLabel(record.source)}</p>}
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} aria-label="Edit IELTS target">
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {progress && (
        <ul className="grid grid-cols-4 gap-2">
          {MODULES.map((m) => {
            const mod = progress.modules[m];
            return (
              <li key={m} className="rounded-lg border border-border p-2 text-center" title={`${LABEL[m]}: now ${band(mod.now)}, best ${band(mod.best)}`}>
                <p className="text-[11px] text-muted-foreground">{SHORT[m]}{targets[m] != null ? ` → ${band(targets[m])}` : ''}</p>
                <p className="text-base font-semibold tabular-nums">
                  {band(mod.now)}
                  {mod.trend != null && mod.trend !== 0 && (
                    <span className={'ml-0.5 text-xs ' + (mod.trend > 0 ? 'text-emerald-600' : 'text-red-500')}>{trendArrow(mod.trend)}</span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">best {band(mod.best)}</p>
                {m !== 'speaking' && progress.start?.[m] && (
                  <p className="text-[11px] text-muted-foreground" title="Diagnostic entry band">
                    start {progress.start[m]?.band != null ? band(progress.start[m]?.band) : 'taken'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {editing && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border border-border p-3">
          <NumberField label="Overall band" value={form.overall ?? ''} onChange={(v) => setForm((f) => ({ ...f, overall: v }))} step={0.5} min={4} max={9} />
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">Per part (optional)</summary>
            <div className="mt-2 space-y-2">
              {MODULES.map((m) => (
                <NumberField key={m} label={LABEL[m]} value={form[m] ?? ''} onChange={(v) => setForm((f) => ({ ...f, [m]: v }))} step={0.5} min={4} max={9} />
              ))}
            </div>
          </details>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-4 w-4" aria-hidden="true" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save target'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ScoreBlock({ track, data, onSaved }: { track: 'sat' | 'nuet'; data: TargetsPayload; onSaved: (next: TargetsPayload) => void }) {
  const record = data.targets[track];
  const targets = record?.targets ?? {};
  const current = track === 'sat' ? data.progress.sat?.current ?? null : null;
  const reached = track === 'sat' ? !!data.progress.sat?.reached : false;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const fields = track === 'sat'
    ? [{ key: 'total', label: 'Total', min: 400, max: 1600 }, { key: 'math', label: 'Math', min: 200, max: 800 }, { key: 'verbal', label: 'Verbal', min: 200, max: 800 }]
    : [{ key: 'total', label: 'Total', min: 0, max: 120 }];

  const startEdit = () => {
    setForm(Object.fromEntries(fields.map((f) => [f.key, targets[f.key] != null ? String(targets[f.key]) : ''])));
    setError(null);
    setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, number> = {};
    for (const [key, raw] of Object.entries(form)) if (raw.trim() !== '') payload[key] = Number(raw);
    if (!('total' in payload)) {
      setError('Set at least the total.');
      return;
    }
    setSaving(true);
    try {
      await setMyTarget(track, payload);
      onSaved(await getMyTargets());
      setEditing(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Could not save the target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{track.toUpperCase()}</p>
          <p className="text-lg font-semibold">
            Target {score(targets.total)}
            {track === 'sat' && (
              <>
                <span className="text-muted-foreground font-normal"> · </span>now{' '}
                <span className={reached ? 'text-emerald-600 dark:text-emerald-400' : ''}>{score(current?.total)}</span>
              </>
            )}
          </p>
          {track === 'sat' && current && (
            <p className="text-xs text-muted-foreground">
              Math {score(current.math)}{targets.math != null ? ` → ${targets.math}` : ''} · Verbal {score(current.verbal)}{targets.verbal != null ? ` → ${targets.verbal}` : ''}
              {current.set_name ? ` · ${current.set_name}` : ''}
            </p>
          )}
          {track === 'sat' && !current && <p className="text-xs text-muted-foreground">No completed weekly set yet</p>}
          {record && sourceLabel(record.source) && <p className="text-[11px] text-muted-foreground">{sourceLabel(record.source)}</p>}
        </div>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={startEdit} aria-label={`Edit ${track.toUpperCase()} target`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
      {editing && (
        <form onSubmit={submit} className="space-y-2 rounded-lg border border-border p-3">
          {fields.map((f) => (
            <NumberField key={f.key} label={f.label} value={form[f.key] ?? ''} onChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))} step={track === 'sat' ? 10 : 1} min={f.min} max={f.max} />
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-4 w-4" aria-hidden="true" /> Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save target'}</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function TargetsTile() {
  const [data, setData] = useState<TargetsPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyTargets()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.tracks.length === 0) return null;
  const tracks = (['ielts', 'sat', 'nuet'] as TargetTrack[]).filter((t) => data.tracks.includes(t));

  return (
    <Card className="mt-2">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Target className="h-4 w-4" aria-hidden="true" /> Your targets
        </div>
        {tracks.map((t) =>
          t === 'ielts' ? <IeltsBlock key={t} data={data} onSaved={setData} /> : <ScoreBlock key={t} track={t} data={data} onSaved={setData} />,
        )}
      </CardContent>
    </Card>
  );
}

export default TargetsTile;

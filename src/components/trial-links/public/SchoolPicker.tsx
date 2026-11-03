import { useEffect, useState } from 'react';
import { Check, Loader2, MapPin, Presentation, Search } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import type { TFunction } from '../../../lib/i18n/translate';
import { searchTrialSchools, type SchoolRef } from '../../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

export type SchoolChoice =
  | { kind: 'none' }
  | { kind: 'picked'; school: SchoolRef }
  | { kind: 'new'; name: string; city: string };

const SEARCH_DELAY_MS = 250;

export const schoolLabel = (s: SchoolRef) => (s.city ? `${s.name}, ${s.city}` : s.name);

interface Props {
  t: TFunction;
  code: string;
  running: SchoolRef[];
  value: SchoolChoice;
  onChange: (next: SchoolChoice) => void;
}

/**
 * The school, in as few taps as possible: the school of a presentation running right now is one tap; otherwise a search
 * over the confirmed schools; a school that is not there is typed (name + city) and waits for staff to confirm it.
 */
export default function SchoolPicker({ t, code, running, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SchoolRef[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (value.kind !== 'none') return undefined;
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setSearched(false);
      return undefined;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchTrialSchools(code, q)
        .then((r) => { if (!cancelled) { setResults(r.schools); setSearched(true); } })
        .catch(() => { if (!cancelled) { setResults([]); setSearched(true); } })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, SEARCH_DELAY_MS);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [code, query, value.kind]);

  if (value.kind === 'picked') {
    return (
      <div className="space-y-1.5">
        <Label>{t('trialLinks.form.school')}</Label>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{schoolLabel(value.school)}</span>
          </span>
          <button type="button" onClick={() => onChange({ kind: 'none' })}
            className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline">
            {t('trialLinks.form.schoolChange')}
          </button>
        </div>
      </div>
    );
  }

  if (value.kind === 'new') {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="tl-school-name">{t('trialLinks.form.schoolName')}</Label>
          <Input id="tl-school-name" value={value.name} maxLength={160} autoFocus
            onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tl-school-city">{t('trialLinks.form.schoolCity')}</Label>
          <Input id="tl-school-city" value={value.city} maxLength={80} autoComplete="address-level2"
            onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </div>
        <button type="button" onClick={() => onChange({ kind: 'none' })}
          className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          {t('trialLinks.form.schoolBack')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="tl-school-search">{t('trialLinks.form.school')}</Label>
      {running.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{t('trialLinks.form.schoolNow')}</p>
          <div className="grid gap-2">
            {running.map((s) => (
              <button key={s.id} type="button" onClick={() => onChange({ kind: 'picked', school: s })}
                className="flex items-center gap-2.5 rounded-xl border-2 border-primary/50 bg-primary/5 px-3.5 py-3 text-left text-sm font-semibold text-foreground transition hover:border-primary hover:bg-primary/10">
                <Presentation className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                {schoolLabel(s)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="tl-school-search" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9"
          placeholder={t('trialLinks.form.schoolSearch')} autoComplete="off" />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => onChange({ kind: 'picked', school: s })}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-muted">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{s.name}</span>
                {s.city && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" aria-hidden />{s.city}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && !searching && results.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('trialLinks.form.schoolNoResults')}</p>
      )}
      <button type="button" onClick={() => onChange({ kind: 'new', name: query.trim(), city: '' })}
        className="text-xs font-medium text-primary underline-offset-4 hover:underline">
        {t('trialLinks.form.schoolNotListed')}
      </button>
    </div>
  );
}

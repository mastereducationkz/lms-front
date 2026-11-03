import { useMemo, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import { getTrainingProgress, type ProgressFilters, type TrainingState } from '@/services/api/staffTraining';
import { BackLink, LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import AssignDialog from '@/components/staff-training/AssignDialog';
import ProgressList from '@/components/staff-training/ProgressList';
import StateChip from '@/components/staff-training/StateChip';
import { ROLES_BY_VIEWER, STATES, errorText } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import '@/lib/i18n/catalogs/staffTraining';

type RequiredFilter = '' | 'yes' | 'no';
const ROLE_KEY = {
  admin: 'staffTraining.role.admin', teacher: 'staffTraining.role.teacher', head_teacher: 'staffTraining.role.head_teacher',
  curator: 'staffTraining.role.curator', head_curator: 'staffTraining.role.head_curator', marketing: 'staffTraining.role.marketing',
} as const;

/** /training/progress: done / stuck on which step / last active, for admins and the heads of curators and teachers. */
export default function ProgressPage() {
  const t = useT();
  const { user } = useAuth();
  const [role, setRole] = useState('');
  const [state, setState] = useState<'' | TrainingState>('');
  const [required, setRequired] = useState<RequiredFilter>('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const roles = (user && ROLES_BY_VIEWER[user.role]) || [];

  const filters: ProgressFilters = { role: role || undefined, state: state || undefined, required: required === '' ? undefined : required === 'yes' };
  const { data, error, reload } = useLoad(() => getTrainingProgress(filters), JSON.stringify(filters), { keepPrevious: true });
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const picked = rows.filter((r) => selected.has(r.user.id));

  const toggle = (id: number) => setSelected((now) => { const next = new Set(now); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((now) => (rows.every((r) => now.has(r.user.id)) ? new Set() : new Set(rows.map((r) => r.user.id))));

  return (
    <PageShell>
      <BackLink to="/training">{t('staffTraining.backToTrack')}</BackLink>
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-5 w-5" aria-hidden /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('staffTraining.progress.title')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('staffTraining.progress.subtitle')}</p>
        </div>
      </header>

      {data && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('staffTraining.progress.filter.state')}>
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              data-count={s}
              aria-pressed={state === s}
              onClick={() => setState((now) => (now === s ? '' : s))}
              className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors', state === s ? 'border-primary bg-brand-subtle/50' : 'border-border bg-card hover:bg-muted/50')}
            >
              <StateChip state={s} />
              <span className="font-semibold tabular-nums text-foreground">{data.counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {roles.length > 1 && (
          <div className="w-full space-y-1 @md:w-64">
            <Label htmlFor="st-filter-role" className="block text-xs">{t('staffTraining.progress.filter.role')}</Label>
            <NativeSelect id="st-filter-role" className="flex w-full" value={role} onValueChange={setRole}>
              <option value="">{t('staffTraining.progress.filter.allRoles')}</option>
              {roles.map((r) => <option key={r} value={r}>{r in ROLE_KEY ? t(ROLE_KEY[r as keyof typeof ROLE_KEY]) : r}</option>)}
            </NativeSelect>
          </div>
        )}
        <div className="w-full space-y-1 @md:w-64">
          <Label htmlFor="st-filter-required" className="block text-xs">{t('staffTraining.progress.filter.required')}</Label>
          <NativeSelect id="st-filter-required" className="flex w-full" value={required} onValueChange={(v) => setRequired(v as RequiredFilter)}>
            <option value="">{t('staffTraining.progress.filter.anyRequired')}</option>
            <option value="yes">{t('staffTraining.progress.filter.requiredOnly')}</option>
            <option value="no">{t('staffTraining.progress.filter.optionalOnly')}</option>
          </NativeSelect>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {picked.length > 0 && <span className="text-sm text-muted-foreground">{t('staffTraining.progress.selected', { count: picked.length })}</span>}
          <Button onClick={() => setAssigning(true)} disabled={picked.length === 0}>
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            {t('staffTraining.progress.assign')}
          </Button>
        </div>
      </div>

      {error ? <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} /> : !data ? <Loading /> : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.progress.empty')}</p>
      ) : (
        <ProgressList rows={rows} selected={selected} onToggle={toggle} onToggleAll={toggleAll} />
      )}

      {assigning && (
        <AssignDialog
          people={picked.map((r) => ({ id: r.user.id, name: r.user.name }))}
          onClose={() => setAssigning(false)}
          onAssigned={() => { setSelected(new Set()); reload(); }}
        />
      )}
    </PageShell>
  );
}

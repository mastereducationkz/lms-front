import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenCheck, Info, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale, useT } from '@/lib/i18n/react';
import { formatDate } from '@/lib/i18n/format';
import { getTrainingMe } from '@/services/api/staffTraining';
import { LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import StateChip from '@/components/staff-training/StateChip';
import TrackSteps, { StepCard } from '@/components/staff-training/TrackSteps';
import LibraryView from '@/components/staff-training/LibraryView';
import { PROGRESS_ROLES, currentItem, errorText, itemId, itemPath, pick, statusOf } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import '@/lib/i18n/catalogs/staffTraining';

/** /training: the person's own track (or, with none, the library), what was assigned to them, and the way to the other pages. */
export default function TrainingHomePage() {
  const t = useT();
  const locale = useLocale();
  const { user } = useAuth();
  const { data: me, error, reload } = useLoad(getTrainingMe, 'me');
  const canSeeProgress = !!user && (PROGRESS_ROLES as readonly string[]).includes(user.role);

  const track = me?.track ?? null;
  const next = track ? currentItem(track.items) : null;
  const enrollment = track ? me?.enrollments.find((e) => e.kind === 'track' && e.track_id === track.id) : undefined;
  const pct = track && track.total_items > 0 ? Math.round((track.done_items / track.total_items) * 100) : 0;

  return (
    <PageShell>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BookOpenCheck className="h-5 w-5" aria-hidden /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('staffTraining.title')}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('staffTraining.subtitle')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-2">
          {track && <Button asChild variant="outline" size="sm"><Link to="/training/library">{t('staffTraining.nav.library')}</Link></Button>}
          {canSeeProgress && (
            <Button asChild variant="outline" size="sm">
              <Link to="/training/progress"><Users className="mr-2 h-4 w-4" aria-hidden />{t('staffTraining.nav.progress')}</Link>
            </Button>
          )}
        </nav>
      </header>

      {error ? (
        // The server answers 404 `staff_training_off` while the feature is switched off.
        statusOf(error) === 404
          ? <p role="status" className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.off')}</p>
          : <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} />
      ) : !me ? <Loading /> : (
        <>
          <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground" data-not-blocking>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('staffTraining.notBlocking')}
          </p>

          {track ? (
            <section className="space-y-4" aria-labelledby="st-track">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm @lg:p-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2 id="st-track" className="text-lg font-semibold text-foreground">{pick(track.title, locale)}</h2>
                  <StateChip state={track.state} />
                  {enrollment && <span className="text-xs text-muted-foreground">{t(enrollment.required ? 'staffTraining.required' : 'staffTraining.optional')}</span>}
                  {enrollment?.due_at && <span className="text-xs text-muted-foreground">{t('staffTraining.dueBy', { date: formatDate(enrollment.due_at, undefined, locale) })}</span>}
                </div>
                <div className="mt-4 flex flex-col gap-4 @lg:flex-row @lg:items-center">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm text-foreground">{t('staffTraining.track.progress', { done: track.done_items, total: track.total_items })}</p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-brand-solid transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {next && (
                    <Button asChild size="lg" className="shrink-0">
                      <Link to={itemPath(next.kind, itemId(next))}>
                        {t(track.done_items === 0 ? 'staffTraining.track.start' : 'staffTraining.track.continue')}
                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  )}
                </div>
                {track.completed_at && (
                  <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">
                    {t('staffTraining.track.finished')} {t('staffTraining.track.finishedOn', { date: formatDate(track.completed_at, undefined, locale) })}
                  </p>
                )}
              </div>
              {track.items.length === 0
                ? <p className="text-sm text-muted-foreground">{t('staffTraining.track.empty')}</p>
                : <TrackSteps items={track.items} locale={locale} currentId={next ? { kind: next.kind, id: itemId(next) } : null} />}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">{t('staffTraining.track.none')}</p>
          )}

          {me.assigned_clips.length > 0 && (
            <section className="space-y-3" aria-labelledby="st-assigned">
              <div>
                <h2 id="st-assigned" className="text-lg font-semibold text-foreground">{t('staffTraining.assigned.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('staffTraining.assigned.hint')}</p>
              </div>
              <ol className="space-y-2.5">
                {me.assigned_clips.map((assigned, i) => (
                  <StepCard key={assigned.clip.id} item={{ position: i + 1, kind: 'clip', required: assigned.required ?? false, done: assigned.done, clip: assigned.clip }} locale={locale} showRequired={false} />
                ))}
              </ol>
            </section>
          )}

          {!track && (
            <section className="space-y-3" aria-labelledby="st-library">
              <h2 id="st-library" className="text-lg font-semibold text-foreground">{t('staffTraining.library.title')}</h2>
              <LibraryView />
            </section>
          )}
        </>
      )}
    </PageShell>
  );
}

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/Toast';
import { useLocale, useT } from '@/lib/i18n/react';
import { formatDate, formatDateTime } from '@/lib/i18n/format';
import { cancelAssignment, getTrainingProgressOf } from '@/services/api/staffTraining';
import { BackLink, LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import AssignDialog from '@/components/staff-training/AssignDialog';
import StateChip from '@/components/staff-training/StateChip';
import TrackSteps, { StepCard } from '@/components/staff-training/TrackSteps';
import { errorText, pick } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import '@/lib/i18n/catalogs/staffTraining';

/** /training/progress/:userId (also where the CRM's HR card links): one person's track, step by step. */
export default function ProgressDetailPage() {
  const userId = Number(useParams().userId);
  const t = useT();
  const locale = useLocale();
  const { data, error, reload } = useLoad(() => getTrainingProgressOf(userId), userId);
  const [assigning, setAssigning] = useState(false);

  const person = data?.user ?? null;
  const track = data?.track ?? null;

  const cancel = async (enrollmentId: number) => {
    try {
      await cancelAssignment(enrollmentId);
      toast(t('staffTraining.detail.cancelled'), 'success');
      reload();
    } catch (e) {
      toast(errorText(e, t), 'error');
    }
  };

  return (
    <PageShell>
      <BackLink to="/training/progress">{t('staffTraining.detail.back')}</BackLink>
      {error ? <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} /> : !data ? <Loading /> : (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{person?.name ?? ''}</h1>
              {person && <p className="text-sm text-muted-foreground">{person.email} · {t('staffTraining.progress.joined', { date: formatDate(person.created_at, undefined, locale) })}</p>}
              {data.person.last_active_at && <p className="text-xs text-muted-foreground">{t('staffTraining.progress.col.active')}: {formatDateTime(data.person.last_active_at, undefined, locale)}</p>}
            </div>
            <div className="flex items-center gap-3">
              {track && <StateChip state={track.state} />}
              <Button variant="outline" size="sm" onClick={() => setAssigning(true)}>
                <UserPlus className="mr-2 h-4 w-4" aria-hidden />{t('staffTraining.detail.assignClips')}
              </Button>
            </div>
          </header>

          <section className="space-y-3" aria-labelledby="st-detail-track">
            <h2 id="st-detail-track" className="text-lg font-semibold text-foreground">
              {track ? pick(track.title, locale) : t('staffTraining.detail.track')}
              {track && <span className="ml-3 text-sm font-normal text-muted-foreground">{t('staffTraining.track.progress', { done: track.done_items, total: track.total_items })}</span>}
            </h2>
            {track ? <TrackSteps items={track.items} locale={locale} readOnly /> : <p className="text-sm text-muted-foreground">{t('staffTraining.detail.noTrack')}</p>}
          </section>

          <section className="space-y-3" aria-labelledby="st-detail-assigned">
            <h2 id="st-detail-assigned" className="text-lg font-semibold text-foreground">{t('staffTraining.detail.assigned')}</h2>
            {data.assigned_clips.length === 0 ? <p className="text-sm text-muted-foreground">{t('staffTraining.detail.noAssigned')}</p> : (
              <ol className="space-y-2.5">
                {data.assigned_clips.map((assigned, i) => (
                  <StepCard
                    key={assigned.clip.id}
                    item={{ position: i + 1, kind: 'clip', required: assigned.required, done: assigned.done, clip: assigned.clip }}
                    locale={locale}
                    readOnly
                    action={(
                      <Button variant="ghost" size="icon" className="-my-1 shrink-0" title={t('staffTraining.detail.cancel')} aria-label={t('staffTraining.detail.cancel')} onClick={() => cancel(assigned.enrollment_id)}>
                        <X className="h-4 w-4" aria-hidden />
                      </Button>
                    )}
                  />
                ))}
              </ol>
            )}
          </section>
        </>
      )}
      {assigning && person && (
        <AssignDialog people={[{ id: person.id, name: person.name }]} onClose={() => setAssigning(false)} onAssigned={reload} />
      )}
    </PageShell>
  );
}

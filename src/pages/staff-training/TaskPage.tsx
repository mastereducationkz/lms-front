import { useParams, Link } from 'react-router-dom';
import { ArrowRight, ClipboardCheck, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/lib/i18n/react';
import { getTrainingLibrary, getTrainingMe, type TaskSummary, type TrackItem } from '@/services/api/staffTraining';
import { BackLink, LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import TaskCard from '@/components/staff-training/TaskCard';
import { errorText, itemId, itemPath, pick } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import { useState } from 'react';
import '@/lib/i18n/catalogs/staffTraining';

/** The task a person asked for, from their own track first, else the library (any staff may open any task). */
async function loadTask(taskId: number): Promise<{ task: TaskSummary | null; item: TrackItem | null; items: TrackItem[] }> {
  const me = await getTrainingMe();
  const own = me.track?.items ?? [];
  const mine = own.find((i) => i.kind === 'task' && i.task?.id === taskId);
  if (mine?.task) return { task: mine.task, item: mine, items: own };
  const library = await getTrainingLibrary();
  for (const track of library) {
    const found = track.items.find((i) => i.kind === 'task' && i.task?.id === taskId);
    if (found?.task) return { task: found.task, item: found, items: own };
  }
  return { task: null, item: null, items: own };
}

/** /training/tasks/:taskId: the instructions, the training copy and the check. */
export default function TaskPage() {
  const taskId = Number(useParams().taskId);
  const t = useT();
  const locale = useLocale();
  const { data, error, reload } = useLoad(() => loadTask(taskId), taskId);
  const [trackDone, setTrackDone] = useState(false);

  const task = data?.task ?? null;
  const own = data?.items ?? [];
  const here = own.findIndex((i) => i.kind === 'task' && i.task?.id === taskId);
  const after = here >= 0 ? own.slice(here + 1).find((i) => !i.done) ?? own.find((i, n) => n !== here && !i.done) : undefined;

  return (
    <PageShell>
      <BackLink to="/training">{t('staffTraining.backToTrack')}</BackLink>
      {error ? <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} /> : !data ? <Loading /> : !task ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('staffTraining.notFound')}</p>
      ) : (
        <>
          <header className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardCheck className="h-5 w-5" aria-hidden /></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{pick(task.title, locale)}</h1>
              <p className="text-xs text-muted-foreground">{t('staffTraining.step.task')} · {t(task.platform === 'crm' ? 'staffTraining.platform.crm' : 'staffTraining.platform.lms')}</p>
            </div>
          </header>
          <TaskCard
            task={task}
            locale={locale}
            done={!!data.item?.done}
            onChecked={(result) => {
              if (result.track_done) setTrackDone(true);
              reload();
            }}
          />
          {trackDone && (
            <p role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
              <PartyPopper className="h-5 w-5 shrink-0" aria-hidden />{t('staffTraining.task.trackDone')}
            </p>
          )}
          {after && !trackDone && (data.item?.done || false) && (
            <Button asChild>
              <Link to={itemPath(after.kind, itemId(after))}>{t('staffTraining.task.nextStep')}<ArrowRight className="ml-2 h-4 w-4" aria-hidden /></Link>
            </Button>
          )}
        </>
      )}
    </PageShell>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale, useT } from '@/lib/i18n/react';
import {
  answerQuestion, getTrainingClip, type AnswerResult, type BeatResult, type ClipDetail, type ClipQuestion,
} from '@/services/api/staffTraining';
import { BackLink, LoadError, Loading, PageShell } from '@/components/staff-training/PageShell';
import ClipPlayer, { type PlayerHandle } from '@/components/staff-training/ClipPlayer';
import QuestionsSection from '@/components/staff-training/QuestionsSection';
import { errorText, formatClock, itemPath, pick } from '@/components/staff-training/model';
import { useLoad } from '@/components/staff-training/useLoad';
import '@/lib/i18n/catalogs/staffTraining';

/** /training/clips/:clipId: the video, then its questions. */
export default function ClipPage() {
  const clipId = Number(useParams().clipId);
  const t = useT();
  const { data: clip, error, reload } = useLoad(() => getTrainingClip(clipId), clipId);

  return (
    <PageShell>
      <BackLink to="/training">{t('staffTraining.backToTrack')}</BackLink>
      {error ? <LoadError message={errorText(error, t, 'staffTraining.loadFailed')} onRetry={reload} /> : !clip ? <Loading /> : <ClipBody key={`${clip.id}-${clip.content_version}`} clip={clip} reload={reload} />}
    </PageShell>
  );
}

function ClipBody({ clip, reload }: { clip: ClipDetail; reload: () => void }) {
  const t = useT();
  const locale = useLocale();
  const player = useRef<PlayerHandle>(null);
  const [watched, setWatched] = useState(clip.progress.watched);
  const [pct, setPct] = useState(clip.progress.watch_pct);
  const [passedIds, setPassedIds] = useState<Set<number>>(() => new Set(clip.questions.filter((q) => q.passed).map((q) => q.id)));
  const [changed, setChanged] = useState(false);
  const total = clip.questions.length;
  const allPassed = total === 0 || clip.questions.every((q) => passedIds.has(q.id));
  const finished = watched && allPassed;

  const onBeat = useCallback((result: BeatResult) => {
    setPct(result.watch_pct);
    if (result.watched) setWatched(true);
  }, []);

  const onChanged = useCallback(() => setChanged(true), []);
  useEffect(() => {
    if (!changed) return;
    const id = window.setTimeout(reload, 1200);
    return () => window.clearTimeout(id);
  }, [changed, reload]);

  const onAnswer = async (question: ClipQuestion, chosen: string[]): Promise<AnswerResult> => {
    const result = await answerQuestion(question.id, chosen);
    if (result.correct) setPassedIds((now) => new Set(now).add(question.id));
    return result;
  };

  const next = clip.next_item;
  return (
    <>
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{pick(clip.title, locale)}</h1>
        {pick(clip.summary, locale) && <p className="max-w-3xl text-sm text-muted-foreground">{pick(clip.summary, locale)}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{formatClock(clip.duration_ms)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">{t(clip.platform === 'crm' ? 'staffTraining.platform.crm' : 'staffTraining.platform.lms')}</span>
        </p>
      </header>

      {changed && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/50 dark:text-amber-100">{t('staffTraining.clip.changed')}</p>}

      <ClipPlayer ref={player} clip={clip} locale={locale} onBeat={onBeat} onChanged={onChanged} />

      <QuestionsSection
        questions={clip.questions}
        watched={watched}
        pct={pct}
        locale={locale}
        onAnswer={onAnswer}
        onShowMoment={(ms) => player.current?.seekTo(ms)}
      />

      {finished && (
        <div role="status" data-clip-done className="flex flex-col gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 @lg:flex-row @lg:items-center @lg:justify-between dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />{t('staffTraining.clip.done')}</p>
          <Button asChild>
            <Link to={next ? itemPath(next.kind, next.id) : '/training'}>
              {t(next ? (next.kind === 'task' ? 'staffTraining.clip.next.task' : 'staffTraining.clip.next.clip') : 'staffTraining.clip.next.none')}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}

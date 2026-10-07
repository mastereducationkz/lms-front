import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import type { CheckpointLock } from '../../lib/checkpointHints';
import {
  CHECKPOINT_WINDOW_HOURS, formatDeadline, lateLabel, type CheckpointUnit,
} from '../../services/api/checkpoints';
import type { LessonLock } from '../../services/api/lessons';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/learning';
import '@/lib/i18n/catalogs/lessonPlayer';

interface CheckpointLockGuideProps {
  /** Why the lesson was refused, or null when checkpoint data doesn't explain it. */
  lock: CheckpointLock | null;
  /** Title of the lesson the student tried to open; null when we couldn't resolve it. */
  unitTitle: string | null;
  courseId: string;
  /** The server's own refusal reason, used only when `lock` is null. */
  detail: string | null;
  /**
   * The server's structured explanation (GET .../check-access). It is the authority on the
   * unit's title and on which gate fired — it can name a unit in a course the client cannot
   * see at all — so its title always wins. Its steps are used whenever `lock` above doesn't
   * give us the richer, interactive checkpoint rendering.
   */
  serverLock?: LessonLock | null;
  onNavigate: (path: string) => void;
}

/** One numbered step of the "here's how to get in" chain. The number is a plain bold numeral
 *  rather than a chip: the emphasis carries the structure, so no extra chrome is needed. */
const GuideStep = ({ n, title, children }: { n: number; title: string; children?: ReactNode }) => (
  <li className="pl-7 -indent-7">
    <span className="font-semibold text-muted-foreground">{n}. </span>
    <span className="font-semibold text-foreground">{title}</span>
    {children ? <span className="block indent-0 space-y-1 text-muted-foreground">{children}</span> : null}
  </li>
);

/** The checkpoint's required units, ticked off. Unfinished ones link straight to the lesson. */
const UnitChecklist = ({
  units, courseId, linkUnfinished, onNavigate,
}: {
  units: CheckpointUnit[];
  courseId: string;
  linkUnfinished: boolean;
  onNavigate: (path: string) => void;
}) => {
  const t = useT();
  return (
  <ul aria-label={t('lessonPlayer.guide.requiredUnits')}>
    {units.map((unit) => (
      <li key={unit.lesson_id}>
        <span className="text-muted-foreground">{unit.kind === 'verbal' ? t('lessonPlayer.common.verbal') : t('lessonPlayer.common.math')} · </span>
        <span className={unit.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}>
          {!unit.completed && linkUnfinished ? (
            <button
              type="button"
              className="underline underline-offset-2 hover:text-foreground"
              onClick={() => onNavigate(`/course/${courseId}/lesson/${unit.lesson_id}`)}
            >
              {unit.title}
            </button>
          ) : (
            unit.title
          )}
        </span>
        {/* Done/left is said in words, not a tick: colour alone would carry it for sighted
            readers only, and the surrounding UI deliberately avoids icon chrome. */}
        <span className={unit.completed
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-muted-foreground'}>
          {` · ${unit.completed ? t('lessonPlayer.guide.unitDone') : t('lessonPlayer.guide.unitNotFinished')}`}
        </span>
      </li>
    ))}
  </ul>
  );
};

export default function CheckpointLockGuide({
  lock, unitTitle, courseId, detail, serverLock, onNavigate,
}: CheckpointLockGuideProps) {
  const t = useT();
  // The server's title wins: it can name a unit whose course the client can't even list.
  const resolvedTitle = serverLock?.unit_title || unitTitle || null;

  // Fallback (no checkpoint explains the refusal). The server says which gate fired and what to
  // do about it; we only supply generic advice when it didn't answer at all.
  const serverReason = serverLock?.reason || detail;
  const serverSteps = serverLock?.steps?.length ? serverLock.steps : null;
  let heading = resolvedTitle ? t('lessonPlayer.guide.lockedTitled', { title: resolvedTitle }) : t('lessonPlayer.guide.locked');
  let lede: ReactNode = t('lessonPlayer.guide.lockedLede');
  let steps: ReactNode = (
    <>
      <GuideStep n={1} title={t('lessonPlayer.guide.why')}>
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {serverReason || t('lessonPlayer.guide.noReason')}
        </p>
      </GuideStep>
      <GuideStep n={2} title={t('lessonPlayer.guide.whatToDo')}>
        {serverSteps ? (
          serverSteps.map((step, i) => <p key={i}>{step}</p>)
        ) : (
          <>
            <p>{t('lessonPlayer.guide.finishEarlier')}</p>
            <p>{t('lessonPlayer.guide.askCurator')}</p>
          </>
        )}
      </GuideStep>
    </>
  );

  if (lock?.kind === 'checkpoint-shut') {
    const cp = lock.item;

    if (cp.status === 'completed') {
      heading = t('lessonPlayer.guide.doneTitle', { number: cp.number });
      lede = t('lessonPlayer.guide.doneLede');
      steps = (
        <GuideStep n={1} title={t('lessonPlayer.guide.yourResult')}>
          <p>
            {cp.correct_answers}/{cp.total_questions}
            {cp.percentage != null ? ` (${cp.percentage}%)` : ''}
            {cp.submitted_at ? ` · ${t('lessonPlayer.guide.submitted', { date: formatDeadline(cp.submitted_at) })}` : ''}
            {lateLabel(cp) ? ` · ${lateLabel(cp)}` : ''}
          </p>
        </GuideStep>
      );
    } else if (cp.skipped) {
      // Stored at switch-on (already earned then) vs. below the group's start number.
      heading = cp.opened_by === 'baseline'
        ? t('lessonPlayer.guide.optionalForYou', { number: cp.number })
        : t('lessonPlayer.guide.notForGroup', { number: cp.number });
      lede = cp.locked_reason || t('lessonPlayer.guide.laterStart');
      steps = null;
    } else {
      heading = t('lessonPlayer.guide.notOpenTitle', { number: cp.number });
      lede = t('lessonPlayer.guide.notOpenLede');
      steps = (
        <>
          <GuideStep n={1} title={t('lessonPlayer.guide.finishUnits')}>
            <UnitChecklist units={cp.covers} courseId={courseId} linkUnfinished onNavigate={onNavigate} />
            {cp.locked_reason ? <p>{cp.locked_reason}</p> : null}
          </GuideStep>
          <GuideStep n={2} title={t('lessonPlayer.guide.thenOpens', { number: cp.number })}>
            <p>{t('lessonPlayer.guide.window', { questions: t('lessonPlayer.common.questions', { count: cp.total_questions }), hours: CHECKPOINT_WINDOW_HOURS })}</p>
          </GuideStep>
        </>
      );
    }
  }

  return (
    // Header and actions are centred so the block reads as centred at any pane width (the
    // sidebar collapses to w-0, which would otherwise leave short left-aligned lines drifting
    // well left of the middle). The steps stay left-aligned, since a centred numbered list is
    // much harder to read, inside the same centred column.
    <div className="mx-auto w-full max-w-xl text-center">
      <h1 className="text-xl font-semibold">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{lede}</p>

      {steps ? <ol className="mt-8 space-y-4 text-left text-sm">{steps}</ol> : null}

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={() => onNavigate(`/course/${courseId}`)}>{t('learning.lesson.back')}</Button>
        <Button variant="ghost" onClick={() => onNavigate('/checkpoints')}>{t('lessonPlayer.guide.myCheckpoints')}</Button>
      </div>
    </div>
  );
}

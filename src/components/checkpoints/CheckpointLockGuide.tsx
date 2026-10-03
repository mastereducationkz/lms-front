import type { ReactNode } from 'react';
import { Button } from '../ui/button';
import type { CheckpointLock } from '../../lib/checkpointHints';
import {
  CHECKPOINT_WINDOW_LABEL, formatDeadline, lateLabel, type CheckpointUnit,
} from '../../services/api/checkpoints';
import type { LessonLock } from '../../services/api/lessons';

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
}) => (
  <ul aria-label="Required units">
    {units.map((unit) => (
      <li key={unit.lesson_id}>
        <span className="text-muted-foreground">{unit.kind === 'verbal' ? 'Verbal' : 'Math'} · </span>
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
          {unit.completed ? ' · done' : ' · not finished'}
        </span>
      </li>
    ))}
  </ul>
);

export default function CheckpointLockGuide({
  lock, unitTitle, courseId, detail, serverLock, onNavigate,
}: CheckpointLockGuideProps) {
  // The server's title wins: it can name a unit whose course the client can't even list.
  const resolvedTitle = serverLock?.unit_title || unitTitle || null;

  // Fallback (no checkpoint explains the refusal). The server says which gate fired and what to
  // do about it; we only supply generic advice when it didn't answer at all.
  const serverReason = serverLock?.reason || detail;
  const serverSteps = serverLock?.steps?.length ? serverLock.steps : null;
  let heading = resolvedTitle ? `${resolvedTitle} is locked` : 'You can’t open this unit yet';
  let lede: ReactNode = 'This unit isn’t open for you yet.';
  let steps: ReactNode = (
    <>
      <GuideStep n={1} title="Why it’s locked">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {serverReason || 'The server didn’t give a reason for this one.'}
        </p>
      </GuideStep>
      <GuideStep n={2} title="What to do">
        {serverSteps ? (
          serverSteps.map((step, i) => <p key={i}>{step}</p>)
        ) : (
          <>
            <p>Go back to the course and finish the units that come before this one.</p>
            <p>If it still won’t open, ask your curator to check your access.</p>
          </>
        )}
      </GuideStep>
    </>
  );

  if (lock?.kind === 'checkpoint-shut') {
    const cp = lock.item;

    if (cp.status === 'completed') {
      heading = `Checkpoint ${cp.number} is done`;
      lede = 'You have already submitted this checkpoint, so it can’t be opened again.';
      steps = (
        <GuideStep n={1} title="Your result">
          <p>
            {cp.correct_answers}/{cp.total_questions}
            {cp.percentage != null ? ` (${cp.percentage}%)` : ''}
            {cp.submitted_at ? ` · submitted ${formatDeadline(cp.submitted_at)}` : ''}
            {lateLabel(cp) ? ` · ${lateLabel(cp)}` : ''}
          </p>
        </GuideStep>
      );
    } else if (cp.skipped) {
      // Stored at switch-on (already earned then) vs. below the group's start number.
      heading = cp.opened_by === 'baseline'
        ? `Checkpoint ${cp.number} is optional for you`
        : `Checkpoint ${cp.number} isn’t required for your group`;
      lede = cp.locked_reason || 'Your group starts from a later checkpoint.';
      steps = null;
    } else {
      heading = `Checkpoint ${cp.number} isn’t open yet`;
      lede = 'A checkpoint opens the moment you finish every unit it covers.';
      steps = (
        <>
          <GuideStep n={1} title="Finish the units it covers">
            <UnitChecklist units={cp.covers} courseId={courseId} linkUnfinished onNavigate={onNavigate} />
            {cp.locked_reason ? <p>{cp.locked_reason}</p> : null}
          </GuideStep>
          <GuideStep n={2} title={`Then Checkpoint ${cp.number} opens automatically`}>
            <p>{cp.total_questions} questions · {CHECKPOINT_WINDOW_LABEL} to finish it from the moment it opens.</p>
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
        <Button variant="outline" onClick={() => onNavigate(`/course/${courseId}`)}>Back to course</Button>
        <Button variant="ghost" onClick={() => onNavigate('/checkpoints')}>My checkpoints</Button>
      </div>
    </div>
  );
}

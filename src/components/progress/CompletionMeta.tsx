import { checkpointLabel, lessonsLabel, type CheckpointSummary } from '../../lib/completion';

interface CompletionMetaProps {
  lessonsDone?: number | null;
  lessonsTotal?: number | null;
  checkpoints?: CheckpointSummary | null;
  className?: string;
}

/**
 * The two lines that sit beside every course-completion percentage:
 * «12 из 30 уроков» and, when the student has opened a checkpoint,
 * «Чекпоинты: 3 из 4 · средний балл 72%». Renders nothing when there is nothing to say.
 */
export function CompletionMeta({ lessonsDone, lessonsTotal, checkpoints, className = '' }: CompletionMetaProps) {
  const lessons = lessonsLabel(lessonsDone, lessonsTotal);
  const cp = checkpointLabel(checkpoints);
  if (!lessons && !cp) return null;
  return (
    <div className={`text-xs text-muted-foreground space-y-0.5 ${className}`}>
      {lessons && <div>{lessons}</div>}
      {cp && <div>{cp}</div>}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  coversLabel, formatDeadline, getMyCheckpoints, STATUS_CLASS, STATUS_LABEL, type StudentCheckpointItem,
} from '../../services/api/checkpoints';

const OPEN_STATUSES = new Set(['available', 'reopened', 'overdue']);

/**
 * Student dashboard: SAT checkpoints. Renders nothing when the feature is off for the student's
 * groups, there are no checkpoints at all, or on any error. Otherwise always shows a header with
 * the "All checkpoints" link, plus: open checkpoints (available/reopened/overdue) if any exist,
 * else a compact preview of the next locked checkpoint, else an "all completed" line.
 */
export function CheckpointsCard() {
  const navigate = useNavigate();
  const [data, setData] = useState<{ enabled: boolean; items: StudentCheckpointItem[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyCheckpoints()
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);

  if (!data || !data.enabled || data.items.length === 0) return null;

  const openItems = data.items.filter((i) => OPEN_STATUSES.has(i.status));
  const nextLocked = openItems.length === 0 ? data.items.find((i) => i.status === 'locked' && !i.skipped) : undefined;

  return (
    <Card className="mt-2">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SAT Checkpoints</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate('/checkpoints')}>
            All checkpoints
          </button>
        </div>
        {openItems.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {openItems.map((item) => {
              const clickable = Boolean(item.quiz) && item.status !== 'overdue';
              const content = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      {item.title}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">Covers: {coversLabel(item.covers)} · {item.total_questions} questions</p>
                    {item.deadline && (
                      <p className={`text-xs ${item.status === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                        Deadline: {formatDeadline(item.deadline)} (Almaty)
                      </p>
                    )}
                    {item.status === 'overdue' && (
                      <p className="text-xs text-red-600">Deadline passed — ask your curator to reopen it.</p>
                    )}
                  </div>
                  {clickable && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                </div>
              );
              return (
                <li key={`${item.group_id}-${item.checkpoint_id}`}>
                  {clickable ? (
                    <button
                      type="button"
                      className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50"
                      onClick={() => navigate(`/course/${item.quiz!.course_id}/lesson/${item.quiz!.lesson_id}`)}
                      aria-label={`Open ${item.title}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className="w-full rounded-lg border px-3 py-2">
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : nextLocked ? (
          <div className="mt-2 w-full rounded-lg border px-3 py-2">
            <p className="font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              {nextLocked.title}
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[nextLocked.status]}`}>
                {STATUS_LABEL[nextLocked.status]}
              </span>
            </p>
            <p className="text-xs text-muted-foreground truncate">Covers: {coversLabel(nextLocked.covers)}</p>
            {nextLocked.locked_reason && (
              <p className="text-xs text-muted-foreground">{nextLocked.locked_reason}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">All checkpoints completed 🎉</p>
        )}
      </CardContent>
    </Card>
  );
}

export default CheckpointsCard;

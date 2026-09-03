import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  coversLabel, formatDeadline, getMyCheckpoints, STATUS_CLASS, STATUS_LABEL, type StudentCheckpointItem,
} from '../../services/api/checkpoints';

/**
 * Student dashboard: open SAT checkpoints (available / reopened / overdue). Renders nothing when the
 * feature is off for the student's groups, nothing is open, or on any error.
 */
export function CheckpointsCard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StudentCheckpointItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    getMyCheckpoints()
      .then((res) => {
        if (cancelled) return;
        setItems(res.enabled ? res.items.filter((i) => i.status !== 'locked' && i.status !== 'completed') : []);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  if (items.length === 0) return null;

  return (
    <Card className="mt-2">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SAT Checkpoints</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate('/checkpoints')}>
            All checkpoints
          </button>
        </div>
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={`${item.group_id}-${item.checkpoint_id}`}>
              <button
                type="button"
                className="w-full text-left rounded-lg border px-3 py-2 hover:bg-muted/50"
                onClick={() => item.quiz && navigate(`/course/${item.quiz.course_id}/lesson/${item.quiz.lesson_id}`)}
                aria-label={`Open ${item.title}`}
              >
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
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default CheckpointsCard;

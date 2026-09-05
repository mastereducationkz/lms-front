import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Loader from '../components/Loader';
import {
  coversLabel, formatDeadline, getMyCheckpoints, STATUS_CLASS, STATUS_LABEL, type StudentCheckpointItem,
} from '../services/api/checkpoints';

export default function CheckpointsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<StudentCheckpointItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyCheckpoints()
      .then((res) => { if (!cancelled) { setEnabled(res.enabled); setItems(res.items); } })
      .catch(() => { if (!cancelled) setError('Could not load checkpoints'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader />;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (!enabled) return <p className="p-6 text-muted-foreground">Checkpoints are not enabled for your group yet.</p>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">SAT Checkpoints</h1>
      <p className="text-sm text-muted-foreground">
        A checkpoint opens as soon as you finish its 2 Verbal units and 1 Math unit, and stays open for 3 days.
      </p>
      {items.map((item) => {
        const open = item.status === 'available' || item.status === 'reopened';
        return (
          <Card key={`${item.group_id}-${item.checkpoint_id}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {item.status === 'locked' ? <Lock className="h-4 w-4" aria-hidden="true" /> : null}
                    {item.title}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}>
                      {item.skipped ? 'Skipped' : STATUS_LABEL[item.status]}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Covers: {coversLabel(item.covers)} · {item.total_questions} questions</p>
                  {item.deadline && item.status !== 'completed' && (
                    <p className={`text-xs ${item.status === 'overdue' ? 'text-red-600' : 'text-muted-foreground'}`}>
                      Deadline: {formatDeadline(item.deadline)} (Almaty)
                    </p>
                  )}
                  {item.status === 'completed' && (
                    <p className="text-xs text-muted-foreground">
                      Result: {item.correct_answers}/{item.total_questions} ({item.percentage}%) · submitted {formatDeadline(item.submitted_at)}
                    </p>
                  )}
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label="Required units">
                    {item.covers.map((u) => (
                      <li key={u.lesson_id}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${u.completed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {u.completed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                        {u.kind === 'verbal' ? 'Verbal' : 'Math'} · {u.title}
                      </li>
                    ))}
                  </ul>
                  {item.locked_reason && <p className="mt-2 text-xs text-muted-foreground">{item.locked_reason}</p>}
                </div>
                {open && item.quiz && (
                  <Button onClick={() => navigate(`/course/${item.quiz!.course_id}/lesson/${item.quiz!.lesson_id}`)}>
                    Start
                  </Button>
                )}
                {item.status === 'overdue' && (
                  <p className="text-xs text-red-600 max-w-[10rem]">Deadline passed. Ask your curator to reopen it.</p>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

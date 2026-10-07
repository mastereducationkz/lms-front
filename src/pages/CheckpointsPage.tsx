import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import Loader from '../components/Loader';
import {
  CHECKPOINT_WINDOW_HOURS, coversLabel, deadlineCountdown, formatDeadline, getMyCheckpoints, lateLabel, STATUS_CLASS, type StudentCheckpointItem,
} from '../services/api/checkpoints';
import type { MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/lessonPlayer';

const STATUS_LABEL: Record<StudentCheckpointItem['status'], MessageKey> = {
  locked: 'lessonPlayer.checkpointStatus.locked',
  available: 'lessonPlayer.checkpointStatus.available',
  completed: 'lessonPlayer.checkpointStatus.completed',
  overdue: 'lessonPlayer.checkpointStatus.overdue',
  reopened: 'lessonPlayer.checkpointStatus.reopened',
};

export default function CheckpointsPage() {
  const navigate = useNavigate();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<StudentCheckpointItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyCheckpoints()
      .then((res) => { if (!cancelled) { setEnabled(res.enabled); setItems(res.items); } })
      .catch(() => { if (!cancelled) setError(t('lessonPlayer.checkpoints.loadFailed')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <Loader />;
  if (error) return <p className="p-6 text-red-600 dark:text-red-400">{error}</p>;
  if (!enabled) return <p className="p-6 text-muted-foreground">{t('lessonPlayer.checkpoints.disabled')}</p>;

  return (
    <div className="@2xl:p-6 space-y-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">{t('lessonPlayer.checkpoints.title')}</h1>
      <p className="text-sm text-muted-foreground">
        {t('lessonPlayer.checkpoints.intro', { hours: CHECKPOINT_WINDOW_HOURS })}
      </p>
      {items.map((item) => {
        const open = item.status === 'available' || item.status === 'reopened' || item.status === 'overdue';
        return (
          <Card key={`${item.group_id}-${item.checkpoint_id}`}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {item.status === 'locked' && !item.skipped ? <Lock className="h-4 w-4" aria-hidden="true" /> : null}
                    {item.title}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}>
                      {item.skipped ? t('lessonPlayer.checkpointStatus.skipped') : t(STATUS_LABEL[item.status])}
                    </span>
                  </p>
                  {open && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('lessonPlayer.checkpoints.openNow')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{t('lessonPlayer.checkpoints.covers', { covers: coversLabel(item.covers), questions: t('lessonPlayer.common.questions', { count: item.total_questions }) })}</p>
                  {item.deadline && item.status !== 'completed' && (
                    <p className={`text-xs ${item.status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {t('lessonPlayer.checkpoints.deadline', { deadline: formatDeadline(item.deadline), countdown: deadlineCountdown(item.deadline) })}
                    </p>
                  )}
                  {item.status === 'completed' && (
                    <p className="text-xs text-muted-foreground">
                      {t('lessonPlayer.checkpoints.result', { correct: item.correct_answers ?? '', total: item.total_questions, percent: item.percentage ?? '', date: formatDeadline(item.submitted_at) })}
                      {item.late && <span className="text-red-600 dark:text-red-400"> · {lateLabel(item)}</span>}
                    </p>
                  )}
                  <ul className="mt-2 flex flex-wrap gap-2" aria-label={t('lessonPlayer.guide.requiredUnits')}>
                    {item.covers.map((u) => (
                      <li key={u.lesson_id}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${u.completed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
                        {u.completed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                        {u.kind === 'verbal' ? t('lessonPlayer.common.verbal') : t('lessonPlayer.common.math')} · {u.title}
                      </li>
                    ))}
                  </ul>
                  {item.locked_reason && <p className="mt-2 text-xs text-muted-foreground">{item.locked_reason}</p>}
                </div>
                {open && item.quiz && (
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Button onClick={() => navigate(`/course/${item.quiz!.course_id}/lesson/${item.quiz!.lesson_id}`)}>
                      {item.status === 'overdue' ? t('lessonPlayer.checkpoint.submitLate') : t('lessonPlayer.common.start')}
                    </Button>
                    {item.status === 'overdue' && (
                      <p className="text-xs text-muted-foreground max-w-[12rem] text-right">{t('lessonPlayer.checkpoint.lateBody')}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import {
  coversLabel, getMyCheckpoints, STATUS_CLASS, type StudentCheckpointItem,
} from '../../services/api/checkpoints';
import { formatDateTime, type TFunction } from '@/lib/i18n';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';

const OPEN_STATUSES = new Set(['available', 'reopened', 'overdue']);

/** "5h 12m" / "3d 2h" — services/api/checkpoints' formatDuration, in the user's language. */
function duration(minutes: number, t: TFunction): string {
  const m = Math.max(0, Math.round(minutes));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  const min = m % 60;
  if (d > 0) return t('studentHome.checkpoints.durationDays', { d, h });
  if (h > 0) return t('studentHome.checkpoints.durationHours', { h, m: min });
  return t('studentHome.checkpoints.durationMinutes', { m: min });
}

/** "due in 5h 12m" while the deadline is ahead, "overdue by 3h 05m" once it has passed. */
function countdown(iso: string, t: TFunction, now: Date = new Date()): string {
  const deadline = new Date(iso);
  if (Number.isNaN(deadline.getTime())) return '';
  const minutes = (deadline.getTime() - now.getTime()) / 60000;
  return minutes >= 0
    ? t('studentHome.checkpoints.dueIn', { duration: duration(minutes, t) })
    : t('studentHome.checkpoints.overdueBy', { duration: duration(-minutes, t) });
}

/**
 * Student dashboard: SAT checkpoints. Renders nothing when the feature is off for the student's
 * groups, there are no checkpoints at all, or on any error. Otherwise always shows a header with
 * the "All checkpoints" link, plus: open checkpoints (available/reopened/overdue) if any exist,
 * else a compact preview of the next locked checkpoint, else an "all completed" line.
 */
export function CheckpointsCard() {
  const t = useT();
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('studentHome.checkpoints.title')}</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate('/checkpoints')}>
            {t('studentHome.checkpoints.all')}
          </button>
        </div>
        {openItems.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {openItems.map((item) => {
              const clickable = Boolean(item.quiz);
              const content = (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                      {item.title}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[item.status]}`}>
                        {t(`studentHome.checkpoints.status.${item.status}`)}
                      </span>
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('studentHome.checkpoints.encourage')}</p>
                    <p className="text-xs text-muted-foreground truncate">{t('studentHome.checkpoints.coversQuestions', { covers: coversLabel(item.covers), count: item.total_questions })}</p>
                    {item.deadline && (
                      <p className={`text-xs ${item.status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {t('studentHome.checkpoints.deadline', { date: formatDateTime(item.deadline), countdown: countdown(item.deadline, t) })}
                      </p>
                    )}
                    {item.status === 'overdue' && (
                      <p className="text-xs text-muted-foreground">{t('studentHome.checkpoints.overdueNote')}</p>
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
                      aria-label={t('studentHome.dashboard.openTitle', { title: item.title })}
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
                {t(`studentHome.checkpoints.status.${nextLocked.status}`)}
              </span>
            </p>
            <p className="text-xs text-muted-foreground truncate">{t('studentHome.checkpoints.covers', { covers: coversLabel(nextLocked.covers) })}</p>
            {nextLocked.locked_reason && (
              <p className="text-xs text-muted-foreground">{nextLocked.locked_reason}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{t('studentHome.checkpoints.allDone')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default CheckpointsCard;

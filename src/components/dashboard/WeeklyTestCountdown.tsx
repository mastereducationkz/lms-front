import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Circle, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { formatAlmaty, getWeeklyTestsMe, type PlatformTestProgress } from '../../services/api/platformTests';

/**
 * Student dashboard: the current weekly platform test with its countdown and one checkmark per
 * part. Wording follows the platform's rules — "due" for Listening/Reading/Writing (they stay
 * open after the deadline while the set is active), "closes" for Speaking (only inside its
 * window). Renders nothing when the feature is off (503), when there is no platform test, or on
 * any error, so the dashboard never shows an empty box.
 */

const SHORT: Record<string, string> = { listening: 'L', reading: 'R', writing: 'W', speaking: 'S', math: 'M', verbal: 'V', nuet: 'NUET' };
const LABEL: Record<string, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking', math: 'Math', verbal: 'Verbal', nuet: 'NUET' };
const platformLabel = (item: PlatformTestProgress): string => ((item as { track?: string }).track ?? item.platform ?? '').toUpperCase() || 'Platform';

function headlineFor(item: PlatformTestProgress): string {
  const days = item.days_left;
  const speaking = item.modules.find((m) => m.module === 'speaking');
  const onlySpeakingLeft =
    !!speaking && speaking.state !== 'done' && item.modules.every((m) => m.module === 'speaking' || m.state === 'done');
  if (days == null) return 'Weekly test';
  if (onlySpeakingLeft) return days >= 0 ? `Speaking closes in ${days} day${days === 1 ? '' : 's'}` : 'Speaking window closed';
  if (days > 1) return `Due in ${days} days`;
  if (days === 1) return 'Due tomorrow';
  if (days === 0) return 'Due today';
  return 'Past due — still open';
}

export function WeeklyTestCountdown() {
  const navigate = useNavigate();
  const [item, setItem] = useState<PlatformTestProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeeklyTestsMe()
      .then((items) => {
        if (!cancelled) setItem(items[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setItem(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!item) return null;

  const done = item.modules.filter((m) => m.state === 'done').length;
  return (
    <Card className="mt-2">
      <CardContent className="p-5">
        <button
          type="button"
          className="w-full text-left"
          onClick={() => navigate(`/homework/${item.assignment_id}`)}
          aria-label={`Open ${item.title}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{platformLabel(item)} weekly test</p>
              <p className="font-medium truncate">{item.set_title ?? item.title}</p>
              <p className="mt-1 text-lg font-semibold text-primary">{headlineFor(item)}</p>
              {item.date_to && (
                <p className="text-xs text-muted-foreground">
                  Until {formatAlmaty(item.date_to)} (Almaty) · {done}/{item.modules.length} done
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Parts">
            {item.modules.map((m) => (
              <li
                key={m.module}
                title={`${LABEL[m.module] ?? m.module}: ${m.state.replace('_', ' ')}`}
                className={
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ' +
                  (m.state === 'done'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : m.state === 'in_progress'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                      : 'bg-muted text-muted-foreground')
                }
              >
                {m.state === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : m.state === 'in_progress' ? (
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {SHORT[m.module] ?? m.module}
              </li>
            ))}
          </ul>
        </button>
      </CardContent>
    </Card>
  );
}

export default WeeklyTestCountdown;

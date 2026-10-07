import { useEffect, useMemo, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import { canScore, changedScores, lessonStarted, scoredCount } from '../../lib/lessonScores';
import { getEventParticipants, saveActivityScores } from '../../services/api/events';
import type { EventStudent } from '../../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  /** Naive UTC, as every lesson time. */
  start: string;
  title?: string;
  /** The scores just saved: student_id → score. */
  onSaved?: (saved: Map<number, number>) => void;
}

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STATUS: Record<string, MessageKey> = {
  attended: 'attendance.status.present',
  late: 'attendance.status.late',
  missed: 'attendance.status.absent',
  cancelled: 'attendance.status.cancelled',
  registered: 'attendance.status.notMarkedYet',
};

const RUBRIC: [string, MessageKey][] = [
  ['0', 'attendance.rubric.r0'],
  ['1-3', 'attendance.rubric.r1to3'],
  ['4-5', 'attendance.rubric.r4to5'],
  ['6-7', 'attendance.rubric.r6to7'],
  ['8-9', 'attendance.rubric.r8to9'],
  ['10', 'attendance.rubric.r10'],
];

/**
 * «Баллы за урок» (owner, 2026-09-28): every student of one lesson on one screen, scored while the
 * lesson is fresh. Meet writes the register 20–30 minutes after the end; a score given before that
 * waits on the student and stays when Meet marks them. Saves scores only — never a mark.
 */
export default function LessonScoresDialog({ open, onOpenChange, eventId, start, title, onSaved }: Props) {
  const t = useT();
  const [students, setStudents] = useState<EventStudent[] | null>(null);
  const [loaded, setLoaded] = useState<Map<number, number | null>>(new Map());
  const [current, setCurrent] = useState<Map<number, number | null>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const started = lessonStarted(start);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setStudents(null);
    setError(null);
    getEventParticipants(eventId)
      .then((list) => {
        if (!alive) return;
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));
        const scores = new Map(sorted.map((s) => [s.student_id, s.activity_score ?? null] as [number, number | null]));
        setStudents(sorted);
        setLoaded(scores);
        setCurrent(new Map(scores));
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [open, eventId]);

  const changes = useMemo(() => changedScores(loaded, current), [loaded, current]);
  const count = students ? scoredCount(students, current) : null;

  const save = async () => {
    if (!changes.length) return;
    setSaving(true);
    setError(null);
    try {
      await saveActivityScores(eventId, changes);
      onSaved?.(new Map(changes.map((c) => [c.student_id, c.activity_score])));
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Star className="h-4 w-4 text-yellow-500 dark:text-yellow-400" aria-hidden />
            {t('attendance.scores.title')}
          </DialogTitle>
          {title && <p className="truncate text-xs text-muted-foreground">{title}</p>}
          <p className="text-xs text-muted-foreground">
            {t('attendance.scores.intro')}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {!started ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('attendance.scores.notStarted')}
            </p>
          ) : !students ? (
            error ? <p className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">{error}</p>
              : <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : students.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('attendance.scores.noStudents')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {students.map((s) => {
                const open_ = canScore(s.attendance_status);
                const value = current.get(s.student_id) ?? null;
                const label = STATUS[s.attendance_status] ?? STATUS.registered;
                return (
                  <li key={s.student_id} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 sm:w-48 sm:flex-none">
                      <div className="truncate text-sm font-medium text-foreground">{s.name}</div>
                      <div className={cn('text-[11px]', open_ ? 'text-muted-foreground' : 'text-rose-600 dark:text-rose-400')}>
                        {open_ ? t(label) : t('attendance.scores.statusNoScore', { status: t(label) })}
                      </div>
                    </div>
                    {open_ && (
                      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={s.name}>
                        {SCORES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={value === n}
                            onClick={() => setCurrent((prev) => new Map(prev).set(s.student_id, n))}
                            className={cn(
                              'h-8 w-8 rounded-md border text-xs font-semibold tabular-nums transition',
                              value === n
                                ? 'border-yellow-500 bg-yellow-400 text-yellow-950'
                                : 'border-border bg-card text-foreground hover:bg-muted',
                            )}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {started && students && students.length > 0 && (
            <details className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-semibold text-foreground">{t('attendance.rubric.title')}</summary>
              <div className="mt-2 space-y-1">
                {RUBRIC.map(([range, key]) => (
                  <div key={range} className="flex gap-2"><span className="w-8 flex-none font-medium">{range}</span>{t(key)}</div>
                ))}
              </div>
            </details>
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t border-border px-5 py-3 sm:justify-between">
          <span className="mr-auto text-xs text-muted-foreground">
            {count && count.of > 0 && t('attendance.scores.scoredCount', { scored: count.scored, total: count.of })}
            {error && students && <span className="ml-2 text-rose-600 dark:text-rose-400">{error}</span>}
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{t('common.cancel')}</Button>
          <Button onClick={save} disabled={!changes.length || saving} className="bg-yellow-500 text-yellow-950 hover:bg-yellow-600">
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t('common.save')}{changes.length > 0 && ` (${changes.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

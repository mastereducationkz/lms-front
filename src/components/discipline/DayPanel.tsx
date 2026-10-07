import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { Button } from '../ui/button';
import DecisionDialog, { type DecisionTarget } from './DecisionDialog';
import { money } from '../../lib/discipline';
import { formatDate, formatTime, type MessageKey, type TFunction } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherInsights';
import {
  getDay,
  saveDecision,
  type DisciplineDay,
  type DisciplineFinding,
  type DisciplineLesson,
} from '../../services/api/discipline';

/**
 * One teacher, one day: every lesson with what the LMS saw and what it proposes.
 *
 * The panel exists because a number in a grid is not evidence. It shows when the teacher joined
 * and left, whether late minutes were made up by teaching past the end, and how many students were
 * still in the room for those extra minutes — so a head teacher can waive a fine knowing what
 * actually happened, instead of guessing from «3′».
 */

const KIND_TEXT: Record<string, MessageKey> = {
  late: 'teacherInsights.discipline.kind.late',
  ended_early: 'teacherInsights.discipline.kind.endedEarly',
  miss: 'teacherInsights.discipline.kind.miss',
};

const time = (iso: string | null) =>
  iso ? formatTime(iso) : '—';

function madeUpLine(lesson: DisciplineLesson, finding: DisciplineFinding, t: TFunction): string | null {
  if (finding.kind !== 'late' || !finding.made_up) return null;
  const minutes = Math.round(
    (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 60000);
  return lesson.students
    ? t('teacherInsights.discipline.madeUpStayed', { minutes, stayed: lesson.students_at_end, students: lesson.students })
    : t('teacherInsights.discipline.madeUp', { minutes });
}

export default function DayPanel({ teacherId, teacherName, day, canDecide, onClose, onChanged }: {
  teacherId: number;
  teacherName: string;
  day: string;
  canDecide: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const [data, setData] = useState<DisciplineDay | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setData(await getDay(teacherId, day));
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('teacherInsights.discipline.loadDayFailed'));
    }
  };

  useEffect(() => { load(); }, [teacherId, day]);

  const decide = async (lesson: DisciplineLesson, finding: DisciplineFinding,
                        amount: number, reason_code?: string | null, note?: string | null) => {
    const key = `${lesson.event_id}-${finding.kind}`;
    setSaving(key);
    setError('');
    try {
      await saveDecision({
        event_id: lesson.event_id, teacher_id: teacherId, day, kind: finding.kind,
        amount, reason_code: reason_code ?? null, note: note ?? null,
        minutes: finding.minutes, proposed_amount: finding.fine,
      });
      await load();
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.detail || t('teacherInsights.discipline.saveFailed'));
    } finally {
      setSaving(null);
    }
  };

  // One dialog serves both entry points. «Waive» and «Change amount» are the same decision —
  // an amount, a reason when it goes down, and a note — so they open the same form with
  // different starting numbers rather than two different boxes that can disagree.
  const [editing, setEditing] = useState<{
    lesson: DisciplineLesson; finding: DisciplineFinding; target: DecisionTarget;
  } | null>(null);

  const openDecision = (lesson: DisciplineLesson, finding: DisciplineFinding,
                        startAt: 'waive' | 'current') => {
    setEditing({
      lesson,
      finding,
      target: {
        lessonLabel: `${lesson.group} · ${time(lesson.starts_at)}`,
        kindLabel: KIND_TEXT[finding.kind] ? t(KIND_TEXT[finding.kind]) : finding.kind,
        minutes: finding.kind === 'miss' ? null : finding.minutes,
        proposed: finding.fine,
        current: startAt === 'waive' ? 0 : (finding.decision?.amount ?? finding.fine ?? null),
        currentReason: finding.decision?.reason_code ?? null,
        currentNote: finding.decision?.note ?? null,
      },
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-border bg-card p-4 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{teacherName}</h2>
          <p className="text-sm text-muted-foreground">{formatDate(day, {
            weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t('common.close')}><X className="h-4 w-4" /></Button>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {!data && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      {data?.lessons.length === 0 && <p className="text-sm text-muted-foreground">{t('teacherInsights.discipline.noLessonsThatDay')}</p>}

      <div className="space-y-4">
        {data?.lessons.map((lesson) => (
          <div key={lesson.event_id} className="rounded-lg border border-border p-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{lesson.group}</p>
              <p className="text-sm text-muted-foreground">{time(lesson.starts_at)}–{time(lesson.ends_at)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {lesson.measurable
                ? t('teacherInsights.discipline.joinedLeft', { joined: time(lesson.first_join), left: time(lesson.last_leave) })
                : t('teacherInsights.discipline.noRoom')}
            </p>

            {lesson.findings.length === 0 && lesson.measurable && (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{t('teacherInsights.discipline.onTime')}</p>
            )}

            {lesson.findings.map((finding) => {
              const key = `${lesson.event_id}-${finding.kind}`;
              const decided = finding.decision;
              const owed = decided ? decided.amount : (finding.fine ?? null);
              return (
                <div key={key} className="mt-3 rounded-md bg-muted p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {KIND_TEXT[finding.kind] ? t(KIND_TEXT[finding.kind]) : finding.kind}
                      {finding.kind !== 'miss' && <> · {t('teacherInsights.discipline.minutes', { minutes: finding.minutes })}</>}
                    </p>
                    <p className="text-sm">
                      {owed === null ? <span className="text-amber-700 dark:text-amber-400">{t('teacherInsights.discipline.needsAmount')}</span> : money(owed)}
                    </p>
                  </div>
                  {madeUpLine(lesson, finding, t) && (
                    <p className="mt-1 text-sm text-muted-foreground">{madeUpLine(lesson, finding, t)}</p>
                  )}
                  {decided && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {decided.amount === 0 ? t('teacherInsights.discipline.waivedBy', { name: decided.by ?? '' }) : t('teacherInsights.discipline.setBy', { name: decided.by ?? '' })}
                      {decided.note ? ` — ${decided.note}` : ''}
                    </p>
                  )}
                  {canDecide && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {finding.fine !== null && (
                        <Button size="sm" variant="outline" disabled={saving === key}
                                onClick={() => decide(lesson, finding, finding.fine || 0)}>
                          {t('teacherInsights.discipline.confirmAmount', { amount: money(finding.fine || 0) })}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={saving === key}
                              onClick={() => openDecision(lesson, finding, 'waive')}>{t('teacherInsights.discipline.waive')}</Button>
                      <Button size="sm" variant="outline" disabled={saving === key}
                              onClick={() => openDecision(lesson, finding, 'current')}>
                        {finding.kind === 'miss' ? t('teacherInsights.discipline.setAmount') : t('teacherInsights.discipline.changeAmount')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <DecisionDialog
        open={editing !== null}
        target={editing?.target ?? null}
        reasons={data?.reasons || []}
        saving={saving === (editing ? `${editing.lesson.event_id}-${editing.finding.kind}` : '')}
        onCancel={() => setEditing(null)}
        onSubmit={async (amount, reasonCode, note) => {
          if (!editing) return;
          await decide(editing.lesson, editing.finding, amount, reasonCode, note);
          setEditing(null);
        }}
      />
    </div>
  );
}

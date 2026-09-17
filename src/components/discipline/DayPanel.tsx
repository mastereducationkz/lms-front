import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

import { Button } from '../ui/button';
import { money } from '../../lib/discipline';
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

const KIND_TEXT: Record<string, string> = {
  late: 'Late',
  ended_early: 'Ended early',
  miss: 'Lesson not held',
};

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Almaty' }) : '—';

function madeUpLine(lesson: DisciplineLesson, finding: DisciplineFinding): string | null {
  if (finding.kind !== 'late' || !finding.made_up) return null;
  const minutes = Math.round(
    (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 60000);
  const stayed = lesson.students
    ? `, ${lesson.students_at_end} of ${lesson.students} students stayed to the end`
    : '';
  return `Made up: taught the full ${minutes} min${stayed}`;
}

export default function DayPanel({ teacherId, teacherName, day, canDecide, onClose, onChanged }: {
  teacherId: number;
  teacherName: string;
  day: string;
  canDecide: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<DisciplineDay | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setData(await getDay(teacherId, day));
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not load the day');
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
      setError(err?.response?.data?.detail || 'Could not save that');
    } finally {
      setSaving(null);
    }
  };

  const waive = (lesson: DisciplineLesson, finding: DisciplineFinding) => {
    const reasons = data?.reasons || [];
    const chosen = window.prompt(
      `Why is this waived?\n${reasons.map((r, i) => `${i + 1}. ${r.label}`).join('\n')}\n\nType a number, and a note after a space.`,
      '2');
    if (!chosen) return;
    const [index, ...rest] = chosen.trim().split(' ');
    const reason = reasons[Number(index) - 1];
    if (!reason) return;
    decide(lesson, finding, 0, reason.code, rest.join(' '));
  };

  const reprice = (lesson: DisciplineLesson, finding: DisciplineFinding) => {
    const current = finding.decision?.amount ?? finding.fine ?? 0;
    const answer = window.prompt('Amount in ₸ (0 waives it):', String(current));
    if (answer === null) return;
    const amount = Number(answer.replace(/\s/g, ''));
    if (Number.isNaN(amount) || amount < 0) return;
    decide(lesson, finding, amount, finding.decision?.reason_code, finding.decision?.note);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{teacherName}</h2>
          <p className="text-sm text-gray-500">{new Date(`${day}T00:00:00`).toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
      {!data && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}

      {data?.lessons.length === 0 && <p className="text-sm text-gray-500">No lessons that day.</p>}

      <div className="space-y-4">
        {data?.lessons.map((lesson) => (
          <div key={lesson.event_id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium">{lesson.group}</p>
              <p className="text-sm text-gray-500">{time(lesson.starts_at)}–{time(lesson.ends_at)}</p>
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {lesson.measurable
                ? <>joined {time(lesson.first_join)}, left {time(lesson.last_leave)}</>
                : <>no LMS Meet room — the LMS saw nothing and judges nothing</>}
            </p>

            {lesson.findings.length === 0 && lesson.measurable && (
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">On time, full lesson.</p>
            )}

            {lesson.findings.map((finding) => {
              const key = `${lesson.event_id}-${finding.kind}`;
              const decided = finding.decision;
              const owed = decided ? decided.amount : (finding.fine ?? null);
              return (
                <div key={key} className="mt-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800/60">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">
                      {KIND_TEXT[finding.kind]}
                      {finding.kind !== 'miss' && <> · {finding.minutes} min</>}
                    </p>
                    <p className="text-sm">
                      {owed === null ? <span className="text-amber-700 dark:text-amber-400">needs an amount</span> : money(owed)}
                    </p>
                  </div>
                  {madeUpLine(lesson, finding) && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{madeUpLine(lesson, finding)}</p>
                  )}
                  {decided && (
                    <p className="mt-1 text-xs text-gray-500">
                      {decided.amount === 0 ? 'Waived' : 'Set'} by {decided.by}
                      {decided.note ? ` — ${decided.note}` : ''}
                    </p>
                  )}
                  {canDecide && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {finding.fine !== null && (
                        <Button size="sm" variant="outline" disabled={saving === key}
                                onClick={() => decide(lesson, finding, finding.fine || 0)}>
                          Confirm {money(finding.fine || 0)}
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={saving === key}
                              onClick={() => waive(lesson, finding)}>Waive…</Button>
                      <Button size="sm" variant="outline" disabled={saving === key}
                              onClick={() => reprice(lesson, finding)}>
                        {finding.kind === 'miss' ? 'Set amount…' : 'Change amount…'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { registerChanges, scoreEditable } from '../../lib/classLessonPage';
import type { LessonView, RegisterStudent } from '../../services/api/classLessons';
import { SessionLost } from '../api';
import { lessons } from '../lessons';
import { panelLive } from '../live';
import { useScoreSuggestions } from '../../lib/liveLesson/useSuggestions';
import SuggestionBar from '../../components/live-lesson/SuggestionBar';

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MARK: Record<string, [string, string, string]> = {
  attended: ['Был', 'Present', 'text-emerald-700'],
  late: ['Опоздал', 'Late', 'text-amber-700'],
  missed: ['Не был', 'Absent', 'text-rose-700'],
  registered: ['Не отмечено', 'Not marked', 'text-slate-500'],
  cancelled: ['Отменён', 'Cancelled', 'text-slate-500'],
  removed: ['Снят с урока', 'Taken off', 'text-slate-500'],
};

/**
 * «Баллы за урок» from the side panel: the lesson page's scores, saved through the same
 * `PUT /events/{id}/activity-scores` and its rules (from the lesson's start, never on an absence).
 * Marks are shown, not edited: Meet takes the register.
 */
export default function ScoresCard({ view, onSaved }: { view: LessonView; onSaved: () => void }) {
  const ru = view.viewer.locale === 'ru';
  const t = (r: string, e: string) => (ru ? r : e);
  const [score, setScore] = useState<Map<number, number>>(new Map());
  const [picking, setPicking] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setScore(new Map()); }, [view.register]);
  const suggestions = useScoreSuggestions(panelLive, view.id,
    Boolean(view.viewer.can_score && (view.live_lesson?.activities ?? 0) >= 2), view.register);

  const students = useMemo(
    () => [...(view.register?.students ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ru')),
    [view.register],
  );
  const changes = registerChanges(students, { status: new Map(), score });
  const canScore = view.viewer.can_score;

  const choose = (s: RegisterStudent, value: number) => {
    setScore((prev) => {
      const next = new Map(prev);
      if (value === s.activity_score) next.delete(s.user_id); else next.set(s.user_id, value);
      return next;
    });
    setPicking(null);
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await lessons.saveScores(view.id, changes.scores);
      setMessage({ ok: true, text: t('Сохранено', 'Saved') });
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SessionLost ? t('Войдите снова', 'Sign in again') : (e as Error).message || t('Не удалось сохранить', 'Could not save') });
    } finally {
      setSaving(false);
    }
  };

  if (students.length === 0) {
    return <p className="text-xs text-slate-500">{t('В группе нет учеников.', 'No students in this group.')}</p>;
  }
  return (
    <div>
      {!canScore && (
        <p className="mb-2 text-[11px] text-slate-500">
          {view.status === 'upcoming'
            ? t('Баллы ставятся с начала урока.', 'Scores open when the lesson starts.')
            : t('Баллы ставит педагог, который ведёт урок.', 'Scores are given by the teacher of the lesson.')}
        </p>
      )}
      {canScore && (
        <SuggestionBar waiting={suggestions.waiting} busy={suggestions.busy} error={suggestions.error}
          onConfirm={() => void suggestions.confirm().then((ok) => { if (ok) onSaved(); })} />
      )}
      <ul className="divide-y divide-slate-100">
        {students.map((s) => {
          const value = score.get(s.user_id) ?? s.activity_score;
          const suggested = value == null ? suggestions.byUser.get(s.user_id) : undefined;
          const editable = scoreEditable(s, s.status, canScore);
          const mark = MARK[s.status] ?? MARK.registered;
          return (
            <li key={s.user_id} className={cn('py-1.5', s.state && 'opacity-60')}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[13px] text-slate-900">
                    {score.has(s.user_id) && <span className="h-1.5 w-1.5 flex-none rounded-full bg-blue-600" aria-label={t('Изменено', 'Changed')} />}
                    <span className="truncate">{s.name}</span>
                  </p>
                  <p className={cn('text-[11px]', mark[2])}>
                    {ru ? mark[0] : mark[1]}
                    {s.state === 'frozen' && ` · ${t('Заморозка', 'Frozen')}`}
                    {s.state === 'no_access' && ` · ${t('Нет доступа', 'No access')}`}
                  </p>
                  {suggested?.reason && <p className="truncate text-[11px] text-slate-500" title={suggested.reason}>{t('Предложено', 'Suggested')}: {suggested.reason}</p>}
                </div>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setPicking(picking === s.user_id ? null : s.user_id)}
                  className={cn(
                    'inline-flex h-7 min-w-[2.75rem] flex-none items-center justify-center gap-1 rounded-lg border px-1.5 text-xs font-bold tabular-nums',
                    value != null ? 'border-yellow-400 bg-yellow-400 text-slate-900'
                      : suggested ? 'border-dashed border-yellow-400 bg-yellow-50 text-slate-500' : 'border-slate-200 text-slate-400',
                    editable ? 'hover:bg-yellow-100' : 'cursor-default',
                  )}
                  aria-label={`${t('Балл за активность', 'Activity score')}: ${s.name}`}
                >
                  <Star className="h-3 w-3" aria-hidden />{value ?? suggested?.suggested ?? '—'}
                </button>
              </div>
              {picking === s.user_id && editable && (
                <div className="mt-1.5 grid grid-cols-6 gap-1" role="radiogroup" aria-label={t('Балл за активность', 'Activity score')}>
                  {SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={value === n}
                      onClick={() => choose(s, n)}
                      className={cn('h-7 rounded-md border text-xs font-semibold tabular-nums', value === n ? 'border-yellow-500 bg-yellow-400' : 'border-slate-200 hover:bg-slate-50')}
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
      {canScore && (
        <div className="mt-2 flex items-center justify-end gap-2">
          {message && <span className={cn('text-[11px]', message.ok ? 'text-emerald-700' : 'text-rose-700')}>{message.text}</span>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={changes.scores.length === 0 || saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('Сохранить', 'Save')}{changes.scores.length ? ` (${changes.scores.length})` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { registerChanges, scoreEditable } from '../../lib/classLessonPage';
import { t, type MessageKey } from '../../lib/i18n';
import type { LessonView, RegisterStudent } from '../../services/api/classLessons';
import { SessionLost } from '../api';
import { lessons } from '../lessons';
import { panelLive } from '../live';
import { useScoreSuggestions } from '../../lib/liveLesson/useSuggestions';
import SuggestionBar from '../../components/live-lesson/SuggestionBar';

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MARK: Record<string, [MessageKey, string]> = {
  attended: ['classLesson.mark.attended', 'text-emerald-700 dark:text-emerald-300'],
  late: ['classLesson.mark.late', 'text-amber-700 dark:text-amber-300'],
  missed: ['classLesson.mark.missed', 'text-rose-700 dark:text-rose-300'],
  registered: ['classLesson.mark.registered', 'text-muted-foreground'],
  cancelled: ['classLesson.mark.cancelled', 'text-muted-foreground'],
  removed: ['classLesson.mark.removed', 'text-muted-foreground'],
};

/**
 * «Баллы за урок» from the side panel: the lesson page's scores, saved through the same
 * `PUT /events/{id}/activity-scores` and its rules (from the lesson's start, never on an absence).
 * Marks are shown, not edited: Meet takes the register.
 */
export default function ScoresCard({ view, onSaved }: { view: LessonView; onSaved: () => void }) {
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
      setMessage({ ok: true, text: t('classLesson.saved') });
      onSaved();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof SessionLost ? t('classLesson.panel.signInAgain') : (e as Error).message || t('classLesson.saveFailed') });
    } finally {
      setSaving(false);
    }
  };

  if (students.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('classLesson.register.noStudents')}</p>;
  }
  return (
    <div>
      {!canScore && (
        <p className="mb-2 text-[11px] text-muted-foreground">
          {view.status === 'upcoming'
            ? t('classLesson.panel.scoresFromStart')
            : t('classLesson.panel.scoresByTeacher')}
        </p>
      )}
      {canScore && (
        <SuggestionBar waiting={suggestions.waiting} busy={suggestions.busy} error={suggestions.error}
          onConfirm={() => void suggestions.confirm().then((ok) => { if (ok) onSaved(); })} />
      )}
      <ul className="divide-y divide-border">
        {students.map((s) => {
          const value = score.get(s.user_id) ?? s.activity_score;
          const suggested = value == null ? suggestions.byUser.get(s.user_id) : undefined;
          const editable = scoreEditable(s, s.status, canScore);
          const mark = MARK[s.status] ?? MARK.registered;
          return (
            <li key={s.user_id} className={cn('py-1.5', s.state && 'opacity-60')}>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[13px] text-foreground">
                    {score.has(s.user_id) && <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand-solid" aria-label={t('classLesson.register.changed')} />}
                    <span className="truncate">{s.name}</span>
                  </p>
                  <p className={cn('text-[11px]', mark[1])}>
                    {t(mark[0])}
                    {s.state === 'frozen' && ` · ${t('classLesson.register.frozen')}`}
                    {s.state === 'no_access' && ` · ${t('classLesson.register.noAccess')}`}
                  </p>
                  {suggested?.reason && <p className="truncate text-[11px] text-muted-foreground" title={suggested.reason}>{t('classLesson.panel.suggestedReason', { reason: suggested.reason })}</p>}
                </div>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setPicking(picking === s.user_id ? null : s.user_id)}
                  className={cn(
                    'inline-flex h-7 min-w-[2.75rem] flex-none items-center justify-center gap-1 rounded-lg border px-1.5 text-xs font-bold tabular-nums',
                    value != null ? 'border-yellow-400 bg-yellow-400 text-yellow-950'
                      : suggested ? 'border-dashed border-yellow-400 bg-yellow-50 dark:bg-yellow-500/15 text-muted-foreground' : 'border-border text-muted-foreground',
                    editable ? 'hover:bg-yellow-100 dark:hover:bg-yellow-500/20' : 'cursor-default',
                  )}
                  aria-label={t('classLesson.panel.scoreFor', { name: s.name })}
                >
                  <Star className="h-3 w-3" aria-hidden />{value ?? suggested?.suggested ?? '—'}
                </button>
              </div>
              {picking === s.user_id && editable && (
                <div className="mt-1.5 grid grid-cols-6 gap-1" role="radiogroup" aria-label={t('classLesson.activityScore')}>
                  {SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={value === n}
                      onClick={() => choose(s, n)}
                      className={cn('h-7 rounded-md border text-xs font-semibold tabular-nums', value === n ? 'border-yellow-500 bg-yellow-400' : 'border-border hover:bg-muted')}
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
          {message && <span className={cn('text-[11px]', message.ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300')}>{message.text}</span>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={changes.scores.length === 0 || saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-solid px-3 py-1 text-xs font-semibold text-white transition hover:bg-brand-solid-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('common.save')}{changes.scores.length ? ` (${changes.scores.length})` : ''}
          </button>
        </div>
      )}
    </div>
  );
}

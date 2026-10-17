import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, Pencil, Save, Star } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from '../Toast';
import { verdictHint, verdictText } from '../../lib/meetAttendance';
import { overridesToAsk, reasonPayload, registerNote, type OverrideAsk, type OverrideReason } from '../../lib/meetRegister';
import {
  markEditable, registerChanges, registerSummary, scoreEditable, summaryLine,
} from '../../lib/classLessonPage';
import { OverrideReasonsDialog } from '../meetAttendance/OverrideReasonsDialog';
import { MeetMarkForm } from '../attendance/MeetMarkForm';
import { HeldBackButton, PendingExcuseDot } from '../attendance/CellLockParts';
import { cellLock, handedBack, heldBack, lessonLock, lessonMinutes, lockedTitle, type MarkChange } from '../../lib/registerLock';
import { getMeetRecord, type MeetReviewOptions } from '../../services/api/meetAttendance';
import { saveActivityScores, updateEventAttendance } from '../../services/api/events';
import type { StudentRegister } from '../../services/api/meetRegister';
import type { LessonView, RegisterStudent, UiMark } from '../../services/api/classLessons';
import type { AttendanceRecord } from '../../types';
import { useScoreSuggestions } from '../../lib/liveLesson/useSuggestions';
import type { MessageKey } from '../../lib/i18n';
import { useLocale, useT } from '../../lib/i18n/react';
import { live } from '../../services/api/liveLesson';
import SuggestionBar from '../live-lesson/SuggestionBar';
import '@/lib/i18n/catalogs/attendance';
import '@/lib/i18n/catalogs/classLesson';

const MARKS: { key: UiMark; tone: string }[] = [
  { key: 'attended', tone: 'bg-emerald-600 text-white border-emerald-600' },
  { key: 'late', tone: 'bg-amber-500 text-white border-amber-500' },
  { key: 'missed', tone: 'bg-rose-600 text-white border-rose-600' },
];
const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const LABEL: Record<string, MessageKey> = {
  attended: 'classLesson.mark.attended', late: 'classLesson.mark.late', missed: 'classLesson.mark.missed',
  registered: 'classLesson.mark.registered', cancelled: 'classLesson.mark.cancelled', removed: 'classLesson.mark.removed',
};

interface Props {
  view: LessonView;
  /** The group the header is showing; with several groups the list narrows to it. */
  groupId: number | null;
  onSaved: () => void;
}

/**
 * The lesson's register on one screen (owner, 2026-09-28): Meet's marks with the reason a person gave
 * for changing one, and the баллы за активность — what a teacher does right after a lesson, on a phone,
 * without the week-wide journal. Saves through the journal's own endpoints and rules. Under the register
 * lock (2026-10-17) a row is Meet's — `pending` until it decides (only an advance excuse), `meet` once it
 * has («Исправить» opens its evidence, the new mark and a reason) — and the teacher's where Meet handed
 * the student back. Without a lock (an older server) a change that contradicts Meet asks for a reason once,
 * at «Сохранить». Scores go separately and never onto an absence. Curators read.
 */
export default function RegisterSection({ view, groupId, onSaved }: Props) {
  const t = useT();
  const locale = useLocale();
  const register = view.register;
  const [status, setStatus] = useState<Map<number, UiMark>>(new Map());
  const [score, setScore] = useState<Map<number, number>>(new Map());
  const [reasons, setReasons] = useState<Map<string, OverrideReason>>(new Map());
  const [ask, setAsk] = useState<OverrideAsk[] | null>(null);
  const [options, setOptions] = useState<MeetReviewOptions>({});
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [excuse, setExcuse] = useState<Map<number, { excused: boolean; note: string | null }>>(new Map());
  const [correcting, setCorrecting] = useState<number | null>(null);
  const lock = lessonLock(view);
  const canMarkRows = view.viewer.can_mark;

  // A fresh payload (after a save, or the minute poll) is the new baseline.
  useEffect(() => { setStatus(new Map()); setScore(new Map()); setReasons(new Map()); setExcuse(new Map()); setCorrecting(null); }, [register]);

  // The presets «Исправить» offers come with Meet's record; read once a decided lesson can be corrected.
  useEffect(() => {
    if (!canMarkRows || lock?.state !== 'decided') return;
    let cancelled = false;
    getMeetRecord(view.id)
      .then((record) => { if (!cancelled) setOptions(record?.review_options ?? {}); })
      .catch(() => { /* the form still offers «Другое» */ });
    return () => { cancelled = true; };
  }, [view.id, canMarkRows, lock?.state]);

  // The live page's suggestions (two or more questions ran); shown faded until confirmed.
  const suggestions = useScoreSuggestions(live, view.id,
    Boolean(view.viewer.can_score && (view.live_lesson?.activities ?? 0) >= 2), register);

  const students = useMemo(() => {
    const all = register?.students ?? [];
    const narrowed = groupId != null && view.groups.length > 1 ? all.filter((s) => s.group_id === groupId) : all;
    return [...narrowed].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [register, groupId, view.groups.length]);

  if (!register) return null;
  const canMark = view.viewer.can_mark;
  const canScore = view.viewer.can_score;
  const current = (s: RegisterStudent): UiMark => (excuse.get(s.user_id)?.excused ? 'missed' : status.get(s.user_id) ?? s.status);
  const currentScore = (s: RegisterStudent): number | null => score.get(s.user_id) ?? s.activity_score;
  const changes = registerChanges(students, { status, score, excuse });
  const length = lessonMinutes(view.start, view.end);
  const dirty = changes.marks.length + changes.scores.length > 0;
  const summary = registerSummary(students.map((s) => ({ status: current(s), activity_score: currentScore(s), state: s.state })));

  const setMark = (s: RegisterStudent, mark: UiMark) => setStatus((prev) => {
    const next = new Map(prev);
    if (mark === s.status) next.delete(s.user_id); else next.set(s.user_id, mark);
    return next;
  });
  const setStudentScore = (s: RegisterStudent, value: number) => {
    setScore((prev) => {
      const next = new Map(prev);
      if (value === s.activity_score) next.delete(s.user_id); else next.set(s.user_id, value);
      return next;
    });
    setPicking(null);
  };
  // A correction of Meet's mark: the new mark, its excuse and the reason that goes with it.
  const applyChange = (s: RegisterStudent, change: MarkChange) => {
    setMark(s, change.status);
    setExcuse((prev) => {
      const next = new Map(prev);
      if (change.status === 'missed') next.set(s.user_id, { excused: change.excused, note: change.note }); else next.delete(s.user_id);
      return next;
    });
    setReasons((prev) => new Map(prev).set(`${s.user_id}:${view.id}`, change.reason));
    setCorrecting(null);
  };

  const save = async (given?: Map<string, OverrideReason>) => {
    const known = given ?? reasons;
    const lessonKey = String(view.id);
    const meetIndex = new Map<string, StudentRegister>();
    for (const s of students) if (s.meet?.register) meetIndex.set(`${view.id}:${s.user_id}`, s.meet.register);
    const changedIds = new Set(changes.marks.map((m) => m.student_id));
    const journal = students.map((s) => ({
      student_id: s.user_id, student_name: s.name,
      lessons: { [lessonKey]: { attendance_status: current(s), event_id: view.id } },
    }));
    const pending = overridesToAsk(journal, changedIds, meetIndex, known, () => t('classLesson.register.thisLesson'));
    if (pending.length > 0) {
      try {
        const record = await getMeetRecord(view.id);
        setOptions(record?.review_options ?? {});
      } catch { setOptions({}); }
      setAsk(pending);
      return;
    }
    setSaving(true);
    try {
      if (changes.marks.length) {
        const attendance = changes.marks.map((m) => ({
          ...m, ...reasonPayload(known.get(`${m.student_id}:${lessonKey}`)),
        })) as AttendanceRecord[];
        await updateEventAttendance(view.id, { attendance });
      }
      if (changes.scores.length) await saveActivityScores(view.id, changes.scores);
      toast(t('classLesson.saved'), 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message || t('classLesson.saveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{summaryLine(summary, locale)}</p>
        {(canMark || canScore) && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('common.save')}{dirty ? ` (${changes.marks.length + changes.scores.length})` : ''}
          </button>
        )}
      </div>
      {canScore && (
        <SuggestionBar waiting={suggestions.waiting} busy={suggestions.busy} error={suggestions.error}
          onConfirm={() => void suggestions.confirm().then((ok) => { if (ok) onSaved(); })} />
      )}
      {lock?.state === 'pending' && (
        <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t('classLesson.register.pendingNote')}</p>
      )}
      {register.mode === 'live' && register.meet_decided && (
        <p className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          {t(lock ? 'classLesson.register.meetDecided' : 'classLesson.register.meetDecidedAsked')}
        </p>
      )}
      {canMark && students.some((s) => markEditable(s, canMark) && !s.marked && handedBack(lock, s.meet?.register)) && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {t('classLesson.register.handedBackNote')}
        </p>
      )}
      {students.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t('classLesson.register.noStudents')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {students.map((s) => {
            const mark = current(s);
            const editable = markEditable(s, canMark);
            // The register lock: Meet's rows are Meet's; a person's stay open and, handed back, are asked for.
            const rowLock = editable ? cellLock(lock, s.meet?.register) : 'open';
            const handedBackRow = editable && !s.marked && handedBack(lock, s.meet?.register);
            const excusedNow = excuse.get(s.user_id)?.excused ?? s.excused;
            const noteNow = excuse.has(s.user_id) ? excuse.get(s.user_id)!.note : s.excuse_note;
            const scoring = scoreEditable(s, mark, canScore);
            const value = currentScore(s);
            const suggested = value == null ? suggestions.byUser.get(s.user_id) : undefined;
            const meetTitle = s.meet
              ? [verdictHint({ held_back: Boolean(s.meet.held_back) }, locale), registerNote(s.meet.register ?? undefined, locale)].filter(Boolean).join('\n')
              : '';
            const changed = status.has(s.user_id) || score.has(s.user_id) || excuse.has(s.user_id);
            return (
              <li key={s.user_id} className={cn('relative py-2.5', s.state && 'opacity-60', handedBackRow && 'rounded-lg bg-amber-50/70 px-2 dark:bg-amber-950/20')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1 basis-40">
                    <div className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      {changed && <span className="h-1.5 w-1.5 flex-none rounded-full bg-primary" aria-label={t('classLesson.register.changed')} />}
                      <span className="truncate">{s.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      {suggested?.reason && <span title={suggested.reason}>{t('classLesson.register.suggested', { score: suggested.suggested ?? '', reason: suggested.reason })}</span>}
                      {s.state === 'frozen' && <span>{t('classLesson.register.frozen')}</span>}
                      {s.state === 'no_access' && <span>{t('classLesson.register.noAccess')}</span>}
                      {handedBackRow && <span className="font-semibold text-amber-700 dark:text-amber-300">{t('classLesson.register.handedBack')}</span>}
                      {handedBackRow && heldBack(s.meet?.register) && (
                        <HeldBackButton
                          eventId={view.id}
                          className="font-semibold text-amber-800 underline hover:text-amber-900 dark:text-amber-300"
                          onByHand={() => setMark(s, 'attended')}
                          onNamed={onSaved}
                        />
                      )}
                      {excusedNow && <span className="rounded bg-sky-100 px-1 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" title={noteNow ?? undefined}>{noteNow ? t('classLesson.register.excusedWithNote', { note: noteNow }) : t('classLesson.register.excused')}</span>}
                      {s.meet && (
                        <span title={meetTitle || undefined}>
                          Meet: {verdictText({ verdict: s.meet.verdict as never, minutes: s.meet.minutes ?? 0, required: s.meet.required ?? 0, late_minutes: s.meet.late_minutes ?? 0 }, locale)}
                          {s.meet.register?.state === 'override' && s.meet.register.override?.reason_label ? (
                            <>
                              {' · '}
                              <Pencil className="inline h-3 w-3 align-[-1px]" aria-label={t('classLesson.register.changedByHand')} />{' '}
                              {s.meet.register.override.reason_label}
                            </>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>
                  {rowLock === 'meet' ? (
                    <div className="flex flex-none items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground"
                        title={lockedTitle(mark, s.meet?.register, length, lock?.may_override !== false, locale)}
                      >
                        <Lock className="h-3 w-3 text-muted-foreground" aria-label={t('attendance.lock.lockedAria')} />
                        {LABEL[mark] ? t(LABEL[mark]) : mark}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCorrecting(correcting === s.user_id ? null : s.user_id)}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        {t('classLesson.register.correct')}
                      </button>
                    </div>
                  ) : rowLock === 'pending' ? (
                    <div className="flex flex-none items-center gap-2">
                      {mark === 'registered' ? (
                        <span className="text-xs text-muted-foreground" title={t('attendance.lock.pendingTitle')}>{t('classLesson.register.pending')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground" title={t('attendance.lock.pendingTitle')}>
                          <Lock className="h-3 w-3 text-muted-foreground" aria-label={t('attendance.lock.lockedAria')} />
                          {LABEL[mark] ? t(LABEL[mark]) : mark}
                        </span>
                      )}
                      {!excusedNow && (mark === 'registered' || mark === 'missed') && (
                        <PendingExcuseDot
                          label={t('classLesson.register.excuse')}
                          className="text-xs font-semibold text-brand hover:underline"
                          onExcuse={(excused, note) => setExcuse((prev) => new Map(prev).set(s.user_id, { excused, note }))}
                        />
                      )}
                    </div>
                  ) : editable ? (
                    <div className="flex flex-none overflow-hidden rounded-lg border border-border" role="radiogroup" aria-label={s.name}>
                      {MARKS.map((m) => (
                        <button
                          key={m.key}
                          type="button"
                          role="radio"
                          aria-checked={mark === m.key}
                          onClick={() => setMark(s, m.key)}
                          className={cn('px-2.5 py-1.5 text-xs font-semibold transition', mark === m.key ? m.tone : 'bg-card text-foreground hover:bg-muted')}
                        >
                          {t(LABEL[m.key])}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="flex-none rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground">
                      {LABEL[mark] ? t(LABEL[mark]) : mark}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!scoring}
                    onClick={() => setPicking(picking === s.user_id ? null : s.user_id)}
                    className={cn(
                      'inline-flex h-8 min-w-[3rem] flex-none items-center justify-center gap-1 rounded-lg border px-2 text-xs font-bold tabular-nums transition',
                      value != null ? 'border-yellow-400 bg-yellow-400 text-gray-900'
                        : suggested ? 'border-dashed border-yellow-400 bg-yellow-400/20 text-muted-foreground' : 'border-border text-muted-foreground',
                      scoring ? 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30' : 'cursor-default',
                      scoring && value == null && (mark === 'attended' || mark === 'late') && 'border-amber-400 text-amber-700 dark:text-amber-300',
                    )}
                    title={t('classLesson.activityScore')}
                    aria-label={t('classLesson.activityScore')}
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden />
                    {value ?? suggested?.suggested ?? '—'}
                  </button>
                </div>
                {correcting === s.user_id && rowLock === 'meet' && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
                    <MeetMarkForm
                      current={{ status: mark, excused: Boolean(excusedNow), note: noteNow }}
                      register={s.meet?.register ?? undefined}
                      lessonMinutes={length}
                      lock={lock}
                      options={options}
                      onApply={(change) => applyChange(s, change)}
                      onCancel={() => setCorrecting(null)}
                    />
                  </div>
                )}
                {picking === s.user_id && scoring && (
                  <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={t('classLesson.activityScore')}>
                    {SCORES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={value === n}
                        onClick={() => setStudentScore(s, n)}
                        className={cn('h-8 w-8 rounded-md border text-xs font-semibold tabular-nums', value === n ? 'border-yellow-500 bg-yellow-400 text-gray-900' : 'border-border bg-card hover:bg-muted')}
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
      <OverrideReasonsDialog
        open={ask !== null}
        items={ask ?? []}
        options={options}
        onCancel={() => setAsk(null)}
        onConfirm={(given) => {
          const merged = new Map(reasons);
          given.forEach((reason, key) => merged.set(key, reason));
          setReasons(merged);
          setAsk(null);
          void save(merged);
        }}
      />
    </div>
  );
}

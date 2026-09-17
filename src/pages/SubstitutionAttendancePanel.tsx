import { useEffect, useMemo, useState } from 'react';
import { Loader2, Star, Video, MapPin, Lock, CalendarClock, Repeat, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '../components/ui/dialog';
import { getMySubstitutions, getEventParticipants, updateEventAttendance } from '../services/api';
import { SubstitutionLesson, EventStudent } from '../types';
import { isAttendanceLockedLesson } from '../lib/attendance';
import { parseAsUTC } from '../lib/datetime';
import { cn } from '../lib/utils';
import { canBeExcused, excusePayload, isAbsenceStatus } from '../lib/excusedAbsence';
import { ExcusePopover } from '../components/attendance/ExcusePopover';

// UI statuses. `registered` (from the API) == unmarked; we display it as "-".
const STATUS_NEXT: Record<string, string> = {
  registered: 'attended',
  pending: 'attended',
  attended: 'late',
  late: 'missed',
  missed: 'attended',
};

// `excused` takes only "missed": it's an overlay on that one status, not a status of
// its own — matches CuratorLeaderboardPage's AttendanceToggle. A second optional
// argument disturbs the existing call sites less than branching there instead, since
// both callers already have `s.excused` sitting right next to `s.attendance_status`.
function statusColor(status: string, excused = false) {
  if (status === 'missed' && excused) return 'bg-rose-200 text-rose-900 dark:bg-rose-300 dark:text-rose-950';
  switch (status) {
    case 'attended': return 'bg-green-200 dark:bg-green-900/40 text-green-700 dark:text-green-400';
    case 'late': return 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
    case 'missed': return 'bg-rose-500 dark:bg-rose-900/50 text-white dark:text-rose-400';
    default: return 'bg-gray-100 dark:bg-secondary text-gray-400';
  }
}

function statusLabel(status: string, excused = false) {
  if (status === 'missed' && excused) return 'Exc.';
  switch (status) {
    case 'attended': return 'Present';
    case 'late': return 'Late';
    case 'missed': return 'Absent';
    default: return '-';
  }
}

function formatDateTime(iso: string) {
  const dt = parseAsUTC(iso);
  return dt.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Almaty',
  });
}

export default function SubstitutionAttendancePanel() {
  const [lessons, setLessons] = useState<SubstitutionLesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Roster dialog state
  const [openLesson, setOpenLesson] = useState<SubstitutionLesson | null>(null);
  const [roster, setRoster] = useState<EventStudent[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // student_id whose excuse the substitute actually edited this dialog session. This
  // panel resends the whole roster on every save (see `save` below), so without this
  // set the payload would carry `excused`/`excuse_note` for every row — including ones
  // nobody touched — and one "Save" would erase reasons someone else recorded.
  const [touchedExcuses, setTouchedExcuses] = useState<Set<number>>(new Set());
  // student_id whose excuse popover is currently open (one at a time; the row markup
  // is a flat list, not a self-contained component per Task 3's AttendanceToggle).
  const [excusePopoverFor, setExcusePopoverFor] = useState<number | null>(null);

  // Activity score modal state
  const [activityModal, setActivityModal] = useState<{
    open: boolean; studentId: number | null; studentName: string; currentScore: number;
  }>({ open: false, studentId: null, studentName: '', currentScore: 0 });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLessons(await getMySubstitutions());
      } catch (err) {
        console.error('Failed to load substitutions:', err);
        toast.error('Failed to load substitutions');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openRoster = async (lesson: SubstitutionLesson) => {
    setOpenLesson(lesson);
    setRoster([]);
    setTouchedExcuses(new Set());
    setExcusePopoverFor(null);
    setRosterLoading(true);
    try {
      const students = await getEventParticipants(lesson.event_id, lesson.group_id);
      setRoster(students);
    } catch (err) {
      console.error('Failed to load roster:', err);
      toast.error('Failed to load students');
    } finally {
      setRosterLoading(false);
    }
  };

  const closeRoster = () => {
    setOpenLesson(null);
    setRoster([]);
    setTouchedExcuses(new Set());
    setExcusePopoverFor(null);
  };

  const cycleStatus = (studentId: number) => {
    let clearedStoredExcuse = false;
    setRoster(prev => prev.map(s => {
      if (s.student_id !== studentId) return s;
      const nextStatus = STATUS_NEXT[s.attendance_status] ?? 'attended';
      // A status that no longer means "absent" can't carry an excuse locally either —
      // otherwise cycling missed->attended within this session would leave `excused:
      // true` sitting on an "attended" row, and if that row is later touched again it
      // would go out as `{status: 'attended', excused: true}`, which the backend
      // rejects (422, whole batch, names nobody). Mirrors CuratorLeaderboardPage.
      const clearsExcuse = !isAbsenceStatus(nextStatus);
      // Cycling missed -> attended -> late -> missed is the natural way to "remove" an
      // excuse without opening the popover. If a *stored* excuse (already true) is
      // being cleared here, that's a real edit — mark it touched below so the save
      // actually sends `excused: false` instead of silently leaving the old value
      // (and the billing decision keyed on it) on the server.
      if (clearsExcuse && s.excused) clearedStoredExcuse = true;
      return {
        ...s,
        attendance_status: nextStatus,
        ...(clearsExcuse ? { excused: false, excuse_note: null } : {}),
      };
    }));
    if (clearedStoredExcuse) {
      setTouchedExcuses(prev => new Set(prev).add(studentId));
    }
  };

  const setActivity = (studentId: number, score: number) => {
    setRoster(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, activity_score: score } : s
    ));
  };

  const markAllPresent = () => {
    // Same reasoning as `cycleStatus`: any row whose stored excuse (already true) is
    // being wiped by this bulk action is a real edit to that row's excuse and must be
    // marked touched, or the save omits `excused` for it and the old value survives.
    const clearedIds = roster.filter(s => s.excused).map(s => s.student_id);
    setRoster(prev => prev.map(s => ({ ...s, attendance_status: 'attended', excused: false, excuse_note: null })));
    if (clearedIds.length) {
      setTouchedExcuses(prev => {
        const next = new Set(prev);
        clearedIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleExcuseChange = (studentId: number, excused: boolean, note: string | null) => {
    setRoster(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, excused, excuse_note: note } : s
    ));
    setTouchedExcuses(prev => new Set(prev).add(studentId));
  };

  const save = async () => {
    if (!openLesson) return;
    setSaving(true);
    try {
      const attendance = roster
        .filter(s => ['attended', 'late', 'missed'].includes(s.attendance_status))
        .map(s => ({
          student_id: s.student_id,
          status: s.attendance_status,
          activity_score: (s.attendance_status === 'attended' || s.attendance_status === 'late') ? s.activity_score : 0,
          // Present only for rows the substitute actually touched this session — see
          // `touchedExcuses` above. An absent field means "leave the stored value
          // alone" server-side; this panel resends every row on every save.
          ...excusePayload(touchedExcuses.has(s.student_id), Boolean(s.excused), s.excuse_note ?? null),
        }));
      await updateEventAttendance(openLesson.event_id, { attendance });
      toast.success('Attendance saved');
      closeRoster();
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      // A validation failure (e.g. an excuse without a reason) comes back as a Russian
      // 422 detail from the backend — `err.message` already carries it (see
      // updateEventAttendance in services/api/events.ts), so show it verbatim.
      toast.error(err?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  // Group by actionability: past-unmarked lessons need attention, upcoming ones
  // are locked, already-marked ones are done. This is the point of the tab.
  const sections = useMemo(() => {
    const desc = (a: SubstitutionLesson, b: SubstitutionLesson) =>
      parseAsUTC(b.start_datetime).getTime() - parseAsUTC(a.start_datetime).getTime();
    const asc = (a: SubstitutionLesson, b: SubstitutionLesson) =>
      parseAsUTC(a.start_datetime).getTime() - parseAsUTC(b.start_datetime).getTime();
    const needsMarking: SubstitutionLesson[] = [];
    const upcoming: SubstitutionLesson[] = [];
    const marked: SubstitutionLesson[] = [];
    for (const l of lessons) {
      if (isAttendanceLockedLesson(l.start_datetime)) upcoming.push(l);
      else if (l.marked) marked.push(l);
      else needsMarking.push(l);
    }
    needsMarking.sort(desc);
    upcoming.sort(asc); // soonest upcoming first
    marked.sort(desc);
    return { needsMarking, upcoming, marked };
  }, [lessons]);

  const renderCard = (lesson: SubstitutionLesson) => {
    const locked = isAttendanceLockedLesson(lesson.start_datetime);
    // The auto-title carries "... : Lesson N" — surface just the lesson label and
    // lead with the real group name so it's clear whose class this is.
    const lessonSuffix = lesson.title.includes(':') ? lesson.title.split(':').pop()!.trim() : '';
    const primary = lessonSuffix ? `${lesson.group_name} · ${lessonSuffix}` : lesson.group_name;
    return (
      <div
        key={lesson.event_id}
        className={cn(
          'flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors',
          'border-gray-200 dark:border-border bg-white dark:bg-card',
          !locked && 'hover:bg-gray-50 dark:hover:bg-secondary cursor-pointer',
          lesson.marked && 'opacity-70'
        )}
        onClick={() => !locked && openRoster(lesson)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
              {primary}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
              <Repeat className="w-3 h-3" /> Substitution
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-gray-600 dark:text-gray-300">
              Covering for {lesson.original_teacher_name || '—'}
            </span>
            <span>{formatDateTime(lesson.start_datetime)}</span>
            <span className="flex items-center gap-1">
              {lesson.is_online
                ? <Video className="w-3.5 h-3.5" />
                : <MapPin className="w-3.5 h-3.5" />}
              {lesson.is_online ? 'Online' : (lesson.location || 'In person')}
            </span>
          </div>
        </div>
        {locked ? (
          <span className="flex items-center gap-1 text-xs font-medium text-gray-400 shrink-0">
            <Lock className="w-3.5 h-3.5" /> Upcoming
          </span>
        ) : lesson.marked ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">
            <Check className="w-3.5 h-3.5" /> Marked
          </span>
        ) : (
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
            Mark attendance
          </span>
        )}
      </div>
    );
  };

  const renderSection = (label: string, items: SubstitutionLesson[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</h3>
          <span className="text-xs text-gray-400">{items.length}</span>
        </div>
        <div className="space-y-2">{items.map(renderCard)}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (lessons.length === 0) {
    return (
      <div className="py-24 text-center text-gray-500 dark:text-gray-400">
        <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">You have no substitution lessons.</p>
        <p className="text-sm mt-1">Lessons you're covering for another teacher will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection('Needs marking', sections.needsMarking)}
      {renderSection('Upcoming', sections.upcoming)}
      {renderSection('Marked', sections.marked)}

      {/* Roster dialog */}
      <Dialog open={!!openLesson} onOpenChange={(o) => !o && closeRoster()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {openLesson?.group_name} · {openLesson && formatDateTime(openLesson.start_datetime)}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2">
            {rosterLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : roster.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">No students in this group.</p>
            ) : (
              <>
                <div className="flex justify-end mb-2">
                  <button
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={markAllPresent}
                  >
                    Mark all present
                  </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 dark:divide-border">
                  {roster.map(s => {
                    // The dialog itself never opens for a locked (future) lesson — see the
                    // card's onClick guard above — so this is always false in practice.
                    // Passed explicitly anyway rather than assumed, since `canBeExcused`
                    // is exactly the function that answers "is this a real absence to
                    // excuse", not just "is the status missed".
                    const lessonIsFuture = openLesson ? isAttendanceLockedLesson(openLesson.start_datetime) : false;
                    const showExcuseAffordance = canBeExcused(s.attendance_status, lessonIsFuture);
                    return (
                    <div key={s.student_id} className="flex items-center justify-between gap-3 py-2">
                      <span className="text-sm text-gray-900 dark:text-foreground truncate">{s.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {(s.attendance_status === 'attended' || s.attendance_status === 'late') && (
                          <button
                            className="flex items-center gap-0.5 text-xs"
                            onClick={() => setActivityModal({
                              open: true, studentId: s.student_id, studentName: s.name,
                              currentScore: s.activity_score || 0,
                            })}
                            title="Set activity score"
                          >
                            <Star className={cn(
                              'w-3.5 h-3.5',
                              s.activity_score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
                            )} />
                            <span className={cn('text-[10px]', s.activity_score ? 'text-yellow-600' : 'text-gray-400')}>
                              {s.activity_score || '+'}
                            </span>
                          </button>
                        )}
                        {/* `relative` here (not on the row) is the popover's anchor: the
                            corner marker and ExcusePopover position against this box, not
                            the whole roster row, so they sit right under the status pill. */}
                        <div className="relative">
                          <button
                            className={cn(
                              'w-20 rounded-md py-1 text-xs font-bold',
                              statusColor(s.attendance_status, Boolean(s.excused))
                            )}
                            onClick={() => cycleStatus(s.student_id)}
                          >
                            {statusLabel(s.attendance_status, Boolean(s.excused))}
                          </button>
                          {showExcuseAffordance && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setExcusePopoverFor(s.student_id); }}
                              className={cn(
                                'absolute left-0.5 bottom-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-white dark:ring-card pointer-events-auto',
                                s.excused ? 'bg-rose-600' : 'bg-transparent border border-white/80'
                              )}
                              title={s.excused
                                ? `Excused absence${s.excuse_note ? `: ${s.excuse_note}` : ''} — click to edit`
                                : 'Mark this absence as excused'}
                              aria-label={s.excused ? 'Excused absence, edit reason' : 'Mark absence as excused'}
                            />
                          )}
                          {excusePopoverFor === s.student_id && (
                            <ExcusePopover
                              excused={Boolean(s.excused)}
                              note={s.excuse_note ?? null}
                              onSave={(note) => { handleExcuseChange(s.student_id, true, note); setExcusePopoverFor(null); }}
                              onClear={() => { handleExcuseChange(s.student_id, false, null); setExcusePopoverFor(null); }}
                              onClose={() => setExcusePopoverFor(null)}
                              // This panel is English throughout — «Present», «Absent»,
                              // «Mark attendance», «Save» — because it is the substitute
                              // teachers' screen. Without this the reason form would be the
                              // one Russian island on it.
                              en
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeRoster} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving || rosterLoading || roster.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity score modal */}
      <Dialog
        open={activityModal.open}
        onOpenChange={(o) => !o && setActivityModal(prev => ({ ...prev, open: false }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activity Score</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Set activity score for <strong>{activityModal.studentName}</strong>
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                <Button
                  key={score}
                  variant={activityModal.currentScore === score ? 'default' : 'outline'}
                  size="sm"
                  className={cn('w-10 h-10', activityModal.currentScore === score && 'bg-yellow-500 hover:bg-yellow-600')}
                  onClick={() => setActivityModal(prev => ({ ...prev, currentScore: score }))}
                >
                  {score}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivityModal({ open: false, studentId: null, studentName: '', currentScore: 0 })}
            >
              Cancel
            </Button>
            <Button
              className="bg-yellow-500 hover:bg-yellow-600"
              onClick={() => {
                if (activityModal.studentId != null) setActivity(activityModal.studentId, activityModal.currentScore);
                setActivityModal({ open: false, studentId: null, studentName: '', currentScore: 0 });
              }}
            >
              Save Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

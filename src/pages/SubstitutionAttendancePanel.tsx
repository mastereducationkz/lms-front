import { useEffect, useMemo, useState } from 'react';
import { Loader2, Star, Video, MapPin, Lock, CalendarClock } from 'lucide-react';
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

// UI statuses. `registered` (from the API) == unmarked; we display it as "-".
const STATUS_NEXT: Record<string, string> = {
  registered: 'attended',
  pending: 'attended',
  attended: 'late',
  late: 'missed',
  missed: 'attended',
};

function statusColor(status: string) {
  switch (status) {
    case 'attended': return 'bg-green-200 dark:bg-green-900/40 text-green-700 dark:text-green-400';
    case 'late': return 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400';
    case 'missed': return 'bg-rose-500 dark:bg-rose-900/50 text-white dark:text-rose-400';
    default: return 'bg-gray-100 dark:bg-secondary text-gray-400';
  }
}

function statusLabel(status: string) {
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
  };

  const cycleStatus = (studentId: number) => {
    setRoster(prev => prev.map(s =>
      s.student_id === studentId
        ? { ...s, attendance_status: STATUS_NEXT[s.attendance_status] ?? 'attended' }
        : s
    ));
  };

  const setActivity = (studentId: number, score: number) => {
    setRoster(prev => prev.map(s =>
      s.student_id === studentId ? { ...s, activity_score: score } : s
    ));
  };

  const markAllPresent = () => {
    setRoster(prev => prev.map(s => ({ ...s, attendance_status: 'attended' })));
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
          activity_score: s.activity_score,
        }));
      await updateEventAttendance(openLesson.event_id, { attendance });
      toast.success('Attendance saved');
      closeRoster();
    } catch (err: any) {
      console.error('Failed to save attendance:', err);
      toast.error(err?.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const sortedLessons = useMemo(
    () => [...lessons].sort((a, b) =>
      parseAsUTC(b.start_datetime).getTime() - parseAsUTC(a.start_datetime).getTime()
    ),
    [lessons]
  );

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (sortedLessons.length === 0) {
    return (
      <div className="py-24 text-center text-gray-500 dark:text-gray-400">
        <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">You have no substitution lessons.</p>
        <p className="text-sm mt-1">Lessons you're covering for another teacher will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-3">
      {sortedLessons.map(lesson => {
        const locked = isAttendanceLockedLesson(lesson.start_datetime);
        return (
          <div
            key={lesson.event_id}
            className={cn(
              'flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors',
              'border-gray-200 dark:border-border bg-white dark:bg-card',
              !locked && 'hover:bg-gray-50 dark:hover:bg-secondary cursor-pointer'
            )}
            onClick={() => !locked && openRoster(lesson)}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                  {lesson.title}
                </span>
                {lesson.topic && (
                  <span className="text-xs text-muted-foreground truncate">· {lesson.topic}</span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{lesson.group_name}</span>
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
                <Lock className="w-3.5 h-3.5" /> Future
              </span>
            ) : (
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                Mark attendance
              </span>
            )}
          </div>
        );
      })}

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
                  {roster.map(s => (
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
                        <button
                          className={cn(
                            'w-20 rounded-md py-1 text-xs font-bold',
                            statusColor(s.attendance_status)
                          )}
                          onClick={() => cycleStatus(s.student_id)}
                        >
                          {statusLabel(s.attendance_status)}
                        </button>
                      </div>
                    </div>
                  ))}
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

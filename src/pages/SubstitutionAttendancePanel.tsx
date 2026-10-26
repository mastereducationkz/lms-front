import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Video, MapPin, Lock, CalendarClock, Repeat, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '../components/ui/skeleton';
import { getMySubstitutions } from '../services/api';
import { SubstitutionLesson } from '../types';
import { isAttendanceLockedLesson } from '../lib/attendance';
import { parseAsUTC } from '../lib/datetime';
import { formatDateTime as formatLocalDateTime } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { splitSubstitutions, substitutionLink, substitutionStatus } from '../lib/substitutionLessons';
import '@/lib/i18n/catalogs/teacherDesk';
import { cn } from '../lib/utils';

function formatDateTime(iso: string) {
  return formatLocalDateTime(parseAsUTC(iso), {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * The lessons the signed-in teacher covers (owner, 2026-10-17). Marking happens on each lesson's own page —
 * the substitute is its teacher there, so they hand back what Meet could not mark and give the scores; this
 * tab only says which lessons still owe something and opens them.
 */
export default function SubstitutionAttendancePanel() {
  const t = useT();
  const [lessons, setLessons] = useState<SubstitutionLesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setLessons(await getMySubstitutions());
      } catch (err) {
        console.error('Failed to load substitutions:', err);
        toast.error(t('teacherDesk.subAttendance.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group by actionability: lessons that owe something need attention, later ones wait, the rest are done.
  const sections = useMemo(() => splitSubstitutions(lessons, isAttendanceLockedLesson), [lessons]);

  const renderCard = (lesson: SubstitutionLesson) => {
    const status = substitutionStatus(lesson, isAttendanceLockedLesson);
    // The auto-title carries "... : Lesson N" — surface just the lesson label and
    // lead with the real group name so it's clear whose class this is.
    const lessonSuffix = lesson.title.includes(':') ? lesson.title.split(':').pop()!.trim() : '';
    const primary = lessonSuffix ? `${lesson.group_name} · ${lessonSuffix}` : lesson.group_name;
    return (
      <Link
        key={lesson.event_id}
        to={substitutionLink(lesson, status)}
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border p-3 sm:p-4 transition-colors',
          'border-border bg-card hover:bg-muted dark:hover:bg-secondary',
          status === 'marked' && 'opacity-70'
        )}
      >
        <div className="min-w-0 flex-1 basis-56">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 max-w-full text-sm font-semibold text-foreground break-words line-clamp-2">
              {primary}
            </span>
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
              <Repeat className="w-3 h-3" /> {t('teacherDesk.subAttendance.badge')}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-muted-foreground">
              {t('teacherDesk.subAttendance.coveringFor', { name: lesson.original_teacher_name || '—' })}
            </span>
            <span>{formatDateTime(lesson.start_datetime)}</span>
            <span className="flex items-center gap-1">
              {lesson.is_online
                ? <Video className="w-3.5 h-3.5" />
                : <MapPin className="w-3.5 h-3.5" />}
              {lesson.is_online ? t('teacherDesk.subAttendance.online') : (lesson.location || t('teacherDesk.subAttendance.inPerson'))}
            </span>
          </div>
        </div>
        {status === 'upcoming' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
            <Lock className="w-3.5 h-3.5" /> {t('teacherDesk.subAttendance.upcoming')}
          </span>
        ) : status === 'waiting' ? (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
            <Clock className="w-3.5 h-3.5" /> {t('teacherDesk.subAttendance.waiting')}
          </span>
        ) : status === 'marked' ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400 shrink-0">
            <Check className="w-3.5 h-3.5" /> {t('teacherDesk.subAttendance.marked')}
          </span>
        ) : (
          <span className="flex shrink-0 flex-col items-end gap-1 text-xs font-semibold">
            {lesson.owed && lesson.owed.register > 0 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {t('teacherDesk.subAttendance.owedRegister')}
              </span>
            )}
            {lesson.owed && lesson.owed.scores > 0 && (
              <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                {t('teacherDesk.subAttendance.owedScores')}
              </span>
            )}
            <span className="text-brand">{t('teacherDesk.subAttendance.openLesson')}</span>
          </span>
        )}
      </Link>
    );
  };

  const renderSection = (label: string, items: SubstitutionLesson[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
          <span className="text-xs text-muted-foreground">{items.length}</span>
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
      <div className="py-24 text-center text-muted-foreground">
        <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">{t('teacherDesk.subAttendance.empty')}</p>
        <p className="text-sm mt-1">{t('teacherDesk.subAttendance.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderSection(t('teacherDesk.subAttendance.sectionNeedsMarking'), sections.needsMarking)}
      {renderSection(t('teacherDesk.subAttendance.sectionUpcoming'), sections.upcoming)}
      {renderSection(t('teacherDesk.subAttendance.sectionMarked'), sections.marked)}
    </div>
  );
}

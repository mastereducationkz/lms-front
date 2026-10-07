import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../components/ui/table';
import { Skeleton } from '../components/ui/skeleton';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { ChevronLeft, ChevronRight, Loader2, Save, Eye, EyeOff, Check, ChevronsUpDown, ClipboardList, Sparkles, User, Pencil, Star, Plus, ArrowUpRight } from 'lucide-react';
import { StudentHomeworkDialog } from '../components/leaderboard/StudentHomeworkDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { getCuratorGroups, getWeeklyLessonsWithHwStatus, updateAttendanceBulk, updateLeaderboardEntriesBulk, updateLeaderboardConfig, setGroupWeekOffset, setLessonTopic, setGroupPlatformTestsOptOut } from '../services/api';
import { Group, CourseType } from '../types';
import {
  PROGRAM_LABELS, PROGRAM_BADGE_STYLES, getGroupProgramType,
  formatGroupLabel, getGroupDateText, sortGroupsByCreatedAt,
} from '../lib/groupPicker';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { parseAsUTC } from '../lib/datetime';
import { formatGroupCloseDate } from '../lib/groupList';
import { cellsToSave, isAttendanceLockedLesson } from '../lib/attendance';
import { canBeExcused, displaysAsAbsence, excuseAwareStatus, excusePayload, isAbsenceStatus } from '../lib/excusedAbsence';
import { ExcusePopover } from '../components/attendance/ExcusePopover';
import { listMeetRecords, type MeetLessonFlag, type MeetReviewOptions, type MeetStudentVerdict } from '../services/api/meetAttendance';
import { flagText, mismatchIndex, reasonText, verdictIndex } from '../lib/meetAttendance';
import { MeetVerdictBadge, verdictNote } from '../components/meetAttendance/MeetVerdictBadge';
import type { RegisterMode, StudentRegister } from '../services/api/meetRegister';
import { decidedLessons, lessonStateIndex, overridesToAsk, reasonPayload, registerIndex, registerNote, scoreDue, type OverrideAsk, type OverrideReason } from '../lib/meetRegister';
import { OverrideReasonsDialog } from '../components/meetAttendance/OverrideReasonsDialog';
import { spokeNote, talkSecondsIndex } from '../lib/meetTalk';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { toast } from '../components/Toast';
import { getClassMaterialCounts } from '../services/api/classMaterials';
import LessonMaterialsBadge, { LessonMaterialsDialog } from '../components/class-materials/LessonMaterialsBadge';
import LessonScoresDialog from '../components/attendance/LessonScoresDialog';
import { lessonPath } from '../lib/lessonLinks';
import UserAvatar from '@/components/mascot/UserAvatar';
import { StarOfWeekButton } from '@/components/achievements/StarOfWeekDialog';
import GroupAchievementsPanel from '@/components/achievements/analytics/GroupAchievementsPanel';
import { formatDate, formatDateTime, formatTime, type Locale } from '../lib/i18n';
import { useLocale, useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/attendance';

interface HomeworkMeta {
    id: number;
    title: string;
    max_score?: number | null;
}

interface LessonMeta {
    lesson_number: number;
    event_id: number;
    title: string;
    topic?: string | null;
    start_datetime: string;
    is_substitution?: boolean;               // lesson was covered by a substitute teacher
    substitute_teacher_name?: string | null; // that substitute's name (null when regular teacher)
    homework?: HomeworkMeta;        // legacy: first homework of the lesson
    homeworks?: HomeworkMeta[];     // all homeworks of the lesson
}

interface HomeworkStatus {
    assignment_id?: number;
    title?: string;
    submitted: boolean;
    score: number | null;
    max_score?: number;
    is_graded?: boolean;
    submission_id?: number;
    feedback?: string | null;
    submitted_at?: string | null;
    graded_at?: string | null;
    late?: boolean;
}

interface StudentLessonStatus {
    event_id: number;
    attendance_status: string;
    activity_score?: number | null;
    homework_status: HomeworkStatus | null;   // legacy single status
    homework_statuses?: HomeworkStatus[];     // one per lesson homework
    // False = this lesson ended before the student's effective join date (CRM
    // "joined_from"). It isn't theirs, so it renders blank and is dropped from
    // the % denominator. Undefined on older payloads → treat as enrolled.
    enrolled?: boolean;
    // False = no attendance record yet (unmarked). A past unmarked lesson renders
    // as "Не отмечено" (distinct from a real ABSENT) and drops out of the %
    // denominator. Undefined on older payloads → treat as marked (legacy).
    marked?: boolean;
    // True = the lesson falls inside a CRM freeze period. The student was not expected, so
    // the cell renders «Заморозка», is not editable, and leaves both the attendance and the
    // homework denominators — exactly as a pre-join lesson does. Weeks before the freeze are
    // untouched. Undefined on older payloads → treat as not frozen.
    frozen?: boolean;
    // True = the lesson falls inside a CRM access block: the student had not renewed and
    // their login was off. Not a freeze (labelled «Нет доступа»), but it leaves the
    // attendance and homework denominators the same way. Undefined → not blocked.
    blocked?: boolean;
    // True = this absence has a reason on file and does not count against the student —
    // the cell still reads as a marked lesson (it's in the denominator), just a lighter red
    // instead of red. Only meaningful when attendance_status is a "missed" variant.
    // Undefined on older payloads → not excused.
    excused?: boolean;
    // The reason text, required whenever `excused` is true. Null/undefined otherwise.
    excuse_note?: string | null;
}

interface IeltsSpeakingFeedback {
    fluencyCoherence?: string | null;
    lexicalResource?: string | null;
    grammaticalRange?: string | null;
    pronunciation?: string | null;
    overall?: string | null;
}

interface StudentRow {
    student_id: number;
    student_name: string;
    avatar_url: string | null;
    mascot?: string | null;
    /** Present while the CRM has an active freeze for this student. Staff-facing detail. */
    freeze?: {
        is_frozen: boolean;
        planned_resume_date: string | null;
        label: string;
        freeze_start?: string | null;
        is_overdue?: boolean;
    } | null;
    lessons: { [key: string]: StudentLessonStatus }; // key is lesson_number as string "1", "2"
    // Manual fields
    curator_hour: number;
    mock_exam: number;
    sat_math_correct_count?: number | null;
    sat_math_total_count?: number | null;
    sat_verbal_correct_count?: number | null;
    sat_verbal_total_count?: number | null;
    sat_math_feedback?: string | null;
    sat_math_feedback_ru?: string | null;
    sat_verbal_feedback?: string | null;
    sat_verbal_feedback_ru?: string | null;
    sat_math_test_name?: string | null;
    sat_verbal_test_name?: string | null;
    sat_math_completed_at?: string | null;
    sat_verbal_completed_at?: string | null;
    ielts_listening_band?: number | null;
    ielts_reading_band?: number | null;
    ielts_writing_band?: number | null;
    ielts_speaking_band?: number | null;
    ielts_overall_band?: number | null;
    ielts_listening_test_name?: string | null;
    ielts_reading_test_name?: string | null;
    ielts_writing_test_name?: string | null;
    ielts_speaking_test_name?: string | null;
    // Speaking-examiner discriminator (IELTS contract 2026-07-27). Branch every
    // speaking display on ielts_speaking_source, NOT on the band — a row can carry
    // a null band while a session is scheduled / was a no_show / was cancelled.
    ielts_speaking_source?: 'ai' | 'instructor' | null;
    ielts_speaking_examiner?: string | null;   // human examiner's name for "instructor"; null for "ai"
    ielts_speaking_session_at?: string | null;  // ISO-8601, may carry a +05:00 (Asia/Almaty) offset
    ielts_speaking_status?: 'completed' | 'scheduled' | 'no_show' | 'cancelled' | null;
    ielts_listening_feedback?: string | null;
    ielts_listening_feedback_ru?: string | null;
    ielts_reading_feedback?: string | null;
    ielts_reading_feedback_ru?: string | null;
    ielts_writing_feedback?: { task1?: string | null; task2?: string | null } | null;
    ielts_writing_feedback_ru?: { task1?: string | null; task2?: string | null } | null;
    ielts_speaking_feedback?: IeltsSpeakingFeedback | null;
    ielts_speaking_feedback_ru?: IeltsSpeakingFeedback | null;
    study_buddy: number;
    self_reflection_journal: number;
    weekly_evaluation: number;
    extra_points: number;
}

interface LeaderboardData {
    week_number: number;
    week_start: string;
    lessons: LessonMeta[];
    students: StudentRow[];
    config: {
        curator_hour_enabled: boolean;
        study_buddy_enabled: boolean;
        self_reflection_journal_enabled: boolean;
        weekly_evaluation_enabled: boolean;
        extra_points_enabled: boolean;
        curator_hour_date: string | null;
    };
}



// Configuration
const MAX_SCORES = {
    attendance: 10,
    homework: 10, // each assigned HW is normalized to this weight
    curator_hour: 20,
    mock_exam: 100,
    study_buddy: 15, // 0 (no) or 15 (yes)
    self_reflection_journal: 14,
    weekly_evaluation: 10,
    extra_points: 0,
};

const getOptions = (max: number) => Array.from({ length: max + 1 }, (_, i) => i);

const ScoreSelect = ({
    value,
    max,
    onChange,
    disabled = false,
}: {
    value: number,
    max: number,
    onChange: (val: string) => void,
    disabled?: boolean,
}) => (
  <Select value={value.toString()} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn(
          "h-full w-full border-none focus:ring-0 px-1 text-center justify-center rounded-none",
          "hover:bg-black/5 dark:hover:bg-white/5" 
      )}>
          <SelectValue>
            <span className="truncate text-xs text-foreground dark:text-foreground">{value}</span>
          </SelectValue>
      </SelectTrigger>
      <SelectContent>
          {getOptions(max).map(v => (
              <SelectItem key={v} value={v.toString()} className="justify-center text-xs">
                  {v}
              </SelectItem>
          ))}
      </SelectContent>
  </Select>
);

const AttendanceToggle = ({
    initialStatus,
    onChange,
    disabled = false,
    isFuture = false,
    note = null,
    excused = false,
    excuseNote = null,
    onExcuseChange,
}: {
    initialStatus: string,
    onChange: (status: string) => void,
    disabled?: boolean,
    // The lesson hasn't happened yet (start_datetime is in the future). A future
    // lesson can't be "Не был", so we show a neutral pending cell and block editing.
    isFuture?: boolean,
    // A second line for the hover, e.g. how long the student spoke in the lesson's Meet room.
    note?: string | null,
    // Whether this "Не был" already carries an excuse, and its reason.
    excused?: boolean,
    excuseNote?: string | null,
    // Presence of this callback — not just the status — is what turns the excuse
    // affordance on. This component is also reused for the (non-attendance)
    // study_buddy toggle, whose "absent" state has nothing to do with excused
    // absences; that caller simply never passes this prop.
    onExcuseChange?: (excused: boolean, note: string | null) => void,
}) => {
  const t = useT();
  const [excusePopoverOpen, setExcusePopoverOpen] = useState(false);

  // Attendance belongs to one student; cancelling belongs to the whole lesson
  // and goes through an approved lesson request.  Keeping those controls apart
  // prevents one cell from claiming that an otherwise scheduled class vanished.
  // Excusing an absence is a separate affordance (the corner icon below), not a
  // fourth step here — a fourth click on the cycle would tax every ordinary
  // correction, and marking a group fast is the point of this screen.
  const handleCycle = () => {
    if (disabled || isFuture || initialStatus === 'cancelled') return;
    if (initialStatus === 'attended') onChange('late');
    else if (initialStatus === 'late') onChange('missed');
    else if (initialStatus === 'absent' || initialStatus === 'registered' || initialStatus === 'missed') onChange('attended');
    else onChange('attended');
  };

  // Normalized once so the excuse affordance can key off exactly what the cell
  // displays (registered/absent both paint as "Не был"), not the raw stored status.
  const normalizedStatus = displaysAsAbsence(initialStatus) ? 'missed' : initialStatus;

  const getStatusConfig = () => {
    if (initialStatus === 'cancelled') return { label: t('attendance.status.cancelled'), color: 'bg-muted-foreground/60 text-white', title: t('attendance.status.cancelledTitle') };
    const s = normalizedStatus;

    // A lesson that hasn't happened yet shouldn't read as "Не был" — the backend
    // just defaults an unmarked lesson to "missed". Show a neutral "—" instead.
    if (isFuture && s === 'missed') return { label: '—', color: 'bg-muted text-muted-foreground dark:bg-secondary', title: t('attendance.status.notYet') };

    if (s === 'missed' && excused) {
      return {
        label: t('attendance.status.excusedShort'),
        color: 'bg-rose-200 text-rose-900 dark:bg-rose-300 dark:text-rose-950',
        title: excuseNote ? t('attendance.status.excusedWithNote', { note: excuseNote }) : t('attendance.status.excused'),
      };
    }

    if (s === 'attended') return { label: t('attendance.status.present'), color: 'bg-emerald-500 text-white dark:bg-emerald-600', title: t('attendance.status.present') };
    if (s === 'late') return { label: t('attendance.status.late'), color: 'bg-amber-400 text-amber-950 font-bold dark:bg-amber-500', title: t('attendance.status.late') };
    return { label: t('attendance.status.absent'), color: 'bg-rose-500 text-white dark:bg-rose-600', title: t('attendance.status.absent') };
  };

  const config = getStatusConfig();
  // A real cancellation is rendered from the lesson-request flow and is
  // historical/view-only in this grid; it cannot be undone student by student.
  const nonInteractive = disabled || isFuture || initialStatus === 'cancelled';

  // Only offered on an actual "Не был" (never future/cancelled/frozen/blocked — those
  // never reach this component with initialStatus indicating a real absence while
  // interactive), and only for a caller that wired up onExcuseChange in the first place.
  const showExcuseAffordance = Boolean(onExcuseChange) && !nonInteractive && canBeExcused(normalizedStatus, isFuture);

  return (
    <div
        onClick={handleCycle}
        className={cn(
            "relative flex items-center justify-center w-full h-full text-[11px] font-bold transition-all select-none",
            config.color,
            nonInteractive ? "cursor-default brightness-[0.9] grayscale-[0.2]" : "cursor-pointer active:brightness-95 hover:brightness-105"
        )}
        title={(isFuture ? config.title : (disabled ? t('attendance.toggle.viewOnly', { status: config.title }) : t('attendance.toggle.clickToCycle', { status: config.title }))) + (note ? `\n${note}` : '')}
    >
        <span className="flex items-center gap-1">
            <span className="text-[10px] uppercase">{config.label}</span>
        {showExcuseAffordance && (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExcusePopoverOpen(true); }}
                // INLINE, beside the status label — not in a corner. All four corners are
                // taken: the Meet-mismatch marker owns top-left, MeetVerdictBadge owns
                // bottom-left (`absolute bottom-0 left-0` with an opaque background, and it
                // renders AFTER this toggle so it paints on top), the activity-score badge
                // top-right and its button bottom-right. This control sat at bottom-left and
                // was completely hidden by the Meet verdict badge on every lesson that has
                // one — which is most of them — so the feature was unreachable on the screen
                // teachers actually use. Always visible, never hover-only: the grid is dense
                // and a hidden icon is a feature nobody finds.
                className={cn(
                    "shrink-0 h-2.5 w-2.5 rounded-full ring-1 ring-white/80 dark:ring-card/80 pointer-events-auto",
                    excused ? "bg-rose-600" : "bg-transparent border border-white/80"
                )}
                title={excused
                    ? (excuseNote ? t('attendance.excuse.editTitleWithNote', { note: excuseNote }) : t('attendance.excuse.editTitle'))
                    : t('attendance.excuse.markTitle')}
                aria-label={excused
                    ? t('attendance.excuse.editAria')
                    : t('attendance.excuse.markAria')}
            />
        )}
        </span>
        {excusePopoverOpen && onExcuseChange && (
            <ExcusePopover
                excused={excused}
                note={excuseNote}
                onSave={(savedNote) => { onExcuseChange(true, savedNote); setExcusePopoverOpen(false); }}
                onClear={() => { onExcuseChange(false, null); setExcusePopoverOpen(false); }}
                onClose={() => setExcusePopoverOpen(false)}
            />
        )}
    </div>
  );
};

const calculateCurrentWeekNumber = (createdAtStr: string) => {
    const createdAt = new Date(createdAtStr);
    const now = new Date();
    
    // Start of the week (Monday) when the group was created
    const week1Start = new Date(createdAt);
    const day = week1Start.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    week1Start.setDate(week1Start.getDate() - diffToMonday);
    week1Start.setHours(0, 0, 0, 0);
    
    // Now's start of week
    const nowAtStart = new Date(now);
    nowAtStart.setHours(0, 0, 0, 0);
    
    const diffTime = nowAtStart.getTime() - week1Start.getTime();
    if (diffTime < 0) return 1;
    
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks + 1;
};

// Week number that a calendar date falls into, using the same Monday-aligned
// anchor as calculateCurrentWeekNumber. Lets "Mark" jump straight to the week of
// the oldest missing lesson instead of landing on the current week. Returns >= 1.
const weekNumberForDate = (anchorStr: string, target: Date) => {
    const week1Start = new Date(anchorStr);
    const day = week1Start.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    week1Start.setDate(week1Start.getDate() - diffToMonday);
    week1Start.setHours(0, 0, 0, 0);

    const targetAtStart = new Date(target);
    targetAtStart.setHours(0, 0, 0, 0);

    const diffTime = targetAtStart.getTime() - week1Start.getTime();
    if (diffTime < 0) return 1;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7)) + 1;
};

// Monday of a given week number for a group, derived from its created_at.
const getWeekMonday = (createdAtStr: string, week: number) => {
    const week1 = new Date(createdAtStr);
    const day = week1.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    week1.setDate(week1.getDate() - diffToMonday);
    week1.setHours(0, 0, 0, 0);
    week1.setDate(week1.getDate() + (week - 1) * 7);
    return week1;
};

// "01 Jun" / "01 июн" in the viewer's language.
const formatDayMonth = (d: Date, locale: Locale) =>
    formatDate(d, { day: '2-digit', month: 'short' }, locale).replace('.', '');

// "01 – 07 июн" range label for a week number.
const weekRangeLabel = (createdAtStr: string, week: number, locale: Locale) => {
    const start = getWeekMonday(createdAtStr, week);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDayMonth(start, locale)} – ${formatDayMonth(end, locale)}`;
};

// The date leaderboard weeks are numbered from. The backend anchors week 1 to
// the group's first class event (week1_start), which can trail created_at by
// weeks — created_at is only a fallback for groups with no events yet.
// week1_start is date-only; suffix a local-midnight time so new Date() doesn't
// parse it as UTC and slide it to Sunday for viewers west of UTC.
const groupWeekAnchor = (group: Group) =>
    group.week1_start ? `${group.week1_start}T00:00:00` : group.created_at;

// Group-picker helpers (PROGRAM_LABELS, getGroupProgramType, formatGroupLabel,
// getGroupDateText, PROGRAM_BADGE_STYLES, pluralizeGroups, sortGroupsByCreatedAt)
// are shared with the Attendance page — see ../lib/groupPicker.

const applyGroupWeek = (group: Group, weekParam: string | null, dateParam?: string | null) => {
    if (weekParam) return parseInt(weekParam, 10);
    // ?date=YYYY-MM-DD (e.g. the oldest missing lesson from the dashboard's
    // "Mark" link) → open the week containing that date, clamped to the group's
    // range, instead of defaulting to the current week.
    if (dateParam) {
        const d = new Date(`${dateParam.slice(0, 10)}T00:00:00`);
        if (!isNaN(d.getTime())) {
            const maxWeek = group.max_week || 52;
            return Math.min(maxWeek, Math.max(1, weekNumberForDate(groupWeekAnchor(group), d)));
        }
    }
    if (group.current_week) return group.current_week;
    return calculateCurrentWeekNumber(groupWeekAnchor(group));
};

// Inline markdown: **bold**, *italic*, converts to React spans
const renderInline = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/)
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/)

    const boldIdx = remaining.indexOf('**')
    const italicIdx = remaining.indexOf('*')

    if (boldIdx !== -1 && (italicIdx === -1 || boldIdx <= italicIdx)) {
      const before = remaining.slice(0, boldIdx)
      if (before) parts.push(<span key={key++}>{before}</span>)
      const end = remaining.indexOf('**', boldIdx + 2)
      if (end === -1) { parts.push(<span key={key++}>{remaining}</span>); break }
      parts.push(<strong key={key++} className="font-semibold text-foreground dark:text-foreground">{remaining.slice(boldIdx + 2, end)}</strong>)
      remaining = remaining.slice(end + 2)
    } else if (italicIdx !== -1) {
      const before = remaining.slice(0, italicIdx)
      if (before) parts.push(<span key={key++}>{before}</span>)
      const end = remaining.indexOf('*', italicIdx + 1)
      if (end === -1) { parts.push(<span key={key++}>{remaining}</span>); break }
      parts.push(<em key={key++} className="italic">{remaining.slice(italicIdx + 1, end)}</em>)
      remaining = remaining.slice(end + 1)
    } else {
      parts.push(<span key={key++}>{remaining}</span>)
      break
    }
  }
  return parts
}

const MarkdownContent = ({ children }: { children: string }) => {
  const lines = children.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('### ')) {
      elements.push(<h3 key={i} className="text-sm font-bold text-foreground mt-3 mb-1 first:mt-0">{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-sm font-bold text-foreground dark:text-foreground mt-4 mb-1 first:mt-0 border-b border-border pb-0.5">{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-base font-bold text-foreground dark:text-foreground mt-3 mb-1.5 first:mt-0">{renderInline(line.slice(2))}</h1>)
    } else if (/^[-*] /.test(line)) {
      // collect consecutive list items
      const listItems: React.ReactNode[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        listItems.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 mb-2 text-sm text-foreground">{listItems}</ul>)
      continue
    } else if (/^\d+\. /.test(line)) {
      const listItems: React.ReactNode[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 mb-2 text-sm text-foreground">{listItems}</ol>)
      continue
    } else if (line.trim() === '' || line === '---') {
      if (line === '---') elements.push(<hr key={i} className="border-border my-2" />)
      // empty line → skip
    } else {
      elements.push(<p key={i} className="text-sm text-foreground leading-relaxed mb-1.5 last:mb-0">{renderInline(line)}</p>)
    }

    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

export default function CuratorLeaderboardPage({ embedded = false, titleSlot }: { embedded?: boolean; titleSlot?: React.ReactNode } = {}) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  // One language per person (lib/i18n): curators and head curators read Russian, everyone else English.
  const t = useT();
  const locale = useLocale();
  // «(закроется 10.09)» — the pending close of a group inside its grace window. The date
  // comes from the backend; the Wednesday rule is never recomputed here.
  const closeLabel = (group: Group) => {
    const day = formatGroupCloseDate(group);
    return day && t('attendance.picker.closes', { day });
  };
  // Curators view attendance read-only; every other role on this page can mark it.
  const canMarkAttendance = user?.role !== 'curator';
  // The assignment builder route is teacher/admin-only — gate the Assign shortcut the same way.
  const canAssignHw = isTeacher || user?.role === 'admin';
  // Star of the Week (2026-10-04): the group's teacher or curator; the backend checks the group.
  const canGiveStar = ['teacher', 'curator', 'admin'].includes(user?.role || '');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weekOffset, setWeekOffset] = useState(0);
  const [platformTestsOn, setPlatformTestsOn] = useState(true);
  const [savingPlatformTests, setSavingPlatformTests] = useState(false);
  const [savingOffset, setSavingOffset] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [hideCompletedGroups, setHideCompletedGroups] = useState(true);
  const [programFilter, setProgramFilter] = useState<'all' | CourseType>('all');
  
  const filteredGroups = useMemo(() => {
    let result = groups;

    if (hideCompletedGroups) {
      result = result.filter((group) => !group.is_over);
    }

    if (programFilter !== 'all') {
      result = result.filter((group) => getGroupProgramType(group) === programFilter);
    }

    return sortGroupsByCreatedAt(result);
  }, [groups, hideCompletedGroups, programFilter]);

  const selectedGroup = useMemo(
    () => filteredGroups.find((group) => group.id === selectedGroupId) || null,
    [filteredGroups, selectedGroupId],
  );
  const isSatGroup = selectedGroup ? getGroupProgramType(selectedGroup) === 'sat' : false;
  const isIeltsGroup = selectedGroup ? getGroupProgramType(selectedGroup) === 'ielts' : false;
  const isNuetGroup = selectedGroup ? getGroupProgramType(selectedGroup) === 'nuet' : false;
  // SAT and NUET share the Math/Verbal section columns.
  const showExamSections = isSatGroup || isNuetGroup;
  const examLabel = isNuetGroup ? 'NUET' : 'SAT';

  // Keep the local week-offset editor in sync with the selected group.
  useEffect(() => {
    setWeekOffset(selectedGroup?.weekly_set_week_offset ?? 0);
  }, [selectedGroup?.id, selectedGroup?.weekly_set_week_offset]);

  useEffect(() => {
    setPlatformTestsOn(!(selectedGroup?.platform_tests_opt_out ?? false));
  }, [selectedGroup?.id, selectedGroup?.platform_tests_opt_out]);

  // Per-group opt-out of the auto-created IELTS weekly-test assignments (Platform Integration Pack).
  const savePlatformTests = async (on: boolean) => {
    if (!selectedGroup) return;
    setSavingPlatformTests(true);
    setPlatformTestsOn(on);
    try {
      const res = await setGroupPlatformTestsOptOut(selectedGroup.id, !on);
      setPlatformTestsOn(!res.opt_out);
      selectedGroup.platform_tests_opt_out = res.opt_out;
    } catch (e) {
      console.error('Failed to update platform tests setting:', e);
      setPlatformTestsOn(!(selectedGroup.platform_tests_opt_out ?? false));
    } finally {
      setSavingPlatformTests(false);
    }
  };

  // Persist the per-group NUET week offset, then refetch so the corrected weeks show.
  const saveWeekOffset = async (next: number) => {
    if (!selectedGroupId) return;
    const clamped = Math.max(0, Math.min(52, Number.isFinite(next) ? next : 0));
    setWeekOffset(clamped);
    setSavingOffset(true);
    try {
      const res = await setGroupWeekOffset({ group_id: selectedGroupId, offset: clamped });
      setGroups(prev => prev.map(g =>
        g.id === selectedGroupId ? { ...g, weekly_set_week_offset: res.weekly_set_week_offset } : g));
      toast(t('attendance.toast.offsetSaved'), 'success');
      await loadLeaderboard();
    } catch (err) {
      console.error('Failed to save week offset:', err);
      toast(t('attendance.toast.offsetFailed'), 'error');
    } finally {
      setSavingOffset(false);
    }
  };

  // Groups matching the picker search box (matches subject, date, and teacher name)
  const groupMatches = useMemo(() => {
    const q = groupQuery.trim().toLowerCase();
    if (!q) return filteredGroups;
    return filteredGroups.filter((group) =>
      group.name.toLowerCase().includes(q) ||
      formatGroupLabel(group).toLowerCase().includes(q)
    );
  }, [filteredGroups, groupQuery]);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);
  // 📎 counts for the grid's lesson badges (event_id → count), fetched once per group/week
  // load (never per lesson) and refreshed after a materials dialog reports a write. Only the
  // latest request may write: a slow answer for the previous group/week is dropped.
  const [materialCounts, setMaterialCounts] = useState<Record<number, number>>({});
  const materialCountsRequest = useRef(0);
  const refetchMaterialCounts = useCallback(async (lessons: LessonMeta[]) => {
    const request = ++materialCountsRequest.current;
    const eventIds = lessons.map((l) => l.event_id).filter((id): id is number => !!id);
    if (!eventIds.length) {
      setMaterialCounts({});
      return;
    }
    try {
      const counts = await getClassMaterialCounts(eventIds);
      if (request === materialCountsRequest.current) setMaterialCounts(counts);
    } catch (e) {
      console.error('Failed to load class material counts', e);
      if (request === materialCountsRequest.current) setMaterialCounts({});
    }
  }, []);
  // The one materials dialog for the whole grid, rendered outside the table (see
  // `LessonMaterialsBadge` for why it can't live inside a lesson header).
  const [materialsDialog, setMaterialsDialog] = useState<{ open: boolean; eventId: number | null }>({
    open: false,
    eventId: null,
  });
  // Marks that disagree with who was in the lesson's Meet room ("eventId:studentId" → flags).
  // Evidence only: the dot explains, the teacher still decides the mark.
  const [meetMismatches, setMeetMismatches] = useState<Map<string, MeetLessonFlag[]>>(new Map());
  // How long each student spoke in each lesson ("eventId:studentId" → seconds), for the hover.
  const [meetTalk, setMeetTalk] = useState<Map<string, number>>(new Map());
  // Meet's verdict on each student in each lesson ("eventId:studentId"): beside the mark, never instead of it.
  const [meetVerdicts, setMeetVerdicts] = useState<Map<string, MeetStudentVerdict>>(new Map());
  // Meet takes the register (2026-09-23): what it did per "eventId:studentId", the switch, and each
  // lesson's Meet state (a covered lesson still waiting reads «Meet отметит» instead of «Не отмечено»).
  const [meetRegister, setMeetRegister] = useState<Map<string, StudentRegister>>(new Map());
  const [registerMode, setRegisterMode] = useState<RegisterMode>('off');
  const [meetLessonState, setMeetLessonState] = useState<Map<number, string>>(new Map());
  const [reviewOptions, setReviewOptions] = useState<MeetReviewOptions>({});
  // Lessons whose register Meet decided: every present student there owes a балл за активность (the star).
  const meetDecidedLessons = useMemo(() => decidedLessons(meetRegister), [meetRegister]);
  // Bumped after a journal save so the Meet list is read again: ✎ and reasons show without a reload.
  const [meetRefresh, setMeetRefresh] = useState(0);
  // Reasons for changing marks Meet decided, by "studentId:lessonKey" — asked once, at «Сохранить».
  const [overrideReasons, setOverrideReasons] = useState<Map<string, OverrideReason>>(new Map());
  const [overrideAsk, setOverrideAsk] = useState<OverrideAsk[] | null>(null);

  // Changes tracking: Set of student IDs that have changes
  const [changedEntries, setChangedEntries] = useState<Set<number>>(new Set());
  // "studentId:lessonNumber" pairs whose excuse the user actually edited this session.
  // The save loop below walks every lesson of every changed student — without this,
  // it would send `excused: false` for cells nobody touched and erase reasons another
  // teacher had typed.
  const [touchedExcuses, setTouchedExcuses] = useState<Set<string>>(new Set());
  const [configChanged, setConfigChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [enabledCols, setEnabledCols] = useState({
      curator_hour: true,
      study_buddy: true,
      self_reflection_journal: true,
      weekly_evaluation: true,
      extra_points: true,
      curator_hour_date: null as string | null
  });

  // Feedback popups
  type HwFeedbackModal = {
    open: boolean;
    studentName: string;
    lessonTitle: string;
    score: number | null;
    maxScore?: number;
    feedback: string | null;
    submittedAt: string | null;
    gradedAt: string | null;
  }
  type SatFeedbackModal = {
    open: boolean;
    studentName: string;
    section: 'math' | 'verbal';
    testName: string | null;
    feedback: string | null;
    feedbackRu: string | null;
    correct: number | null;
    total: number | null;
    completedAt: string | null;
  }

  const [hwModal, setHwModal] = useState<HwFeedbackModal>({
    open: false, studentName: '', lessonTitle: '', score: null, feedback: null, submittedAt: null, gradedAt: null
  })
  const [satModal, setSatModal] = useState<SatFeedbackModal>({
    open: false, studentName: '', section: 'math', testName: null, feedback: null, feedbackRu: null, correct: null, total: null, completedAt: null
  })
  // Language shown in the SAT feedback modal; the viewer's own language wins when available
  const [satFeedbackLang, setSatFeedbackLang] = useState<'ru' | 'en'>('ru')
  // Same for the IELTS feedback modal; translation is best-effort per field,
  // so Russian mode falls back to the English text wherever the Russian is null
  const [ieltsFeedbackLang, setIeltsFeedbackLang] = useState<'ru' | 'en'>('ru')
  const [ieltsModal, setIeltsModal] = useState<{ open: boolean; student: StudentRow | null }>({
    open: false, student: null
  })
  const [studentHwModal, setStudentHwModal] = useState<{ open: boolean; studentId: number | null; studentName: string }>({
    open: false, studentId: null, studentName: ''
  })
  const [activityModal, setActivityModal] = useState<{
    open: boolean; studentId: number | null; lessonKey: string | null;
    studentName: string; currentScore: number;
  }>({ open: false, studentId: null, lessonKey: null, studentName: '', currentScore: 0 });
  // «Баллы за урок»: one lesson's scores on one screen, from its start (2026-09-28).
  const [scoresLesson, setScoresLesson] = useState<LessonMeta | null>(null);
  const [topicModal, setTopicModal] = useState<{
    open: boolean; lesson: LessonMeta | null; value: string;
  }>({ open: false, lesson: null, value: '' });
  const [savingTopic, setSavingTopic] = useState(false);

  const toggleColumn = (field: keyof typeof enabledCols) => {
      if (isTeacher) return;
      setEnabledCols(prev => ({ ...prev, [field]: !prev[field] }));
      setConfigChanged(true);
  };



  useEffect(() => {
    const loadGroups = async () => {
        try {
            // /leaderboard/curator/groups serves every role here (incl. teacher)
            // and carries current_week/max_week/week1_start for the week switcher.
            setGroups(sortGroupsByCreatedAt(await getCuratorGroups()));
        } catch (e) {
            console.error("Failed to load groups", e);
        }
    };
    loadGroups();
  }, [user]);

  useEffect(() => {
    if (groups.length === 0) return;

    const weekParam = searchParams.get('week');
    const dateParam = searchParams.get('date');
    const groupIdParam = searchParams.get('groupId') ?? searchParams.get('group');

    if (selectedGroupId && filteredGroups.some((group) => group.id === selectedGroupId)) {
      return;
    }

    if (groupIdParam) {
      const fromUrl = filteredGroups.find((group) => group.id === parseInt(groupIdParam, 10));
      if (fromUrl) {
        setSelectedGroupId(fromUrl.id);
        setCurrentWeek(applyGroupWeek(fromUrl, weekParam, dateParam));
        return;
      }
    }

    if (filteredGroups.length > 0) {
      const nextGroup = filteredGroups[0];
      setSelectedGroupId(nextGroup.id);
      setCurrentWeek(applyGroupWeek(nextGroup, weekParam, dateParam));
      return;
    }

    setSelectedGroupId(null);
  }, [groups, filteredGroups, hideCompletedGroups, programFilter]);

  useEffect(() => {
    if (selectedGroupId) {
        // Update URL
        setSearchParams(params => {
            params.set('groupId', selectedGroupId.toString());
            params.set('week', currentWeek.toString());
            // `date` was a one-shot hint (jump to the oldest-missing week); the
            // resolved week now lives in the URL, so drop it to avoid re-applying.
            params.delete('date');
            return params;
        }, { replace: true });
        
        loadLeaderboard();
    }
  }, [selectedGroupId, currentWeek]);

  useEffect(() => {
    const starts = (data?.lessons ?? []).map((l) => parseAsUTC(l.start_datetime).getTime()).filter(Number.isFinite);
    if (!selectedGroupId || starts.length === 0) {
      setMeetMismatches(new Map());
      setMeetTalk(new Map());
      setMeetVerdicts(new Map());
      setMeetRegister(new Map()); setMeetLessonState(new Map());
      return;
    }
    const DAY = 24 * 60 * 60 * 1000;
    let cancelled = false;
    listMeetRecords({
      group_id: selectedGroupId,
      date_from: new Date(Math.min(...starts) - DAY).toISOString(),
      date_to: new Date(Math.max(...starts) + DAY).toISOString(),
    })
      .then((r) => {
        if (cancelled) return;
        setMeetMismatches(mismatchIndex(r.items));
        setMeetTalk(talkSecondsIndex(r.items));
        setMeetVerdicts(verdictIndex(r.items));
        setMeetRegister(registerIndex(r.items));
        setRegisterMode(r.register_mode ?? 'off');
        setMeetLessonState(lessonStateIndex(r.items));
        setReviewOptions(r.review_options ?? {});
      })
      .catch(() => { if (!cancelled) { setMeetMismatches(new Map()); setMeetTalk(new Map()); setMeetVerdicts(new Map()); setMeetRegister(new Map()); setMeetLessonState(new Map()); } });
    return () => { cancelled = true; };
  }, [selectedGroupId, data, meetRefresh]);

  const loadLeaderboard = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    setChangedEntries(new Set());
    setTouchedExcuses(new Set());
    setConfigChanged(false);
    // Reasons belong to this group/week's pending edits — a stale one must not answer a
    // colliding "studentId:lessonKey" in the next group/week (lesson numbers restart per group).
    setOverrideReasons(new Map());
    setOverrideAsk(null);
    try {
        const result = await getWeeklyLessonsWithHwStatus(selectedGroupId, currentWeek);
        setData(result);
        refetchMaterialCounts(result.lessons);

        // Load persistent config - use exact values from server, fallback to false if null/undefined
        if (result.config) {
            setEnabledCols({
                curator_hour: result.config.curator_hour_enabled === true,
                study_buddy: result.config.study_buddy_enabled === true,
                self_reflection_journal: result.config.self_reflection_journal_enabled === true,
                weekly_evaluation: result.config.weekly_evaluation_enabled === true,
                extra_points: result.config.extra_points_enabled === true,
                curator_hour_date: result.config.curator_hour_date
            });
        }
    } catch (e) {
        console.error("Failed to load leaderboard", e);
        toast(t('attendance.toast.loadFailed'), "error");
    } finally {
        setLoading(false);
    }
  };

  // All homeworks of a lesson; falls back to the legacy single-homework field.
  const lessonHomeworks = (meta?: LessonMeta): HomeworkMeta[] =>
    meta?.homeworks ?? (meta?.homework ? [meta.homework] : []);

  // Per-homework statuses of a student's lesson; falls back to the legacy field.
  const lessonHwStatuses = (ls?: StudentLessonStatus | null): HomeworkStatus[] =>
    ls?.homework_statuses ?? (ls?.homework_status ? [ls.homework_status] : []);

  // Normalized HW contribution: score/max × 10 so a 30-point HW weighs the
  // same as a 10-point one. Max comes from the submission, falling back to
  // the assignment meta; a missing/zero max contributes nothing.
  const hwContribution = (lessonKey: string, hw: HomeworkStatus) => {
    if (!hw || hw.score === null || hw.score === undefined) return 0;
    const metaHws = lessonHomeworks(data?.lessons.find(l => l.lesson_number.toString() === lessonKey));
    const metaMax = metaHws.find(m => m.id === hw.assignment_id)?.max_score ?? metaHws[0]?.max_score;
    const max = hw.max_score ?? metaMax ?? 0;
    if (!max || max <= 0) return 0;
    return (hw.score / max) * MAX_SCORES.homework;
  };

  const calculateTotal = (student: StudentRow) => {
    if (!data) return 0;

    // Sum HW and Attendance from dynamic lessons
    let lessonsTotal = 0;
    Object.entries(student.lessons).forEach(([lessonKey, lesson]) => {
        // Attendance
        if (lesson.attendance_status === 'attended') {
            lessonsTotal += MAX_SCORES.attendance;
        }
        // Homework — each homework of the lesson is normalized to MAX_SCORES.homework
        lessonHwStatuses(lesson).forEach(hw => {
            lessonsTotal += hwContribution(lessonKey, hw);
        });
    });

    // Manual Columns
    const curatorHour = enabledCols.curator_hour ? student.curator_hour : 0;
    const mockExam = student.mock_exam; // Always enabled logic-wise
    const studyBuddy = enabledCols.study_buddy ? student.study_buddy : 0;
    const journal = enabledCols.self_reflection_journal ? student.self_reflection_journal : 0;
    const weeklyEval = enabledCols.weekly_evaluation ? student.weekly_evaluation : 0;
    const extraPoints = enabledCols.extra_points ? student.extra_points : 0;

    const total = lessonsTotal + curatorHour + mockExam + studyBuddy + journal + weeklyEval + extraPoints;
    return Math.round(total * 10) / 10;
  };
  
  const calculatePercent = (student: StudentRow) => {
      if (!data) return 0;
      const total = calculateTotal(student);
      
      // Each assigned HW is worth MAX_SCORES.homework in the denominator;
      // unsubmitted HW stays in the denominator (it was assigned).
      let maxLessons = 0;
      data.lessons.forEach(meta => {
          maxLessons += MAX_SCORES.attendance; // 10
          maxLessons += lessonHomeworks(meta).length * MAX_SCORES.homework; // 10 each, normalized
      });
      
      let maxForWeek = maxLessons + MAX_SCORES.mock_exam;
      if (enabledCols.curator_hour) maxForWeek += MAX_SCORES.curator_hour;
      if (enabledCols.study_buddy) maxForWeek += MAX_SCORES.study_buddy;
      if (enabledCols.self_reflection_journal) maxForWeek += MAX_SCORES.self_reflection_journal;
      if (enabledCols.weekly_evaluation) maxForWeek += MAX_SCORES.weekly_evaluation;
      // extra_points NOT added to maxForWeek

      // Cancelled lessons are excluded from the attendance denominator so a
      // cancelled lesson never drags a student's percentage down.
      const cancelledLessons = Object.values(student.lessons).filter(
          l => l.attendance_status === 'cancelled'
      ).length;
      maxForWeek -= cancelledLessons * MAX_SCORES.attendance;

      // Lessons that predate the student's join date (enrolled === false) aren't
      // theirs — drop both their attendance and their homework from the
      // denominator so early lessons never tank a late-added student's %.
      // Past unmarked lessons (marked === false) are "no data", not an absence —
      // drop only their attendance from the denominator until someone marks them
      // (homework submission is independent of attendance, so it stays).
      Object.entries(student.lessons).forEach(([lessonKey, l]) => {
          const meta = data.lessons.find(m => m.lesson_number.toString() === lessonKey);
          if (l.enrolled === false || l.frozen || l.blocked) {
              // A frozen lesson is not theirs either: counting it would make a freeze look
              // like a collapse in attendance, and the weeks they actually studied would be
              // dragged down by the weeks they were away.
              maxForWeek -= MAX_SCORES.attendance;
              maxForWeek -= lessonHomeworks(meta).length * MAX_SCORES.homework;
          } else if (l.marked === false && meta && !isAttendanceLockedLesson(meta.start_datetime)) {
              maxForWeek -= MAX_SCORES.attendance;
          }
      });

      if (maxForWeek <= 0) return 0;
      return Math.round((total / maxForWeek) * 100); 
  };

  const getPercentColor = (percent: number) => {
      if (percent >= 90) return "bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300";
      if (percent >= 75) return "bg-brand-subtle text-brand-subtle-foreground";
      if (percent >= 50) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
      return "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300";
  };

  const handleManualScoreChange = (studentId: number, field: keyof StudentRow, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            students: prev.students.map(s => 
                s.student_id === studentId ? { ...s, [field]: numValue } : s
            )
        };
    });
    
    setChangedEntries(prev => new Set(prev).add(studentId));
  };

  const handleAttendanceChange = (studentId: number, lessonNumber: string, status: string) => {
      // Security check — curators view attendance here but don't edit it.
      if (!canMarkAttendance) return;
      const guarded = data?.students.find(s => s.student_id === studentId)?.lessons[lessonNumber];
      // A frozen or blocked lesson is not editable: the student was not expected, so
      // marking them present or absent would be recording something that did not happen.
      if (guarded?.frozen || guarded?.blocked) return;
      
      // Status: "attended" or "absent" (from toggles)
      // Map to 10 or 0
      
      setData(prev => {
          if (!prev) return null;
          return {
              ...prev,
              students: prev.students.map(s => {
                  if (s.student_id !== studentId) return s;
                  
                  const lesson = s.lessons[lessonNumber];
                  if (!lesson) return s;

                  // A status that no longer means "absent" can't carry an excuse — the
                  // server refuses (422, whole batch) an `excused: true` sent alongside
                  // a non-absent status. Clearing it here mirrors what the server already
                  // does when a persisted excuse's status changes, so a cell excused and
                  // then cycled to "Был" within the same session doesn't poison the save.
                  const clearsExcuse = !isAbsenceStatus(status);

                  return {
                      ...s,
                      lessons: {
                          ...s.lessons,
                          [lessonNumber]: {
                              ...lesson,
                              attendance_status: status,
                              // Editing an unmarked lesson makes it marked, so the
                              // "Не отмечено" state clears immediately and it re-enters
                              // the % denominator.
                              marked: true,
                              ...(clearsExcuse ? { excused: false, excuse_note: null } : {})
                          }
                      }
                  };
              })
          };
      });
      setChangedEntries(prev => new Set(prev).add(studentId));
      // The three-click cycle (missed -> attended -> late -> missed) is the natural way
      // a teacher "removes" an excuse without ever opening the popover. If this change
      // actually cleared a *stored* excuse (it was true before this click), that is a
      // real edit to the excuse, not just a status change — without marking it touched,
      // the save would omit `excused` entirely ("leave the stored value alone") and the
      // excuse — and the billing decision keyed on it — would silently survive server-side.
      if (!isAbsenceStatus(status) && guarded?.excused) {
          setTouchedExcuses(prev => new Set(prev).add(`${studentId}:${lessonNumber}`));
      }
  };

  const handleExcuseChange = (
    studentId: number,
    lessonNumber: string,
    excused: boolean,
    note: string | null,
  ) => {
      if (!canMarkAttendance) return;
      const guarded = data?.students.find(s => s.student_id === studentId)?.lessons[lessonNumber];
      if (guarded?.frozen || guarded?.blocked) return;
      // No lesson at this key for this student — nothing will change below, so
      // don't mark the row as touched (a silent no-op shouldn't make Save think
      // there's something to save).
      if (!guarded) return;
      setData(prev => {
          if (!prev) return null;
          return {
              ...prev,
              students: prev.students.map(s => {
                  if (s.student_id !== studentId) return s;
                  const lesson = s.lessons[lessonNumber];
                  if (!lesson) return s;
                  return {
                      ...s,
                      lessons: {
                          ...s.lessons,
                          [lessonNumber]: {
                              ...lesson,
                              excused,
                              excuse_note: note,
                              // Отметка уважительности — тоже отметка: урок перестаёт быть
                              // неотмеченным и входит в знаменатель процента.
                              marked: true,
                          },
                      },
                  };
              }),
          };
      });
      setChangedEntries(prev => new Set(prev).add(studentId));
      setTouchedExcuses(prev => new Set(prev).add(`${studentId}:${lessonNumber}`));
  };

  const markAllPresentForLesson = (lesson: LessonMeta) => {
    if (!canMarkAttendance || !data) return;
    if (isAttendanceLockedLesson(lesson.start_datetime)) return;
    const lessonKey = lesson.lesson_number.toString();
    data.students.forEach(s => handleAttendanceChange(s.student_id, lessonKey, 'attended'));
  };

  const updateActivityScore = (studentId: number, lessonKey: string, score: number) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(s => {
          if (s.student_id !== studentId) return s;
          const lesson = s.lessons[lessonKey];
          if (!lesson) return s;
          return { ...s, lessons: { ...s.lessons, [lessonKey]: { ...lesson, activity_score: score } } };
        })
      };
    });
    setChangedEntries(prev => new Set(prev).add(studentId));
  };

  // The dialog saved these already; keep the grid in step so a later «Сохранить» of the row re-sends
  // the new score, not the one loaded with the page. Not a change to save — no changedEntries.
  const applySavedScores = (lessonKey: string, saved: Map<number, number>) => {
    setData(prev => prev && {
      ...prev,
      students: prev.students.map(s => {
        const lesson = s.lessons[lessonKey];
        if (!lesson || !saved.has(s.student_id)) return s;
        return { ...s, lessons: { ...s.lessons, [lessonKey]: { ...lesson, activity_score: saved.get(s.student_id)! } } };
      }),
    });
  };

  const saveTopic = async () => {
    if (!topicModal.lesson || !selectedGroupId) return;
    const lesson = topicModal.lesson;
    const nextTopic = topicModal.value.trim();
    setSavingTopic(true);
    try {
      const res = await setLessonTopic({
        group_id: selectedGroupId,
        event_id: lesson.event_id,
        topic: nextTopic || null,
      });
      // The event may have been materialized server-side — adopt the returned id.
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          lessons: prev.lessons.map(l =>
            l.event_id === lesson.event_id ? { ...l, topic: res.topic, event_id: res.event_id } : l
          ),
        };
      });
      toast(res.topic ? t('attendance.toast.topicSaved') : t('attendance.toast.topicCleared'), 'success');
      setTopicModal({ open: false, lesson: null, value: '' });
    } catch (err) {
      console.error('Failed to save lesson topic:', err);
      toast(t('attendance.toast.topicFailed'), 'error');
    } finally {
      setSavingTopic(false);
    }
  };

  const handleSaveChanges = async (confirmedReasons?: Map<string, OverrideReason>) => {
    if (!selectedGroupId || (!configChanged && changedEntries.size === 0) || !data) return;
    const reasons = confirmedReasons ?? overrideReasons;
    // A mark Meet decided that this save contradicts about attending needs a reason — asked once for
    // the whole save, never on each click of the cycle toggle (2026-09-23).
    if (canMarkAttendance) {
      const lessonLabel = (key: string) => {
        const meta = data.lessons.find((l) => l.lesson_number.toString() === key);
        const day = meta ? formatDate(meta.start_datetime, { day: '2-digit', month: '2-digit' }, locale) : '';
        return `${t('attendance.lessonNumber', { number: key })}${day ? ` · ${day}` : ''}`;
      };
      const ask = overridesToAsk(data.students, changedEntries, meetRegister, reasons, lessonLabel);
      if (ask.length > 0) {
        setOverrideAsk(ask);
        return;
      }
    }

    setIsSaving(true);
    let successCount = 0;
    let attendanceFailures = 0;
    let attendanceErrorDetail: string | undefined;

    try {
        // 1. Save Column Visibility Config — teachers can't touch manual columns, so skip entirely.
        if (!isTeacher) {
            console.log('Saving leaderboard config:', {
                group_id: selectedGroupId,
                week_number: currentWeek,
                curator_hour_enabled: enabledCols.curator_hour === true,
                study_buddy_enabled: enabledCols.study_buddy === true,
                self_reflection_journal_enabled: enabledCols.self_reflection_journal === true,
                weekly_evaluation_enabled: enabledCols.weekly_evaluation === true,
                extra_points_enabled: enabledCols.extra_points === true
            });

            const savedConfig = await updateLeaderboardConfig({
                group_id: selectedGroupId,
                week_number: currentWeek,
                curator_hour_enabled: enabledCols.curator_hour === true,
                study_buddy_enabled: enabledCols.study_buddy === true,
                self_reflection_journal_enabled: enabledCols.self_reflection_journal === true,
                weekly_evaluation_enabled: enabledCols.weekly_evaluation === true,
                extra_points_enabled: enabledCols.extra_points === true
            });

            console.log('Config saved successfully:', savedConfig);
        }

        // 2. Save Student Scores — batched into (at most) two bulk requests instead of
        // the previous per-row round-trips (1 entry + up to 5 attendance writes per
        // changed student ⇒ dozens of serial requests for a single class × week save).
        const entriesToSave = data.students.filter(s => changedEntries.has(s.student_id));

        const lockedLessonKeys = new Set(
            (data.lessons ?? []).filter(l => isAttendanceLockedLesson(l.start_datetime))
                .map(l => l.lesson_number.toString())
        );

        // Build manual leaderboard-entry payloads (curators/admins only; teachers skip).
        const entryUpdates: any[] = [];
        if (!isTeacher) {
            for (const student of entriesToSave) {
                const entryData: any = {
                    user_id: student.student_id,
                    group_id: selectedGroupId,
                    week_number: currentWeek,
                };
                // Only send fields that have actual values (not null/undefined).
                if (student.curator_hour !== null && student.curator_hour !== undefined) entryData.curator_hour = student.curator_hour;
                if (student.mock_exam !== null && student.mock_exam !== undefined) entryData.mock_exam = student.mock_exam;
                if (student.study_buddy !== null && student.study_buddy !== undefined) entryData.study_buddy = student.study_buddy;
                if (student.self_reflection_journal !== null && student.self_reflection_journal !== undefined) entryData.self_reflection_journal = student.self_reflection_journal;
                if (student.weekly_evaluation !== null && student.weekly_evaluation !== undefined) entryData.weekly_evaluation = student.weekly_evaluation;
                if (student.extra_points !== null && student.extra_points !== undefined) entryData.extra_points = student.extra_points;
                entryUpdates.push(entryData);
            }
        }

        // Build attendance payloads only when this role may mark attendance.
        // Curators are read-only on attendance (the backend rejects it), so skipping
        // here avoids a burst of pointless 403s when they edit unrelated fields.
        const attendanceUpdates: any[] = [];
        if (canMarkAttendance) {
            for (const student of entriesToSave) {
                for (const [lessonKey, lessonStatus] of cellsToSave(student.lessons, lockedLessonKeys)) {
                    const excuseTouched = touchedExcuses.has(`${student.student_id}:${lessonKey}`);
                    const excuseValue = Boolean(lessonStatus.excused);
                    attendanceUpdates.push({
                        group_id: selectedGroupId,
                        week_number: currentWeek,
                        lesson_index: parseInt(lessonKey),
                        student_id: student.student_id,
                        score: lessonStatus.attendance_status === 'attended' ? 10 : 0,
                        // Raw status normally — but a row whose excuse we're writing this
                        // save must send a spelling the backend actually recognises as an
                        // absence. A row painted "Не был" can have a raw status of
                        // `registered` (the backend's catch-all for legacy import
                        // spellings like `no`/`0`), which normalizes to "unknown" server
                        // side — `excused: true` alongside it 422s the WHOLE batch. See
                        // `excuseAwareStatus`.
                        status: excuseAwareStatus(lessonStatus.attendance_status, excuseTouched, excuseValue),
                        event_id: lessonStatus.event_id ?? null,
                        activity_score: lessonStatus.activity_score ?? undefined,
                        // Only present when the user actually touched this cell's excuse —
                        // an absent field means "leave the stored value alone" server-side,
                        // while this loop otherwise walks every lesson of every changed
                        // student, touched or not.
                        ...excusePayload(excuseTouched, excuseValue, lessonStatus.excuse_note ?? null),
                        // Why a mark Meet decided was changed, when the teacher gave a reason.
                        ...reasonPayload(reasons.get(`${student.student_id}:${lessonKey}`)),
                    });
                }
            }
        }

        // Entries and attendance are independent — fire both bulk writes together.
        const [entryResult, attendanceResult] = await Promise.allSettled([
            entryUpdates.length ? updateLeaderboardEntriesBulk({ entries: entryUpdates }) : Promise.resolve(null),
            attendanceUpdates.length ? updateAttendanceBulk({ updates: attendanceUpdates }) : Promise.resolve(null),
        ]);

        if (entryResult.status === 'rejected') {
            console.error('Failed to save leaderboard entries', entryResult.reason);
        }
        if (attendanceResult.status === 'rejected') {
            attendanceFailures = attendanceUpdates.length;
            // A validation failure (e.g. an excuse without a reason) comes back as a
            // Russian 422 detail from the backend — show that message verbatim rather
            // than replacing it with a generic one.
            // FastAPI's request-validation 422 sends `detail` as an array of error
            // objects rather than a string — only show it when it's actually text,
            // otherwise fall back to the generic message below.
            const rawDetail = (attendanceResult.reason as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
            attendanceErrorDetail = typeof rawDetail === 'string' ? rawDetail : undefined;
            console.error('Failed to save attendance', attendanceResult.reason);
        }

        // Entry save is all-or-nothing per request: success ⇒ every changed row saved.
        successCount = entryResult.status === 'fulfilled' ? entriesToSave.length : 0;

        if (successCount === entriesToSave.length && attendanceFailures === 0) {
            toast(t('attendance.toast.allSaved'), "success");
            setChangedEntries(new Set());
            setTouchedExcuses(new Set());
            setConfigChanged(false);
            setOverrideReasons(new Map());
            if (attendanceUpdates.length) setMeetRefresh((n) => n + 1);
            
            // Reload config from server to ensure it's persisted
            try {
                const result = await getWeeklyLessonsWithHwStatus(selectedGroupId, currentWeek);
                if (result.config) {
                    console.log('Reloaded config from server:', result.config);
                    setEnabledCols({
                        curator_hour: result.config.curator_hour_enabled === true,
                        study_buddy: result.config.study_buddy_enabled === true,
                        self_reflection_journal: result.config.self_reflection_journal_enabled === true,
                        weekly_evaluation: result.config.weekly_evaluation_enabled === true,
                        extra_points: result.config.extra_points_enabled === true,
                        curator_hour_date: result.config.curator_hour_date
                    });
                }
            } catch (reloadErr) {
                console.error('Failed to reload config:', reloadErr);
            }
        } else if (attendanceFailures > 0) {
            toast(attendanceErrorDetail || t('attendance.toast.marksFailed', { count: attendanceFailures }), "error");
        } else {
            toast(t('attendance.toast.entriesPartial', { saved: successCount, total: entriesToSave.length }), "error");
        }
    } catch (e) {
        console.error("Failed to save configuration:", e);
        toast(t('attendance.toast.configFailed'), "error");
    } finally {
        setIsSaving(false);
    }
  };





  const formatDateParts = (dateStr: string) => {
      // Backend stores in UTC, convert to Kazakhstan time (GMT+5).
      // parseAsUTC appends "Z" when missing — new Date() would otherwise
      // treat a naive string as browser-local and skip the conversion.
      // formatDate/formatTime parse it with parseAsUTC and show it on Almaty time.
      // Date: 03 фев
      const date = formatDate(dateStr, { day: '2-digit', month: 'short' }, locale).replace('.', '');
      // DayTime: Пн 19:00
      const day = formatDate(dateStr, { weekday: 'short' }, locale); // Пн, Вт
      const time = formatTime(dateStr, undefined, locale);
      // Capitalize day and month if needed
      const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
      
      return { date, dayTime: `${dayCap} ${time}` };
  };

  const renderSectionFraction = (correct?: number | null, total?: number | null) => {
    if (correct == null) return t('attendance.exam.notTaken');
    if (total != null && total > 0) return `${correct}/${total}`;
    return `${correct}`;
  };

  // A section cell: the raw correct/total fraction.
  const renderExamSectionContent = (correct?: number | null, total?: number | null) => (
    <span className="text-foreground dark:text-foreground">{renderSectionFraction(correct, total)}</span>
  );

  // IELTS bands are conventionally rendered with one decimal: 7.0, 7.5
  const formatBand = (band?: number | null) => (band == null ? '—' : band.toFixed(1));

  // A booked / missed / cancelled speaking session is real activity even with a
  // null band — the leaderboard must not collapse it into "no result".
  const hasSpeakingActivity = (s: StudentRow) =>
    s.ielts_speaking_source != null || s.ielts_speaking_status != null;

  const hasIeltsData = (s: StudentRow) =>
    s.ielts_listening_band != null || s.ielts_reading_band != null ||
    s.ielts_writing_band != null || s.ielts_speaking_band != null ||
    s.ielts_overall_band != null || hasSpeakingActivity(s);

  // speakingSessionAt is timezone-aware ISO-8601 (may carry a +05:00 offset) — parse
  // as an absolute instant and render in Almaty local time, matching the schedule grid.
  const formatSpeakingSessionAt = (iso?: string | null): string | null => {
    if (!iso) return null;
    const date = formatDate(iso, { day: '2-digit', month: 'short' }, locale);
    if (!date) return null;
    return `${date}, ${formatTime(iso, undefined, locale)}`;
  };

  // Operational speaking-session states, in the leaderboard's own vocabulary; `short` is
  // used in the dense inline cell.
  const SPEAKING_STATUS_META: Record<
    NonNullable<StudentRow['ielts_speaking_status']>,
    { label: string; short: string; className: string; dot: string }
  > = {
    completed: { label: t('attendance.speaking.completed'), short: t('attendance.speaking.completedShort'), className: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40', dot: 'bg-emerald-500' },
    scheduled: { label: t('attendance.speaking.scheduled'), short: t('attendance.speaking.scheduledShort'), className: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40', dot: 'bg-amber-500' },
    no_show: { label: t('attendance.speaking.noShow'), short: t('attendance.speaking.noShow'), className: 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40', dot: 'bg-red-500' },
    cancelled: { label: t('attendance.speaking.cancelled'), short: t('attendance.speaking.cancelled'), className: 'text-muted-foreground bg-muted dark:bg-secondary', dot: 'bg-muted-foreground/50' },
  };

  const hasIeltsEnFeedback = (s: StudentRow) =>
    Boolean(s.ielts_listening_feedback || s.ielts_reading_feedback ||
      s.ielts_writing_feedback?.task1 || s.ielts_writing_feedback?.task2 ||
      (s.ielts_speaking_feedback && Object.values(s.ielts_speaking_feedback).some(Boolean)));

  const hasIeltsRuFeedback = (s: StudentRow) =>
    Boolean(s.ielts_listening_feedback_ru || s.ielts_reading_feedback_ru ||
      s.ielts_writing_feedback_ru?.task1 || s.ielts_writing_feedback_ru?.task2 ||
      (s.ielts_speaking_feedback_ru && Object.values(s.ielts_speaking_feedback_ru).some(Boolean)));

  // Which feedback text a modal opens on: the viewer's language when that text exists.
  const feedbackLang = (hasRu: boolean, hasEn: boolean): Locale =>
    locale === 'ru' ? (hasRu || !hasEn ? 'ru' : 'en') : (hasEn || !hasRu ? 'en' : 'ru');

  // Week-navigation bounds and the group's "real" current week (based on today).
  const maxWeek = selectedGroup?.max_week || 52;
  const realCurrentWeek = selectedGroup
    ? Math.min(maxWeek, selectedGroup.current_week ?? calculateCurrentWeekNumber(groupWeekAnchor(selectedGroup)))
    : 1;
  const isViewingCurrentWeek = currentWeek === realCurrentWeek;
  const viewedRangeLabel = data
    ? `${formatDayMonth(new Date(data.week_start), locale)} – ${(() => {
        const end = new Date(data.week_start);
        end.setDate(end.getDate() + 6);
        return formatDayMonth(end, locale);
      })()}`
    : selectedGroup
      ? weekRangeLabel(groupWeekAnchor(selectedGroup), currentWeek, locale)
      : '';

  return (
    <>
    <div className={cn("w-full h-full space-y-4", !embedded && "p-4 bg-card dark:bg-card rounded")}>
      {/* Header Controls */}
      <div className="flex flex-col gap-3 border-b pb-4 dark:border-border">
        {/* Row 1: title (or the wrapper's view toggle) + save */}
        <div className="flex items-center justify-between gap-3">
          {titleSlot ?? <h1 className="text-xl font-semibold text-foreground dark:text-foreground">{t('attendance.header.title')}</h1>}
          <Button
              onClick={() => void handleSaveChanges()}
              disabled={(!configChanged && changedEntries.size === 0) || isSaving}
              size="sm"
              className={cn(
                  "h-8 transition-colors rounded-md font-medium",
                  (configChanged || changedEntries.size > 0) ? "bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600" : "bg-muted text-muted-foreground dark:bg-secondary"
              )}
          >
              {isSaving ? (
                  <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> {t('attendance.header.saving')}</>
              ) : (
                  <><Save className="w-3 h-3 mr-2" /> {t('attendance.header.save', { count: changedEntries.size })}</>
              )}
          </Button>
        </div>

        {/* Row 2: filters (left) + week navigation (right) */}
        <div className="flex flex-col @4xl:flex-row @4xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={programFilter}
                    onValueChange={(value) => setProgramFilter(value as 'all' | CourseType)}
                >
                    <SelectTrigger className="h-8 w-[130px] rounded-md border-border text-xs">
                        <SelectValue placeholder={t('attendance.filters.subject')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">{t('attendance.filters.allSubjects')}</SelectItem>
                        <SelectItem value="sat">SAT</SelectItem>
                        <SelectItem value="ielts">IELTS</SelectItem>
                        <SelectItem value="nuet">NUET</SelectItem>
                        <SelectItem value="general_english">General English</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-full @xl:w-[300px] @2xl:w-[360px] max-w-full">
                    <Popover open={groupPickerOpen} onOpenChange={(open) => { setGroupPickerOpen(open); if (!open) setGroupQuery(''); }}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="flex h-8 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 text-xs"
                            >
                                <span className="truncate">
                                    {(() => {
                                        const g = filteredGroups.find((g) => g.id === selectedGroupId);
                                        return g ? formatGroupLabel(g) : t('attendance.picker.selectGroup');
                                    })()}
                                </span>
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(300px,calc(100vw-2rem))] md:w-[360px] p-0" align="start">
                            <div className="p-2 border-b border-border">
                                <Input
                                    autoFocus
                                    value={groupQuery}
                                    onChange={(e) => setGroupQuery(e.target.value)}
                                    placeholder={t('attendance.picker.search')}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="flex items-center justify-between px-3 py-1 border-b border-border">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t('common.groups', { count: groupMatches.length })}
                                </span>
                            </div>
                            <div className="max-h-72 overflow-y-auto py-0.5">
                                {groupMatches.length === 0 ? (
                                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                        {t('attendance.picker.nothingFound')}
                                    </div>
                                ) : (
                                    groupMatches.map((g) => {
                                        const program = getGroupProgramType(g);
                                        const teacher = (g.teacher_name || '').trim();
                                        return (
                                            <button
                                                key={g.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedGroupId(g.id);
                                                    setCurrentWeek(
                                                        g.current_week ?? calculateCurrentWeekNumber(groupWeekAnchor(g))
                                                    );
                                                    setGroupPickerOpen(false);
                                                    setGroupQuery('');
                                                }}
                                                className={cn(
                                                    "flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-muted dark:hover:bg-secondary",
                                                    selectedGroupId === g.id && "bg-brand-surface/60 dark:bg-secondary"
                                                )}
                                            >
                                                <Check className={cn('h-3.5 w-3.5 shrink-0 mt-px', selectedGroupId === g.id ? 'opacity-100 text-brand' : 'opacity-0')} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                                            PROGRAM_BADGE_STYLES[program]
                                                        )}>
                                                            {PROGRAM_LABELS[program]}
                                                        </span>
                                                        <span className="truncate text-xs font-medium text-foreground dark:text-foreground">
                                                            {getGroupDateText(g)}
                                                        </span>
                                                        {g.is_over ? (
                                                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{t('attendance.picker.completed')}</span>
                                                        ) : closeLabel(g) && (
                                                            // Finished, but still open to everyone until the Wednesday cutoff.
                                                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{closeLabel(g)}</span>
                                                        )}
                                                    </div>
                                                    {teacher && (
                                                        <div className="truncate text-[11px] text-muted-foreground leading-tight">
                                                            {teacher}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="flex items-center gap-2 px-1">
                    <Checkbox
                        id="hide-completed-groups"
                        checked={hideCompletedGroups}
                        onCheckedChange={(checked) => setHideCompletedGroups(Boolean(checked))}
                    />
                    <Label
                        htmlFor="hide-completed-groups"
                        className="text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap"
                    >
                        {t('attendance.filters.hideCompleted')}
                    </Label>
                </div>
            </div>

            {/* Week navigation */}
            {selectedGroupId && (
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-stretch rounded-lg border border-border overflow-hidden bg-card dark:bg-card">
                        <button
                            type="button"
                            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                            disabled={currentWeek <= 1}
                            title={currentWeek <= 1 ? t('attendance.week.first') : t('attendance.week.previous')}
                            className="flex w-8 items-center justify-center border-r border-border text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <Select value={currentWeek.toString()} onValueChange={(val) => setCurrentWeek(parseInt(val))}>
                            <SelectTrigger className="h-auto min-w-[150px] gap-2 border-none rounded-none px-3 py-1 focus:ring-0 shadow-none bg-transparent hover:bg-muted/60">
                                <SelectValue>
                                    <div className="flex flex-col items-center leading-tight text-center">
                                        <span className="text-xs font-semibold text-foreground dark:text-foreground">
                                            {t('attendance.week.label', { week: currentWeek })}
                                            <span className="text-muted-foreground font-normal"> / {maxWeek}</span>
                                            {isViewingCurrentWeek && <span className="ml-1 text-[9px] font-bold uppercase text-brand align-middle">{t('attendance.week.now')}</span>}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{viewedRangeLabel}</span>
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => (
                                    <SelectItem key={w} value={w.toString()} className="text-xs">
                                        <span className="flex items-center gap-2">
                                            <span className="font-medium">{t('attendance.week.label', { week: w })}</span>
                                            {selectedGroup && <span className="text-muted-foreground">{weekRangeLabel(groupWeekAnchor(selectedGroup), w, locale)}</span>}
                                            {w === realCurrentWeek && <span className="text-[9px] font-bold uppercase text-brand">{t('attendance.week.now')}</span>}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <button
                            type="button"
                            onClick={() => setCurrentWeek(Math.min(maxWeek, currentWeek + 1))}
                            disabled={currentWeek >= maxWeek}
                            title={currentWeek >= maxWeek ? t('attendance.week.last') : t('attendance.week.next')}
                            className="flex w-8 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {!isViewingCurrentWeek && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setCurrentWeek(realCurrentWeek)}
                            title={t('attendance.week.goToCurrent')}
                        >
                            {t('attendance.week.nowButton')}
                        </Button>
                    )}

                    {isIeltsGroup && (
                        <label
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-card dark:bg-card px-2 h-8 cursor-pointer select-none"
                            title={t('attendance.platformTests.title')}
                        >
                            <input
                                type="checkbox"
                                checked={platformTestsOn}
                                disabled={savingPlatformTests}
                                onChange={(e) => savePlatformTests(e.target.checked)}
                                className="h-3.5 w-3.5"
                            />
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('attendance.platformTests.label')}</span>
                            {savingPlatformTests && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </label>
                    )}
                    {isNuetGroup && (
                        <div
                            className="flex items-center gap-1.5 rounded-lg border border-border bg-card dark:bg-card px-2 h-8"
                            title={t('attendance.nuetOffset.title')}
                        >
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{t('attendance.nuetOffset.label')}</span>
                            <input
                                type="number"
                                min={0}
                                max={52}
                                value={weekOffset}
                                disabled={savingOffset}
                                onChange={(e) => setWeekOffset(Math.max(0, Math.min(52, parseInt(e.target.value) || 0)))}
                                onBlur={(e) => {
                                    const v = Math.max(0, Math.min(52, parseInt(e.target.value) || 0));
                                    if (v !== (selectedGroup?.weekly_set_week_offset ?? 0)) saveWeekOffset(v);
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                className="w-10 text-center text-xs bg-transparent outline-none text-foreground dark:text-foreground"
                            />
                            {savingOffset && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </div>
                    )}
                    {canGiveStar && selectedGroup && data && (
                        <StarOfWeekButton
                            groupId={selectedGroup.id}
                            students={data.students.map((s) => ({ id: s.student_id, name: s.student_name }))}
                        />
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="border border-border overflow-x-auto">
            {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">{t('attendance.empty.noGroups')}</p>
                    <p className="text-xs mt-1">{t('attendance.empty.hint')}</p>
                </div>
            ) : loading || !data ? (
                <Table className="border-collapse w-full text-xs">
                    <TableHeader className="bg-muted dark:bg-secondary sticky top-0 z-30">
                        <TableRow className="h-auto border-b border-border hover:bg-muted dark:hover:bg-secondary">
                             <TableHead className="w-48 sticky left-0 z-40 bg-muted dark:bg-secondary p-2 border-r border-border"><Skeleton className="h-4 w-20 bg-gray-200 dark:bg-muted" /></TableHead>
                             {/* Skeleton columns */}
                             {[1, 2, 3].map(i => (
                                <TableHead key={i} className="p-0 border-r border-border h-12 min-w-[100px] align-middle bg-muted dark:bg-secondary">
                                   <div className="p-1 flex justify-center"><Skeleton className="h-3 w-12 bg-gray-200 dark:bg-muted" /></div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <TableRow key={idx} className="border-b border-border h-8">
                                <TableCell className="p-2 sticky left-0 z-30 bg-card dark:bg-card border-r border-border">
                                    <Skeleton className="h-3 w-32 bg-muted" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
            <Table className="border-collapse w-full text-xs">
              <TableHeader className="bg-muted dark:bg-secondary sticky top-0 z-30">
                <TableRow className="h-auto border-b border-border hover:bg-muted dark:hover:bg-secondary">
                    <TableHead className="w-28 md:w-48 sticky left-0 z-40 bg-muted dark:bg-secondary font-semibold text-foreground p-2 border-r border-border text-left align-middle text-center">
                        {t('attendance.grid.student')}
                    </TableHead>
                    {/* Dynamic Lesson Columns */}
                    {data.lessons.map(lesson => {
                        const lessonIsFuture = isAttendanceLockedLesson(lesson.start_datetime);
                        return (
                        <TableHead key={`lesson-${lesson.lesson_number}`} className="p-0 text-center border-r border-border h-auto min-w-[168px] md:min-w-[196px] align-top bg-muted dark:bg-secondary">
                            <div className="flex flex-col h-full">
                                <div
                                    className={cn(
                                        "py-2 border-b border-border font-semibold text-foreground bg-gray-200/50 dark:bg-muted/60 text-xs flex flex-col items-center relative group/lesson",
                                        canMarkAttendance && !lessonIsFuture && "cursor-pointer hover:bg-gray-300/50 dark:hover:bg-muted"
                                    )}
                                    onClick={() => markAllPresentForLesson(lesson)}
                                    title={canMarkAttendance && !lessonIsFuture ? t('attendance.grid.markAllTitle') : undefined}
                                >
                                    <span className="text-sm">{formatDateParts(lesson.start_datetime).date}</span>
                                    <span className="text-[10px] font-normal text-muted-foreground leading-tight uppercase">{formatDateParts(lesson.start_datetime).dayTime}</span>
                                    {/* Слоты рендерятся всегда (invisible, когда пусто), чтобы шапки всех уроков были одной высоты */}
                                    <span className={cn("text-[9px] font-normal text-brand truncate max-w-[150px] leading-tight", !lesson.topic && "invisible")} title={lesson.topic ?? undefined}>{lesson.topic || '·'}</span>
                                    {/* Замена: показываем имя подменяющего учителя под датой (тот же приём с invisible-слотом) */}
                                    <span
                                        className={cn("text-[9px] font-medium text-amber-600 dark:text-amber-400 truncate max-w-[150px] leading-tight", !lesson.substitute_teacher_name && "invisible")}
                                        title={lesson.substitute_teacher_name ? t('attendance.grid.substitute', { name: lesson.substitute_teacher_name }) : undefined}
                                    >
                                        {lesson.substitute_teacher_name ? t('attendance.grid.substitute', { name: lesson.substitute_teacher_name }) : '·'}
                                    </span>
                                    {canMarkAttendance && (
                                        <span className={cn("mt-0.5 flex items-center gap-1.5 leading-tight", lessonIsFuture && "invisible")}>
                                            <span className="text-[9px] font-bold uppercase tracking-tight text-brand">
                                                {t('attendance.grid.markAll')}
                                            </span>
                                            {/* «Баллы за урок» (2026-09-28): the whole lesson's scores on one screen, from its start. */}
                                            {lesson.event_id && !(isTeacher && lesson.is_substitution) && (
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold uppercase tracking-tight text-yellow-600 hover:bg-yellow-100 hover:dark:bg-yellow-500/15 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
                                                    title={t('attendance.grid.scoresTitle')}
                                                    onClick={(e) => { e.stopPropagation(); setScoresLesson(lesson); }}
                                                >
                                                    <Star className="w-3 h-3" aria-hidden />
                                                    {t('attendance.grid.scores')}
                                                </button>
                                            )}
                                        </span>
                                    )}
                                    {/* The lesson's own page (2026-09-28): register, scores, notes, recording, materials. */}
                                    {lesson.event_id ? (
                                        <Link
                                            to={lessonPath(lesson.event_id)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute top-1 right-1 p-1 text-muted-foreground hover:text-brand"
                                            title={t('attendance.grid.openLesson')}
                                            aria-label={t('attendance.grid.openLesson')}
                                        >
                                            <ArrowUpRight className="w-3.5 h-3.5" />
                                        </Link>
                                    ) : null}
                                    {canMarkAttendance && (
                                        <button
                                            type="button"
                                            className="absolute top-1 right-6 p-1 text-muted-foreground hover:text-brand opacity-100 md:opacity-0 md:group-hover/lesson:opacity-100 transition-opacity"
                                            title={t('attendance.grid.lessonTopic')}
                                            onClick={(e) => { e.stopPropagation(); setTopicModal({ open: true, lesson, value: lesson.topic ?? '' }); }}
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <LessonMaterialsBadge
                                        eventId={lesson.event_id}
                                        count={materialCounts[lesson.event_id] ?? 0}
                                        role={user?.role}
                                        onOpen={(eventId) => setMaterialsDialog({ open: true, eventId })}
                                    />
                                </div>
                                <div className="flex flex-1 items-stretch">
                                    <div className="w-1/2 py-2 text-[10px] font-bold text-muted-foreground border-r border-border text-center uppercase tracking-tighter flex items-center justify-center">
                                        {t('attendance.grid.lesson')}
                                    </div>
                                    {lessonHomeworks(lesson).length === 0 && canAssignHw && selectedGroupId ? (
                                        <button
                                            type="button"
                                            className="w-1/2 py-2 text-[10px] font-bold bg-gray-50 dark:bg-secondary text-center uppercase tracking-tighter flex items-center justify-center gap-0.5 text-brand hover:bg-brand-surface transition-colors"
                                            title={t('attendance.grid.assignTitle')}
                                            onClick={() => navigate(`/homework/new/group/${selectedGroupId}?lesson_number=${lesson.lesson_number}`)}
                                        >
                                            <Plus className="w-3 h-3" />{t('attendance.grid.assign')}
                                        </button>
                                    ) : (
                                    <div className="w-1/2 py-2 text-[10px] font-bold text-muted-foreground bg-gray-50 dark:bg-secondary text-center uppercase tracking-tighter flex items-center justify-center" title={lessonHomeworks(lesson).map(h => h.title).join(', ') || t('attendance.grid.noHomework')}>
                                        {lessonHomeworks(lesson).length > 1 ? t('attendance.grid.homeworkCount', { count: lessonHomeworks(lesson).length }) : t('attendance.grid.homework')}
                                    </div>
                                    )}
                                </div>
                            </div>
                        </TableHead>
                        );
                    })}
                    
                    {/* Ручные кураторские колонки не показываем учителям — их зона это уроки и тесты */}
                    {!isTeacher && (
                    <TableHead
                        className={cn("text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-muted dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.curator_hour && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-muted-foreground")}
                        onClick={() => toggleColumn('curator_hour')}
                        title={enabledCols.curator_hour ? t('attendance.columns.clickToHide') : t('attendance.columns.clickToShow')}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span className="whitespace-pre-line">{t('attendance.columns.curatorHour')}</span>
                            <Input
                                type="date"
                                className="h-6 w-24 text-[10px] p-1 mt-1 border-border"
                                value={enabledCols.curator_hour_date || ''}
                                disabled={isTeacher}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const newDate = e.target.value;
                                    setEnabledCols(prev => ({ ...prev, curator_hour_date: newDate }));
                                    if (!isTeacher) {
                                        updateLeaderboardConfig({
                                            group_id: selectedGroupId!,
                                            week_number: currentWeek,
                                            curator_hour_date: newDate
                                        });
                                    }
                                }}
                            />
                            {enabledCols.curator_hour 
                                ? <Eye className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    )}
                    {showExamSections ? (
                        <>
                            <TableHead className="text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight">
                                {examLabel} Math
                            </TableHead>
                            <TableHead className="text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight">
                                {examLabel} Verbal
                            </TableHead>
                        </>
                    ) : isIeltsGroup ? (
                        <TableHead className="text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight">IELTS</TableHead>
                    ) : (
                        <TableHead className="text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight"><span className="whitespace-pre-line">{t('attendance.columns.mockExam')}</span></TableHead>
                    )}
                    {!isTeacher && (<>
                    <TableHead
                        className={cn("text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-muted dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.study_buddy && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-muted-foreground")}
                        onClick={() => toggleColumn('study_buddy')}
                        title={enabledCols.study_buddy ? t('attendance.columns.clickToHide') : t('attendance.columns.clickToShow')}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span className="whitespace-pre-line">{t('attendance.columns.studyBuddy')}</span>
                            {enabledCols.study_buddy 
                                ? <Eye className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-muted dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.self_reflection_journal && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-muted-foreground")}
                        onClick={() => toggleColumn('self_reflection_journal')}
                        title={enabledCols.self_reflection_journal ? t('attendance.columns.clickToHide') : t('attendance.columns.clickToShow')}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>{t('attendance.columns.journal')}</span>
                            {enabledCols.self_reflection_journal 
                                ? <Eye className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-muted dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.weekly_evaluation && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-muted-foreground")}
                        onClick={() => toggleColumn('weekly_evaluation')}
                        title={enabledCols.weekly_evaluation ? t('attendance.columns.clickToHide') : t('attendance.columns.clickToShow')}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span className="whitespace-pre-line">{t('attendance.columns.weeklyEvaluation')}</span>
                            {enabledCols.weekly_evaluation 
                                ? <Eye className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-foreground bg-muted dark:bg-secondary border-r border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-muted dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.extra_points && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-muted-foreground")}
                        onClick={() => toggleColumn('extra_points')}
                        title={enabledCols.extra_points ? t('attendance.columns.clickToHide') : t('attendance.columns.clickToShow')}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>{t('attendance.columns.extra')}</span>
                            {enabledCols.extra_points 
                                ? <Eye className="w-3 h-3 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-muted-foreground absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    </>)}

                    <TableHead className="text-center font-bold p-2 w-16 text-foreground dark:text-foreground bg-muted dark:bg-secondary border-r border-border align-middle">{t('attendance.columns.total')}</TableHead>
                    <TableHead className="text-center font-bold p-2 w-16 md:sticky md:right-0 z-40 bg-muted dark:bg-secondary align-middle md:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student, index) => {
                    const percent = calculatePercent(student);
                    return (
                    <TableRow key={student.student_id} className="hover:bg-brand-surface/50 dark:hover:bg-secondary/50 border-b border-border h-16">
                        <TableCell className="p-2 sticky left-0 z-30 bg-card dark:bg-card border-r border-border">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground w-4 text-right font-mono">{index + 1}</span>
                                <UserAvatar userId={student.student_id} name={student.student_name} avatarUrl={student.avatar_url} mascot={student.mascot} isStudent size={26} className="hidden md:block" />
                                <button
                                    type="button"
                                    onClick={() => setStudentHwModal({ open: true, studentId: student.student_id, studentName: student.student_name })}
                                    title={t('attendance.row.allHomework', { name: student.student_name })}
                                    className="group flex items-center gap-1 truncate max-w-[84px] md:max-w-[150px] font-medium text-foreground dark:text-foreground hover:text-brand hover:underline transition-colors"
                                >
                                    <span className="truncate">{student.student_name}</span>
                                    {student.freeze?.is_frozen && (
                                        <span
                                            className="ml-1 shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                                            title={student.freeze.planned_resume_date
                                                ? t('attendance.row.plannedReturn', { date: student.freeze.planned_resume_date })
                                                : undefined}
                                        >
                                            {student.freeze.label}
                                        </span>
                                    )}
                                    <ClipboardList className="w-3 h-3 shrink-0 text-muted-foreground/50 group-hover:text-brand " />
                                </button>
                            </div>
                        </TableCell>
                        
                        {/* Dynamic Lesson Cells */}
                        {data.lessons.map(lessonInfo => {
                            const lessonKey = lessonInfo.lesson_number.toString();
                            const lessonStatus = student.lessons[lessonKey];
                            // Handle cases where lesson data might not be populated for student yet
                            const status = lessonStatus ? lessonStatus.attendance_status : 'absent';
                            const cellIsFuture = isAttendanceLockedLesson(lessonInfo.start_datetime);
                            // Lesson predates the student's join date: not theirs, so
                            // show a neutral blank cell (both halves) and skip editing.
                            const preEnroll = lessonStatus?.enrolled === false;
                            const frozenLesson = Boolean(lessonStatus?.frozen);
                            const blockedLesson = Boolean(lessonStatus?.blocked);
                            // Past lesson with no attendance record yet: show a distinct
                            // "Не отмечено" cell instead of a red ABSENT default. Future
                            // lessons are handled by the toggle's isFuture branch.
                            const unmarked =
                                !preEnroll && !frozenLesson && !blockedLesson && !cellIsFuture && lessonStatus?.marked === false;
                            const needsScore = scoreDue(meetDecidedLessons.has(lessonInfo.event_id ?? -1), status, lessonStatus?.activity_score);

                            return (
                                <TableCell key={`cell-${lessonKey}`} className="p-0 border-r border-border">
                                    <div className="flex w-full h-16 items-stretch">
                                        {preEnroll ? (
                                        <div
                                            className="w-1/2 border-r border-border flex items-center justify-center text-[11px] text-muted-foreground/50 select-none"
                                            title={t('attendance.cell.notEnrolled')}
                                        >—</div>
                                        ) : frozenLesson ? (
                                        <div
                                            className="w-1/2 border-r border-border flex items-center justify-center bg-sky-50 dark:bg-sky-950/30 text-[10px] text-sky-700 dark:text-sky-300 select-none"
                                            title={t('attendance.cell.frozenTitle')}
                                        >{t('attendance.cell.frozen')}</div>
                                        ) : blockedLesson ? (
                                        <div
                                            className="w-1/2 border-r border-border flex items-center justify-center bg-amber-50 dark:bg-amber-950/30 text-[10px] text-amber-800 dark:text-amber-300 select-none"
                                            title={t('attendance.cell.blockedTitle')}
                                        >{t('attendance.cell.blocked')}</div>
                                        ) : unmarked ? (
                                        <div
                                            className={cn(
                                                "relative w-1/2 border-r border-border flex items-center justify-center p-1",
                                                canMarkAttendance ? "cursor-pointer hover:bg-muted/60 transition-colors" : "cursor-default"
                                            )}
                                            onClick={() => { if (canMarkAttendance) handleAttendanceChange(student.student_id, lessonKey, 'attended'); }}
                                            title={(canMarkAttendance
                                                ? t('attendance.cell.unmarkedClick')
                                                : t('attendance.cell.unmarkedView'))
                                                + (meetVerdicts.has(`${lessonInfo.event_id}:${student.student_id}`)
                                                    ? `\n${verdictNote(meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`), locale)}`
                                                    : '')}
                                        >
                                            <span className="w-full text-center text-[9px] md:text-[10px] leading-tight font-semibold uppercase text-muted-foreground border border-dashed border-border rounded px-1 py-1 whitespace-pre-line">
                                                {registerMode === 'live' && meetLessonState.get(lessonInfo.event_id ?? -1) === 'waiting'
                                                    ? t('attendance.cell.meetWillMark')
                                                    : t('attendance.cell.notMarked')}
                                            </span>
                                            {meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`) && (
                                                <MeetVerdictBadge verdict={meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`)!} locale={locale} register={meetRegister.get(`${lessonInfo.event_id}:${student.student_id}`)} />
                                            )}
                                            {/* A score given before Meet marked the student waits here and stays. */}
                                            {lessonStatus?.activity_score != null && (
                                                <span className="absolute top-0 right-0 text-[10px] px-1.5 bg-yellow-400 text-yellow-950 rounded-bl font-bold pointer-events-none" title={t('attendance.cell.activity', { score: lessonStatus.activity_score })}>
                                                    {lessonStatus.activity_score}
                                                </span>
                                            )}
                                        </div>
                                        ) : (
                                        <div
                                            className="w-1/2 border-r border-border relative group/att"
                                            onContextMenu={(e) => {
                                                if (!canMarkAttendance || !lessonStatus || cellIsFuture) return;
                                                e.preventDefault();
                                                setActivityModal({
                                                    open: true,
                                                    studentId: student.student_id,
                                                    lessonKey,
                                                    studentName: student.student_name,
                                                    currentScore: lessonStatus.activity_score ?? 0,
                                                });
                                            }}
                                        >
                                            <AttendanceToggle
                                                initialStatus={status}
                                                onChange={(newStatus) => handleAttendanceChange(student.student_id, lessonKey, newStatus)}
                                                disabled={user?.role === 'curator'}
                                                isFuture={cellIsFuture}
                                                note={[
                                                    verdictNote(meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`), locale),
                                                    registerNote(meetRegister.get(`${lessonInfo.event_id}:${student.student_id}`), locale),
                                                    spokeNote(meetTalk.get(`${lessonInfo.event_id}:${student.student_id}`), locale),
                                                ].filter(Boolean).join('\n') || null}
                                                excused={Boolean(lessonStatus?.excused)}
                                                excuseNote={lessonStatus?.excuse_note ?? null}
                                                onExcuseChange={(excused, excuseNote) => handleExcuseChange(student.student_id, lessonKey, excused, excuseNote)}
                                            />
                                            {!cellIsFuture && meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`) && (
                                                <MeetVerdictBadge verdict={meetVerdicts.get(`${lessonInfo.event_id}:${student.student_id}`)!} locale={locale} register={meetRegister.get(`${lessonInfo.event_id}:${student.student_id}`)} />
                                            )}
                                            {meetMismatches.get(`${lessonInfo.event_id}:${student.student_id}`)?.map((f) => {
                                                // Answered in Meet attendance: grey with a tick and the reason, instead of red.
                                                const reason = reasonText(f.review);
                                                const answered = f.review
                                                    ? ` · ${reason ? t('attendance.meet.reviewedReason', { reason }) : t('attendance.meet.reviewed')}${f.review.by ? ` (${f.review.by})` : ''}`
                                                    : '';
                                                return (
                                                    <span
                                                        key={f.code}
                                                        className={`absolute left-0.5 top-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full ring-2 ring-white dark:ring-card pointer-events-auto ${f.review ? 'bg-muted-foreground/60 dark:bg-slate-500' : 'bg-rose-600'}`}
                                                        title={`Meet: ${flagText(f, locale)}${answered}`}
                                                        aria-label={f.review
                                                            ? t('attendance.meet.reviewedAria')
                                                            : t('attendance.meet.mismatchAria')}
                                                    >
                                                        {f.review && <Check className="h-2 w-2 text-white" strokeWidth={4} aria-hidden />}
                                                    </span>
                                                );
                                            })}
                                            {lessonStatus?.activity_score != null && (
                                                <span className="absolute top-0 right-0 text-[10px] px-1.5 bg-yellow-400 text-yellow-950 rounded-bl font-bold pointer-events-none" title={t('attendance.cell.activity', { score: lessonStatus.activity_score })}>
                                                    {lessonStatus.activity_score}
                                                </span>
                                            )}
                                            {/* No activity star on an absence: a student who was not
                                                there had no activity to score, and the button sat on top
                                                of the excuse control. The right-click shortcut on the cell
                                                still opens the same dialog for anyone who needs it. */}
                                            {canMarkAttendance && lessonStatus && !cellIsFuture && !displaysAsAbsence(status) && (
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "absolute bottom-0.5 right-0.5 p-1.5 rounded-full text-white transition-opacity",
                                                        needsScore
                                                            ? "bg-amber-500 ring-2 ring-amber-300 opacity-100"
                                                            : "bg-black/20 hover:bg-black/35 opacity-100 md:opacity-0 md:group-hover/att:opacity-100"
                                                    )}
                                                    title={needsScore ? t('attendance.cell.scoreNeeded') : t('attendance.cell.activityScore')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActivityModal({
                                                            open: true,
                                                            studentId: student.student_id,
                                                            lessonKey,
                                                            studentName: student.student_name,
                                                            currentScore: lessonStatus.activity_score ?? 0,
                                                        });
                                                    }}
                                                >
                                                    <Star className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        )}
                                        <div className="w-1/2 bg-gray-50 dark:bg-secondary flex items-center justify-center p-0">
                                            {(() => {
                                                if (preEnroll) {
                                                    return <span className="w-full text-center text-[11px] text-muted-foreground/50 select-none">—</span>;
                                                }
                                                const hws = lessonHomeworks(lessonInfo);
                                                if (hws.length === 0) {
                                                    // Для учителя «Не задано» — сигнал (ДЗ не создано); кнопка Assign живёт в шапке колонки
                                                    return <span className={cn(
                                                        "w-full text-center text-[11px] italic leading-tight whitespace-pre-line",
                                                        isTeacher ? "text-rose-500 dark:text-rose-400 font-medium" : "text-muted-foreground/50"
                                                    )}>{t('attendance.hw.notAssigned')}</span>;
                                                }
                                                const statuses = lessonHwStatuses(lessonStatus);
                                                const rows = hws.map((hw, i) => ({
                                                    hw,
                                                    st: statuses.find(s => s.assignment_id === hw.id)
                                                        ?? (statuses.length === hws.length ? statuses[i] : null),
                                                }));
                                                const single = rows.length === 1;
                                                const openFeedback = (hw: HomeworkMeta, st: HomeworkStatus) => setHwModal({
                                                    open: true,
                                                    studentName: student.student_name,
                                                    lessonTitle: single
                                                        ? (lessonInfo.title || t('attendance.lessonNumber', { number: lessonInfo.lesson_number }))
                                                        : `${lessonInfo.title || t('attendance.lessonNumber', { number: lessonInfo.lesson_number })} — ${hw.title}`,
                                                    score: st.score,
                                                    maxScore: st.max_score ?? hw.max_score ?? undefined,
                                                    feedback: st.feedback ?? null,
                                                    submittedAt: st.submitted_at ?? null,
                                                    gradedAt: st.graded_at ?? null,
                                                });
                                                return (
                                                    <div className="w-full h-full flex flex-col items-stretch justify-center overflow-hidden">
                                                        {rows.map(({ hw, st }, i) => {
                                                            const hwMax = st?.max_score ?? hw.max_score ?? null;
                                                            const submitted = !!st?.submitted;
                                                            return (
                                                                <div
                                                                    key={hw.id ?? i}
                                                                    className={cn(
                                                                        "flex-1 min-h-0 w-full text-center flex items-center justify-center",
                                                                        single ? "text-[11px]" : rows.length > 2 ? "text-[9px]" : "text-[10px]",
                                                                        !single && i > 0 && "border-t border-border/60",
                                                                        submitted ? "text-green-700 dark:text-green-400 font-bold" : "text-muted-foreground",
                                                                        submitted && "cursor-pointer hover:bg-green-100 hover:dark:bg-green-500/15 dark:hover:bg-green-900/30 transition-colors"
                                                                    )}
                                                                    onClick={() => { if (submitted && st) openFeedback(hw, st); }}
                                                                    title={submitted
                                                                        ? t('attendance.hw.clickFeedback', { title: hw.title })
                                                                        : t('attendance.hw.notSubmittedTitle', { title: hw.title })}
                                                                >
                                                                    {submitted && st ? (
                                                                        single ? (
                                                                            <span className="flex flex-col items-center leading-none">
                                                                                <span>{st.score !== null ? `${st.score}${hwMax ? `/${hwMax}` : ''}` : t('attendance.hw.submitted')}</span>
                                                                                {st.late ? (
                                                                                    <span className="text-[10px] font-semibold text-amber-500 dark:text-amber-400 mt-0.5">{t('attendance.hw.late')}</span>
                                                                                ) : (st.score !== null && hwMax && hwMax > 0) ? (
                                                                                    <span className="text-[10px] font-normal text-muted-foreground mt-0.5">
                                                                                        {Math.round((st.score / hwMax) * 100)}%
                                                                                    </span>
                                                                                ) : null}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="leading-none">
                                                                                {st.score !== null ? `${st.score}${hwMax ? `/${hwMax}` : ''}` : t('attendance.hw.submitted')}
                                                                                {st.late && <span className="ml-0.5 font-semibold text-amber-500 dark:text-amber-400">{t('attendance.hw.lateShort')}</span>}
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        // Для учителя несданное ДЗ — зона куратора, приглушаем
                                                                        <span className={cn(
                                                                            "font-medium leading-tight whitespace-pre-line",
                                                                            isTeacher ? "text-muted-foreground" : "text-rose-500 dark:text-rose-400"
                                                                        )}>
                                                                            {single ? t('attendance.hw.notSubmitted') : rows.length > 2 ? '—' : t('attendance.hw.missing')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </TableCell>
                            );
                        })}

                        {!isTeacher && (
                        <TableCell className={cn("p-0 border-r border-border h-16", !enabledCols.curator_hour && "bg-muted dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.curator_hour} max={MAX_SCORES.curator_hour} onChange={(v) => handleManualScoreChange(student.student_id, 'curator_hour', v)} disabled={isTeacher} />
                        </TableCell>
                        )}
                        {showExamSections ? (
                            <>
                                {(() => {
                                    const mathHasData = student.sat_math_correct_count != null;
                                    const verbalHasData = student.sat_verbal_correct_count != null;
                                    return (
                                        <>
                                            <TableCell className="p-0 border-r border-border h-16">
                                                <div
                                                    className={cn(
                                                        "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                                        mathHasData ? "cursor-pointer hover:bg-brand-surface" : ""
                                                    )}
                                                    onClick={() => {
                                                        if (!mathHasData) return
                                                        setSatFeedbackLang(feedbackLang(Boolean(student.sat_math_feedback_ru), Boolean(student.sat_math_feedback)))
                                                        setSatModal({
                                                            open: true,
                                                            studentName: student.student_name,
                                                            section: 'math',
                                                            testName: student.sat_math_test_name ?? null,
                                                            feedback: student.sat_math_feedback ?? null,
                                                            feedbackRu: student.sat_math_feedback_ru ?? null,
                                                            correct: student.sat_math_correct_count ?? null,
                                                            total: student.sat_math_total_count ?? null,
                                                            completedAt: student.sat_math_completed_at ?? null,
                                                        })
                                                    }}
                                                    title={mathHasData ? t('attendance.exam.mathTitle') : undefined}
                                                >
                                                    {renderExamSectionContent(student.sat_math_correct_count, student.sat_math_total_count)}
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-0 border-r border-border h-16">
                                                <div
                                                    className={cn(
                                                        "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                                        verbalHasData ? "cursor-pointer hover:bg-brand-surface" : ""
                                                    )}
                                                    onClick={() => {
                                                        if (!verbalHasData) return
                                                        setSatFeedbackLang(feedbackLang(Boolean(student.sat_verbal_feedback_ru), Boolean(student.sat_verbal_feedback)))
                                                        setSatModal({
                                                            open: true,
                                                            studentName: student.student_name,
                                                            section: 'verbal',
                                                            testName: student.sat_verbal_test_name ?? null,
                                                            feedback: student.sat_verbal_feedback ?? null,
                                                            feedbackRu: student.sat_verbal_feedback_ru ?? null,
                                                            correct: student.sat_verbal_correct_count ?? null,
                                                            total: student.sat_verbal_total_count ?? null,
                                                            completedAt: student.sat_verbal_completed_at ?? null,
                                                        })
                                                    }}
                                                    title={verbalHasData ? t('attendance.exam.verbalTitle') : undefined}
                                                >
                                                    {renderExamSectionContent(student.sat_verbal_correct_count, student.sat_verbal_total_count)}
                                                </div>
                                            </TableCell>
                                        </>
                                    );
                                })()}
                            </>
                        ) : isIeltsGroup ? (
                            <TableCell className="p-0 border-r border-border h-16">
                                <div
                                    className={cn(
                                        "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                        hasIeltsData(student)
                                            ? "cursor-pointer hover:bg-emerald-50 hover:dark:bg-emerald-500/15 dark:hover:bg-emerald-900/20"
                                            : ""
                                    )}
                                    onClick={() => {
                                        if (!hasIeltsData(student)) return
                                        setIeltsFeedbackLang(feedbackLang(hasIeltsRuFeedback(student), hasIeltsEnFeedback(student)))
                                        setIeltsModal({ open: true, student })
                                    }}
                                    title={hasIeltsData(student) ? t('attendance.exam.ieltsTitle') : undefined}
                                >
                                    {student.ielts_overall_band != null ? (
                                        <span className="text-foreground dark:text-foreground">{formatBand(student.ielts_overall_band)}</span>
                                    ) : (student.ielts_speaking_status && student.ielts_speaking_status !== 'completed') ? (
                                        (() => {
                                            const meta = SPEAKING_STATUS_META[student.ielts_speaking_status!];
                                            const title = [meta.label, student.ielts_speaking_examiner, formatSpeakingSessionAt(student.ielts_speaking_session_at)]
                                                .filter(Boolean).join(' · ');
                                            return (
                                                <span
                                                    className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold", meta.className)}
                                                    title={title}
                                                >
                                                    {meta.short}
                                                </span>
                                            );
                                        })()
                                    ) : hasIeltsData(student) ? (
                                        <span className="text-muted-foreground">—</span>
                                    ) : (
                                        <span className="text-muted-foreground italic">{t('attendance.exam.notTaken')}</span>
                                    )}
                                </div>
                            </TableCell>
                        ) : (
                            <TableCell className="p-0 border-r border-border h-16">
                                <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                                    {student.mock_exam > 0 ? (
                                        <span className="text-foreground dark:text-foreground">{student.mock_exam}%</span>
                                    ) : (
                                        <span className="text-muted-foreground italic">{t('attendance.exam.notTaken')}</span>
                                    )}
                                </div>
                            </TableCell>
                        )}
                        {!isTeacher && (<>
                        <TableCell className={cn("p-0 border-r border-border", !enabledCols.study_buddy && "bg-muted dark:bg-secondary opacity-50 pointer-events-none")}>
                            <div className="h-16 w-full">
                                <AttendanceToggle
                                    initialStatus={student.study_buddy === 15 ? 'attended' : 'absent'}
                                    onChange={(s) => handleManualScoreChange(student.student_id, 'study_buddy', s === 'attended' ? '15' : '0')}
                                    disabled={isTeacher}
                                />
                            </div>
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-border", !enabledCols.self_reflection_journal && "bg-muted dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.self_reflection_journal} max={MAX_SCORES.self_reflection_journal} onChange={(v) => handleManualScoreChange(student.student_id, 'self_reflection_journal', v)} disabled={isTeacher} />
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-border", !enabledCols.weekly_evaluation && "bg-muted dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.weekly_evaluation} max={MAX_SCORES.weekly_evaluation} onChange={(v) => handleManualScoreChange(student.student_id, 'weekly_evaluation', v)} disabled={isTeacher} />
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-border", !enabledCols.extra_points && "bg-muted dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.extra_points} max={10} onChange={(v) => handleManualScoreChange(student.student_id, 'extra_points', v)} disabled={isTeacher} />
                        </TableCell>
                        </>)}

                        <TableCell className="p-2 text-center font-semibold text-foreground dark:text-foreground border-r border-border bg-card dark:bg-card">
                            {calculateTotal(student)}
                        </TableCell>
                         <TableCell className={cn(
                             "p-2 text-center font-bold md:sticky md:right-0 z-30 md:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                             getPercentColor(percent)
                         )}>
                            {percent}%
                        </TableCell>
                    </TableRow>
                    );
                })}
              </TableBody>
            </Table>
            )}
      </div>
      {selectedGroup && <GroupAchievementsPanel groupId={selectedGroup.id} />}
    </div>

    {/* ── HW Feedback Modal ──────────────────────────────────────── */}
    <Dialog open={hwModal.open} onOpenChange={(open) => setHwModal(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="text-xs text-muted-foreground mb-0.5">{hwModal.lessonTitle}</p>
          <h2 className="text-base font-semibold text-foreground dark:text-foreground">{hwModal.studentName}</h2>
          {hwModal.submittedAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {t('attendance.hwModal.submitted', { date: formatDateTime(hwModal.submittedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, locale) })}
            </p>
          )}
        </div>

        {/* Score strip */}
        {hwModal.score !== null ? (
          <div className="flex items-center justify-between px-5 py-3 bg-green-50 dark:bg-green-900/20">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              {t('attendance.hwModal.points', { score: `${hwModal.score}${hwModal.maxScore != null ? `/${hwModal.maxScore}` : ''}` })}
            </span>
            {hwModal.gradedAt && (
              <span className="text-xs text-green-600/70 dark:text-green-500/70">
                {t('attendance.hwModal.checked', { date: formatDate(hwModal.gradedAt, { day: '2-digit', month: '2-digit' }, locale) })}
              </span>
            )}
          </div>
        ) : (
          <div className="px-5 py-3 bg-gray-50 dark:bg-secondary text-xs text-muted-foreground">
            {t('attendance.hwModal.notGraded')}
          </div>
        )}

        {/* Feedback body */}
        <div className="px-5 py-4">
          {hwModal.feedback ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {hwModal.feedback}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('attendance.hwModal.noComment')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── SAT Feedback Modal ─────────────────────────────────────── */}
    <Dialog open={satModal.open} onOpenChange={(open) => setSatModal(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
              satModal.section === 'math'
                ? "bg-brand-subtle text-brand"
                : "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
            )}>
              {examLabel} {satModal.section === 'math' ? 'Math' : 'Verbal'}
            </span>
            {satModal.completedAt && (
              <span className="text-xs text-muted-foreground">
                {formatDateTime(satModal.completedAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, locale)}
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-foreground dark:text-foreground">{satModal.studentName}</h2>
          {satModal.testName && (
            <p className="text-xs text-muted-foreground mt-0.5">{satModal.testName}</p>
          )}
        </div>

        {/* Score strip */}
        <div className={cn(
          "flex items-center gap-3 px-5 py-3 shrink-0",
          satModal.section === 'math'
            ? "bg-brand-surface"
            : "bg-purple-50 dark:bg-purple-900/20"
        )}>
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            satModal.section === 'math' ? "text-brand-subtle-foreground" : "text-purple-700 dark:text-purple-400"
          )}>
            {satModal.correct ?? '—'}
          </span>
          <span className="text-muted-foreground text-sm">/ {satModal.total ?? '—'}</span>
          {satModal.correct != null && satModal.total ? (
            <span className="ml-auto text-sm font-medium text-muted-foreground">
              {Math.round((satModal.correct / satModal.total) * 100)}%
            </span>
          ) : null}
        </div>

        {/* Feedback body */}
        <div className="px-5 py-4 overflow-y-auto">
          {satModal.feedback || satModal.feedbackRu ? (
            <>
              {satModal.feedback && satModal.feedbackRu && (
                <div className="flex items-center gap-1 mb-3">
                  {([['ru', t('attendance.feedback.langRu')], ['en', t('attendance.feedback.langEn')]] as const).map(([lang, label]) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setSatFeedbackLang(lang)}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                        satFeedbackLang === lang
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:bg-muted dark:bg-secondary dark:hover:bg-secondary/80"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <MarkdownContent>
                {(satFeedbackLang === 'ru' ? (satModal.feedbackRu ?? satModal.feedback) : (satModal.feedback ?? satModal.feedbackRu))!}
              </MarkdownContent>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t('attendance.feedback.none')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── IELTS Feedback Modal ───────────────────────────────────── */}
    <Dialog open={ieltsModal.open} onOpenChange={(open) => setIeltsModal(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {ieltsModal.student && (() => {
          const s = ieltsModal.student;
          const bands: { label: string; value?: number | null }[] = [
            { label: 'Listening', value: s.ielts_listening_band },
            { label: 'Reading', value: s.ielts_reading_band },
            { label: 'Writing', value: s.ielts_writing_band },
            { label: 'Speaking', value: s.ielts_speaking_band },
          ];
          // Russian is best-effort per field — fall back to the English text
          // wherever the translation is missing.
          const ru = ieltsFeedbackLang === 'ru';
          const pick = (en?: string | null, ruText?: string | null) => (ru ? (ruText ?? en) : en);
          const writingFb = s.ielts_writing_feedback;
          const writingFbRu = s.ielts_writing_feedback_ru;
          const speakingFb = s.ielts_speaking_feedback;
          const speakingFbRu = s.ielts_speaking_feedback_ru;
          const speakingCriteria: { label: string; text?: string | null }[] = [
            { label: 'Fluency & Coherence', text: pick(speakingFb?.fluencyCoherence, speakingFbRu?.fluencyCoherence) },
            { label: 'Lexical Resource', text: pick(speakingFb?.lexicalResource, speakingFbRu?.lexicalResource) },
            { label: 'Grammatical Range & Accuracy', text: pick(speakingFb?.grammaticalRange, speakingFbRu?.grammaticalRange) },
            { label: 'Pronunciation', text: pick(speakingFb?.pronunciation, speakingFbRu?.pronunciation) },
            { label: 'Overall', text: pick(speakingFb?.overall, speakingFbRu?.overall) },
          ];
          const writingTasks: { label: string; text?: string | null }[] = [
            { label: 'Task 1', text: pick(writingFb?.task1, writingFbRu?.task1) },
            { label: 'Task 2', text: pick(writingFb?.task2, writingFbRu?.task2) },
          ];
          const hasWritingFb = writingTasks.some(t => t.text);
          const hasSpeakingFb = speakingCriteria.some(c => c.text);
          const examFeedbacks: { label: string; text?: string | null; testName?: string | null }[] = [
            { label: 'Listening', text: pick(s.ielts_listening_feedback, s.ielts_listening_feedback_ru), testName: s.ielts_listening_test_name },
            { label: 'Reading', text: pick(s.ielts_reading_feedback, s.ielts_reading_feedback_ru), testName: s.ielts_reading_test_name },
          ];
          const hasExamFb = examFeedbacks.some(f => f.text);
          const showLangToggle = hasIeltsRuFeedback(s) && hasIeltsEnFeedback(s);
          return (
            <>
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-border shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    IELTS
                  </span>
                </div>
                <h2 className="text-base font-semibold text-foreground dark:text-foreground">{s.student_name}</h2>
              </div>

              {/* Band strip */}
              <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
                {bands.map(b => (
                  <div key={b.label} className="flex flex-col items-center flex-1">
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{b.label.slice(0, 1)}</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      b.value != null ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                    )} title={b.label}>
                      {formatBand(b.value)}
                    </span>
                  </div>
                ))}
                <div className="flex flex-col items-center flex-1 border-l border-emerald-200 dark:border-emerald-800 pl-2">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Overall</span>
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    s.ielts_overall_band != null ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
                  )}>
                    {formatBand(s.ielts_overall_band)}
                  </span>
                </div>
              </div>

              {/* Speaking session — branch on speakingSource, not on the band.
                  Surfaces AI-estimated bands, the human examiner + session time,
                  and the booked / missed / cancelled states explicitly. */}
              {s.ielts_speaking_source != null && (() => {
                const status = s.ielts_speaking_status;
                const meta = status ? SPEAKING_STATUS_META[status] : null;
                const sessionAt = formatSpeakingSessionAt(s.ielts_speaking_session_at);
                const isAi = s.ielts_speaking_source === 'ai';
                return (
                  <div className="px-5 py-3 border-b border-border shrink-0">
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0">
                        {isAi
                          ? <Sparkles className="w-4 h-4 text-violet-500 dark:text-violet-400" />
                          : <User className="w-4 h-4 text-sky-500 dark:text-sky-400" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Speaking
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                            isAi
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                              : "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                          )}>
                            {isAi ? 'AI' : t('attendance.ielts.examiner')}
                          </span>
                          {meta && (
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded", meta.className)}>
                              {meta.label}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-foreground">
                          {isAi ? (
                            <>
                              {s.ielts_speaking_band != null ? (
                                <>{t('attendance.ielts.aiScore')} <span className="font-semibold tabular-nums">{formatBand(s.ielts_speaking_band)}</span></>
                              ) : (
                                <span className="text-muted-foreground">{t('attendance.ielts.aiPending')}</span>
                              )}
                              {s.ielts_speaking_test_name && (
                                <span className="text-muted-foreground"> · {s.ielts_speaking_test_name}</span>
                              )}
                            </>
                          ) : (
                            <>
                              {s.ielts_speaking_examiner && <span className="font-medium">{s.ielts_speaking_examiner}</span>}
                              {sessionAt && (
                                <span className={s.ielts_speaking_examiner ? "text-muted-foreground" : ""}>
                                  {s.ielts_speaking_examiner ? ' · ' : ''}{sessionAt}
                                </span>
                              )}
                              {s.ielts_speaking_band != null && (
                                <span> · <span className="font-semibold tabular-nums">{formatBand(s.ielts_speaking_band)}</span></span>
                              )}
                              {!s.ielts_speaking_examiner && !sessionAt && s.ielts_speaking_band == null && meta && (
                                <span className="text-muted-foreground">{meta.label}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Feedback body */}
              <div className="px-5 py-4 overflow-y-auto space-y-5">
                {showLangToggle && (
                  <div className="flex items-center gap-1">
                    {([['ru', t('attendance.feedback.langRu')], ['en', t('attendance.feedback.langEn')]] as const).map(([lang, label]) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setIeltsFeedbackLang(lang)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors",
                          ieltsFeedbackLang === lang
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:bg-muted dark:bg-secondary dark:hover:bg-secondary/80"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                {examFeedbacks.filter(f => f.text).map(f => (
                  <div key={f.label}>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {t('attendance.ielts.sectionFeedback', { section: f.label })}{f.testName ? ` · ${f.testName}` : ''}
                    </h3>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{f.text}</p>
                  </div>
                ))}
                {hasWritingFb && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {t('attendance.ielts.sectionFeedback', { section: 'Writing' })}{s.ielts_writing_test_name ? ` · ${s.ielts_writing_test_name}` : ''}
                    </h3>
                    <div className="space-y-3">
                      {writingTasks.filter(t => t.text).map(t => (
                        <div key={t.label}>
                          <p className="text-xs font-semibold text-foreground mb-1">{t.label}</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{t.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {hasSpeakingFb && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      {t('attendance.ielts.sectionFeedback', { section: 'Speaking' })}{s.ielts_speaking_test_name ? ` · ${s.ielts_speaking_test_name}` : ''}
                    </h3>
                    <div className="space-y-3">
                      {speakingCriteria.filter(c => c.text).map(c => (
                        <div key={c.label}>
                          <p className="text-xs font-semibold text-foreground mb-1">{c.label}</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!hasExamFb && !hasWritingFb && !hasSpeakingFb && (
                  <p className="text-sm text-muted-foreground italic">{t('attendance.feedback.none')}</p>
                )}
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>

    <StudentHomeworkDialog
      open={studentHwModal.open}
      onOpenChange={(open) => setStudentHwModal(prev => ({ ...prev, open }))}
      studentId={studentHwModal.studentId}
      studentName={studentHwModal.studentName}
    />

    {/* Activity Score Modal */}
    <Dialog open={activityModal.open} onOpenChange={(open) => !open && setActivityModal(prev => ({ ...prev, open: false }))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('attendance.cell.activityScore')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            {t('attendance.activity.for')} <strong>{activityModal.studentName}</strong>
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
              <Button
                key={score}
                variant={activityModal.currentScore === score ? "default" : "outline"}
                size="sm"
                className={cn(
                  "w-10 h-10",
                  activityModal.currentScore === score && "bg-yellow-500 hover:bg-yellow-600"
                )}
                onClick={() => setActivityModal(prev => ({ ...prev, currentScore: score }))}
              >
                {score}
              </Button>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 dark:bg-secondary border border-border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground mb-1">{t('attendance.rubric.title')}:</p>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">0</span> {t('attendance.rubric.r0')}</div>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">1-3</span> {t('attendance.rubric.r1to3')}</div>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">4-5</span> {t('attendance.rubric.r4to5')}</div>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">6-7</span> {t('attendance.rubric.r6to7')}</div>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">8-9</span> {t('attendance.rubric.r8to9')}</div>
            <div className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-10">10</span> {t('attendance.rubric.r10')}</div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setActivityModal({ open: false, studentId: null, lessonKey: null, studentName: '', currentScore: 0 })}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (activityModal.studentId && activityModal.lessonKey) {
                updateActivityScore(activityModal.studentId, activityModal.lessonKey, activityModal.currentScore);
              }
              setActivityModal({ open: false, studentId: null, lessonKey: null, studentName: '', currentScore: 0 });
            }}
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            {t('attendance.activity.saveScore')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {scoresLesson && (
      <LessonScoresDialog
        open
        onOpenChange={(open) => { if (!open) setScoresLesson(null); }}
        eventId={scoresLesson.event_id}
        start={scoresLesson.start_datetime}
        title={`${formatDateParts(scoresLesson.start_datetime).date} · ${formatDateParts(scoresLesson.start_datetime).dayTime}${scoresLesson.topic ? ` · ${scoresLesson.topic}` : ''}`}
        onSaved={(saved) => {
          applySavedScores(scoresLesson.lesson_number.toString(), saved);
          toast(t('attendance.toast.scoresSaved'), 'success');
        }}
      />
    )}

    {/* Lesson topic edit modal */}
    <Dialog open={topicModal.open} onOpenChange={(open) => !open && setTopicModal({ open: false, lesson: null, value: '' })}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('attendance.grid.lessonTopic')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {topicModal.lesson && (
            <p className="text-sm text-muted-foreground">
              {topicModal.lesson.title}
            </p>
          )}
          <Input
            autoFocus
            maxLength={200}
            placeholder={t('attendance.topic.placeholder')}
            value={topicModal.value}
            onChange={(e) => setTopicModal(prev => ({ ...prev, value: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter' && !savingTopic) saveTopic(); }}
          />
          <p className="text-xs text-muted-foreground">{t('attendance.topic.hint')}</p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setTopicModal({ open: false, lesson: null, value: '' })}
            disabled={savingTopic}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={saveTopic} disabled={savingTopic}>
            {savingTopic ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <LessonMaterialsDialog
      eventId={materialsDialog.eventId}
      open={materialsDialog.open}
      onOpenChange={(open) => setMaterialsDialog((prev) => ({ ...prev, open }))}
      onChanged={() => {
        if (data) void refetchMaterialCounts(data.lessons);
      }}
    />

    <OverrideReasonsDialog
      open={overrideAsk !== null}
      items={overrideAsk ?? []}
      options={reviewOptions}
      onCancel={() => setOverrideAsk(null)}
      onConfirm={(given) => {
        const merged = new Map(overrideReasons);
        given.forEach((reason, key) => merged.set(key, reason));
        setOverrideReasons(merged);
        setOverrideAsk(null);
        void handleSaveChanges(merged);
      }}
    />
    </>
  );
}

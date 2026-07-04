import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { ChevronLeft, ChevronRight, Loader2, Save, Eye, EyeOff, Check, ChevronsUpDown, ClipboardList } from 'lucide-react';
import { StudentHomeworkDialog } from '../components/leaderboard/StudentHomeworkDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { getCuratorGroups, getWeeklyLessonsWithHwStatus, updateAttendance, updateLeaderboardEntry, updateLeaderboardConfig } from '../services/api';
import { Group, CourseType } from '../types';
import {
  PROGRAM_LABELS, PROGRAM_BADGE_STYLES, getGroupProgramType,
  formatGroupLabel, getGroupDateText, pluralizeGroups, sortGroupsByCreatedAt,
} from '../lib/groupPicker';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { toast } from '../components/Toast';

interface LessonMeta {
    lesson_number: number;
    event_id: number;
    title: string;
    start_datetime: string;
    homework?: {
        id: number;
        title: string;
    };
}

interface StudentLessonStatus {
    event_id: number;
    attendance_status: string;
    homework_status: {
        submitted: boolean;
        score: number | null;
        max_score?: number;
        is_graded?: boolean;
        submission_id?: number;
        feedback?: string | null;
        submitted_at?: string | null;
        graded_at?: string | null;
    } | null;
}

interface StudentRow {
    student_id: number;
    student_name: string;
    avatar_url: string | null;
    lessons: { [key: string]: StudentLessonStatus }; // key is lesson_number as string "1", "2"
    // Manual fields
    curator_hour: number;
    mock_exam: number;
    sat_math_correct_count?: number | null;
    sat_math_total_count?: number | null;
    sat_verbal_correct_count?: number | null;
    sat_verbal_total_count?: number | null;
    sat_math_feedback?: string | null;
    sat_verbal_feedback?: string | null;
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
    ielts_writing_feedback?: { task1?: string | null; task2?: string | null } | null;
    ielts_speaking_feedback?: {
        fluencyCoherence?: string | null;
        lexicalResource?: string | null;
        grammaticalRange?: string | null;
        pronunciation?: string | null;
        overall?: string | null;
    } | null;
    ielts_weekly_set_title?: string | null;
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
}: { 
    value: number, 
    max: number, 
    onChange: (val: string) => void,
}) => (
  <Select value={value.toString()} onValueChange={onChange}>
      <SelectTrigger className={cn(
          "h-full w-full border-none focus:ring-0 px-1 text-center justify-center rounded-none",
          "hover:bg-black/5 dark:hover:bg-white/5" 
      )}>
          <SelectValue>
            <span className="truncate text-xs text-gray-900 dark:text-foreground">{value}</span>
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
}: {
    initialStatus: string,
    onChange: (status: string) => void,
    disabled?: boolean,
}) => {
  // Cycle: attended -> late -> missed -> cancelled -> attended
  const handleCycle = () => {
    if (disabled) return;
    if (initialStatus === 'attended') onChange('late');
    else if (initialStatus === 'late') onChange('missed');
    else if (initialStatus === 'cancelled') onChange('attended');
    else if (initialStatus === 'absent' || initialStatus === 'registered' || initialStatus === 'missed') onChange('cancelled');
    else onChange('attended');
  };

  const getStatusConfig = () => {
    if (initialStatus === 'cancelled') return { label: 'Отменён', color: 'bg-slate-400 text-white', title: 'Урок отменён' };
    const s = (initialStatus === 'absent' || initialStatus === 'registered' || initialStatus === 'missed') ? 'missed' : initialStatus;

    if (s === 'attended') return { label: 'Был', color: 'bg-emerald-500 text-white', title: 'Был' };
    if (s === 'late') return { label: 'Опоздал', color: 'bg-amber-400 text-gray-900 font-bold', title: 'Опоздал' };
    return { label: 'Не был', color: 'bg-rose-500 text-white', title: 'Не был' };
  };

  const config = getStatusConfig();
  
  return (
    <div 
        onClick={handleCycle}
        className={cn(
            "flex items-center justify-center w-full h-full text-[11px] font-bold transition-all select-none",
            config.color,
            disabled ? "cursor-default brightness-[0.9] grayscale-[0.2]" : "cursor-pointer active:brightness-95 hover:brightness-105"
        )}
        title={disabled ? `Статус: ${config.title} (Только просмотр)` : `Статус: ${config.title}. Нажмите для переключения.`}
    >
        <span className="flex items-center gap-1">
            <span className="text-[10px] uppercase">{config.label}</span>
        </span>
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

const formatDayMonth = (d: Date) =>
    d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }).replace('.', '');

// "01 – 07 июн" range label for a week number.
const weekRangeLabel = (createdAtStr: string, week: number) => {
    const start = getWeekMonday(createdAtStr, week);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
};

// Group-picker helpers (PROGRAM_LABELS, getGroupProgramType, formatGroupLabel,
// getGroupDateText, PROGRAM_BADGE_STYLES, pluralizeGroups, sortGroupsByCreatedAt)
// are shared with the Attendance page — see ../lib/groupPicker.

const applyGroupWeek = (group: Group, weekParam: string | null) => {
    if (weekParam) return parseInt(weekParam, 10);
    if (group.current_week) return group.current_week;
    return calculateCurrentWeekNumber(group.created_at);
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
      parts.push(<strong key={key++} className="font-semibold text-gray-900 dark:text-foreground">{remaining.slice(boldIdx + 2, end)}</strong>)
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
      elements.push(<h3 key={i} className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-3 mb-1 first:mt-0">{renderInline(line.slice(4))}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={i} className="text-sm font-bold text-gray-900 dark:text-foreground mt-4 mb-1 first:mt-0 border-b border-gray-200 dark:border-border pb-0.5">{renderInline(line.slice(3))}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={i} className="text-base font-bold text-gray-900 dark:text-foreground mt-3 mb-1.5 first:mt-0">{renderInline(line.slice(2))}</h1>)
    } else if (/^[-*] /.test(line)) {
      // collect consecutive list items
      const listItems: React.ReactNode[] = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        listItems.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].slice(2))}</li>)
        i++
      }
      elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 mb-2 text-sm text-gray-700 dark:text-gray-300">{listItems}</ul>)
      continue
    } else if (/^\d+\. /.test(line)) {
      const listItems: React.ReactNode[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(<li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>)
        i++
      }
      elements.push(<ol key={`ol-${i}`} className="list-decimal list-inside space-y-0.5 mb-2 text-sm text-gray-700 dark:text-gray-300">{listItems}</ol>)
      continue
    } else if (line.trim() === '' || line === '---') {
      if (line === '---') elements.push(<hr key={i} className="border-gray-200 dark:border-border my-2" />)
      // empty line → skip
    } else {
      elements.push(<p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-1.5 last:mb-0">{renderInline(line)}</p>)
    }

    i++
  }

  return <div className="space-y-0.5">{elements}</div>
}

export default function CuratorLeaderboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentWeek, setCurrentWeek] = useState(1);
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
  
  // Changes tracking: Set of student IDs that have changes
  const [changedEntries, setChangedEntries] = useState<Set<number>>(new Set());
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
    correct: number | null;
    total: number | null;
    completedAt: string | null;
  }

  const [hwModal, setHwModal] = useState<HwFeedbackModal>({
    open: false, studentName: '', lessonTitle: '', score: null, feedback: null, submittedAt: null, gradedAt: null
  })
  const [satModal, setSatModal] = useState<SatFeedbackModal>({
    open: false, studentName: '', section: 'math', testName: null, feedback: null, correct: null, total: null, completedAt: null
  })
  const [ieltsModal, setIeltsModal] = useState<{ open: boolean; student: StudentRow | null }>({
    open: false, student: null
  })
  const [studentHwModal, setStudentHwModal] = useState<{ open: boolean; studentId: number | null; studentName: string }>({
    open: false, studentId: null, studentName: ''
  })

  const toggleColumn = (field: keyof typeof enabledCols) => {
      setEnabledCols(prev => ({ ...prev, [field]: !prev[field] }));
      setConfigChanged(true);
  };



  useEffect(() => {
    const loadGroups = async () => {
        try {
            const myGroups = sortGroupsByCreatedAt(await getCuratorGroups());
            setGroups(myGroups);
        } catch (e) {
            console.error("Failed to load groups", e);
        }
    };
    loadGroups();
  }, [user]);

  useEffect(() => {
    if (groups.length === 0) return;

    const weekParam = searchParams.get('week');
    const groupIdParam = searchParams.get('groupId');

    if (selectedGroupId && filteredGroups.some((group) => group.id === selectedGroupId)) {
      return;
    }

    if (groupIdParam) {
      const fromUrl = filteredGroups.find((group) => group.id === parseInt(groupIdParam, 10));
      if (fromUrl) {
        setSelectedGroupId(fromUrl.id);
        setCurrentWeek(applyGroupWeek(fromUrl, weekParam));
        return;
      }
    }

    if (filteredGroups.length > 0) {
      const nextGroup = filteredGroups[0];
      setSelectedGroupId(nextGroup.id);
      setCurrentWeek(applyGroupWeek(nextGroup, weekParam));
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
            return params;
        }, { replace: true });
        
        loadLeaderboard();
    }
  }, [selectedGroupId, currentWeek]);

  const loadLeaderboard = async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    setChangedEntries(new Set()); 
    setConfigChanged(false);
    try {
        const result = await getWeeklyLessonsWithHwStatus(selectedGroupId, currentWeek);
        setData(result);
        
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
        toast("Не удалось загрузить лидерборд", "error");
    } finally {
        setLoading(false);
    }
  };

  const calculateTotal = (student: StudentRow) => {
    if (!data) return 0;
    
    // Sum HW and Attendance from dynamic lessons
    let lessonsTotal = 0;
    Object.values(student.lessons).forEach(lesson => {
        // Attendance
        if (lesson.attendance_status === 'attended') {
            lessonsTotal += MAX_SCORES.attendance;
        }
        // Homework
        if (lesson.homework_status && lesson.homework_status.score !== null) {
            lessonsTotal += lesson.homework_status.score;
        }
    });
    
    // Manual Columns
    const curatorHour = enabledCols.curator_hour ? student.curator_hour : 0;
    const mockExam = student.mock_exam; // Always enabled logic-wise
    const studyBuddy = enabledCols.study_buddy ? student.study_buddy : 0;
    const journal = enabledCols.self_reflection_journal ? student.self_reflection_journal : 0;
    const weeklyEval = enabledCols.weekly_evaluation ? student.weekly_evaluation : 0;
    const extraPoints = enabledCols.extra_points ? student.extra_points : 0;
        
    return lessonsTotal + curatorHour + mockExam + studyBuddy + journal + weeklyEval + extraPoints;
  };
  
  const calculatePercent = (student: StudentRow) => {
      if (!data) return 0;
      const total = calculateTotal(student);
      
      // Calculate Max Possible
      // Dynamic lessons count
      // Per lesson: Attendance (10) + HW (if exists, assume 15 or max_score?)
      // Backend didn't return max score for HW meta, but usage implies 15 usually?
      // Wait, assignment has max_score.
      // Let's assume standard 15 for now or sum up actual max scores if available.
      // In student lesson status we have `max_score`. But for total possible we need to know theoretical max.
      // For general % calculation, let's assume 15 for HW if HW exists.
      
      let maxLessons = 0;
      data.lessons.forEach(meta => {
          maxLessons += MAX_SCORES.attendance; // 10
          if (meta.homework) {
              maxLessons += 15; // Assume 15 for consistency with previous config
          }
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

      if (maxForWeek === 0) return 0;
      return Math.round((total / maxForWeek) * 100); 
  };

  const getPercentColor = (percent: number) => {
      if (percent >= 90) return "bg-[#e6f4ea] text-[#137333] dark:bg-green-900/30 dark:text-green-400";
      if (percent >= 75) return "bg-[#e8f0fe] text-[#1967d2] dark:bg-blue-900/30 dark:text-blue-400";
      if (percent >= 50) return "bg-[#fef7e0] text-[#ea8600] dark:bg-amber-900/30 dark:text-amber-400";
      return "bg-[#fce8e6] text-[#c5221f] dark:bg-red-900/30 dark:text-red-400";
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
      // Security check
      if (user?.role === 'curator') return;
      
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
                  
                  return {
                      ...s,
                      lessons: {
                          ...s.lessons,
                          [lessonNumber]: {
                              ...lesson,
                              attendance_status: status
                          }
                      }
                  };
              })
          };
      });
      setChangedEntries(prev => new Set(prev).add(studentId));
  };
  const handleSaveChanges = async () => {
    if (!selectedGroupId || (!configChanged && changedEntries.size === 0) || !data) return;
    
    setIsSaving(true);
    let successCount = 0;

    try {
        // 1. Save Column Visibility Config
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
        
        // 2. Save Student Scores
        const entriesToSave = data.students.filter(s => changedEntries.has(s.student_id));
        console.log('Entries to save:', entriesToSave.length, 'Changed entries:', Array.from(changedEntries));
        
        for (const student of entriesToSave) {
            try {
                // Update Manual Fields (LeaderboardEntry)
                // Only send fields that have actual values (not null/undefined)
                const entryData: any = {
                    user_id: student.student_id,
                    group_id: selectedGroupId,
                    week_number: currentWeek
                };
                
                // Add optional fields only if they have values
                if (student.curator_hour !== null && student.curator_hour !== undefined) {
                    entryData.curator_hour = student.curator_hour;
                }
                if (student.mock_exam !== null && student.mock_exam !== undefined) {
                    entryData.mock_exam = student.mock_exam;
                }
                if (student.study_buddy !== null && student.study_buddy !== undefined) {
                    entryData.study_buddy = student.study_buddy;
                }
                if (student.self_reflection_journal !== null && student.self_reflection_journal !== undefined) {
                    entryData.self_reflection_journal = student.self_reflection_journal;
                }
                if (student.weekly_evaluation !== null && student.weekly_evaluation !== undefined) {
                    entryData.weekly_evaluation = student.weekly_evaluation;
                }
                if (student.extra_points !== null && student.extra_points !== undefined) {
                    entryData.extra_points = student.extra_points;
                }
                
                console.log('Saving entry for student:', student.student_id, entryData);
                await updateLeaderboardEntry(entryData);
                console.log('Entry saved successfully for student:', student.student_id);
                
                // Update Attendance (Events) - wrapped in separate try/catch to not block entry save
                for (const [lessonKey, lessonStatus] of Object.entries(student.lessons)) {
                    try {
                        const score = lessonStatus.attendance_status === 'attended' ? 10 : 0;
                        
                        await updateAttendance({
                            group_id: selectedGroupId,
                            week_number: currentWeek,
                            lesson_index: parseInt(lessonKey),
                            student_id: student.student_id,
                            score: score,
                            status: lessonStatus.attendance_status,
                            event_id: lessonStatus.event_id
                        });
                    } catch (attendanceError) {
                        console.error(`Failed to update attendance for student ${student.student_id}, lesson ${lessonKey}:`, attendanceError);
                    }
                }

                successCount++;
            } catch (e) {
                console.error(`Failed to save for student ${student.student_id}`, e);
            }
        }
        
        if (successCount === entriesToSave.length) {
            toast("Все изменения сохранены", "success");
            setChangedEntries(new Set());
            setConfigChanged(false);
            
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
        } else {
            toast(`Сохранено ${successCount}/${entriesToSave.length} записей. Попробуйте ещё раз.`, "error");
        }
    } catch (e) {
        console.error("Failed to save configuration:", e);
        toast("Не удалось сохранить конфигурацию", "error");
    } finally {
        setIsSaving(false);
    }
  };





  const formatDateParts = (dateStr: string) => {
      // Backend stores in UTC, convert to Kazakhstan time (GMT+5)
      const dt = new Date(dateStr);
      // Date: 03 фев
      const date = dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', timeZone: 'Asia/Almaty' }).replace('.', '');
      // DayTime: Пн 19:00
      const day = dt.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'Asia/Almaty' }); // Пн, Вт
      const time = dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Almaty' });
      // Capitalize day and month if needed
      const dayCap = day.charAt(0).toUpperCase() + day.slice(1);
      
      return { date, dayTime: `${dayCap} ${time}` };
  };

  const renderSectionFraction = (correct?: number | null, total?: number | null) => {
    if (correct == null) return 'Не сдано';
    if (total != null && total > 0) return `${correct}/${total}`;
    return `${correct}`;
  };

  // IELTS bands are conventionally rendered with one decimal: 7.0, 7.5
  const formatBand = (band?: number | null) => (band == null ? '—' : band.toFixed(1));

  const hasIeltsData = (s: StudentRow) =>
    s.ielts_listening_band != null || s.ielts_reading_band != null ||
    s.ielts_writing_band != null || s.ielts_speaking_band != null ||
    s.ielts_overall_band != null;

  // Week-navigation bounds and the group's "real" current week (based on today).
  const maxWeek = selectedGroup?.max_week || 52;
  const realCurrentWeek = selectedGroup
    ? Math.min(maxWeek, selectedGroup.current_week ?? calculateCurrentWeekNumber(selectedGroup.created_at))
    : 1;
  const isViewingCurrentWeek = currentWeek === realCurrentWeek;
  const viewedRangeLabel = data
    ? `${formatDayMonth(new Date(data.week_start))} – ${(() => {
        const end = new Date(data.week_start);
        end.setDate(end.getDate() + 6);
        return formatDayMonth(end);
      })()}`
    : selectedGroup
      ? weekRangeLabel(selectedGroup.created_at, currentWeek)
      : '';

  return (
    <>
    <div className="p-4 w-full h-full bg-white dark:bg-card space-y-4 rounded">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 border-b pb-4 dark:border-border">
        {/* Row 1: title + save */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-foreground">Лидерборд</h1>
          <Button
              onClick={handleSaveChanges}
              disabled={(!configChanged && changedEntries.size === 0) || isSaving}
              size="sm"
              className={cn(
                  "h-8 transition-colors rounded-md font-medium",
                  (configChanged || changedEntries.size > 0) ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-100 text-gray-400 dark:bg-secondary dark:text-gray-500"
              )}
          >
              {isSaving ? (
                  <><Loader2 className="w-3 h-3 mr-2 animate-spin" /> Сохранение</>
              ) : (
                  <><Save className="w-3 h-3 mr-2" /> Сохранить ({changedEntries.size})</>
              )}
          </Button>
        </div>

        {/* Row 2: filters (left) + week navigation (right) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={programFilter}
                    onValueChange={(value) => setProgramFilter(value as 'all' | CourseType)}
                >
                    <SelectTrigger className="h-8 w-[130px] rounded-md border-gray-300 dark:border-border text-xs">
                        <SelectValue placeholder="Предмет" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Все предметы</SelectItem>
                        <SelectItem value="sat">SAT</SelectItem>
                        <SelectItem value="ielts">IELTS</SelectItem>
                        <SelectItem value="nuet">NUET</SelectItem>
                        <SelectItem value="general_english">General English</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-[300px] md:w-[360px]">
                    <Popover open={groupPickerOpen} onOpenChange={(open) => { setGroupPickerOpen(open); if (!open) setGroupQuery(''); }}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="flex h-8 w-full items-center justify-between rounded-md border border-gray-300 dark:border-border bg-transparent px-3 text-xs"
                            >
                                <span className="truncate">
                                    {(() => {
                                        const g = filteredGroups.find((g) => g.id === selectedGroupId);
                                        return g ? formatGroupLabel(g) : 'Выберите группу';
                                    })()}
                                </span>
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] md:w-[360px] p-0" align="start">
                            <div className="p-2 border-b border-gray-200 dark:border-border">
                                <Input
                                    autoFocus
                                    value={groupQuery}
                                    onChange={(e) => setGroupQuery(e.target.value)}
                                    placeholder="Поиск по предмету, дате или учителю..."
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 dark:border-border">
                                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {groupMatches.length} {pluralizeGroups(groupMatches.length)}
                                </span>
                            </div>
                            <div className="max-h-72 overflow-y-auto py-0.5">
                                {groupMatches.length === 0 ? (
                                    <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                                        Ничего не найдено
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
                                                        g.current_week ?? calculateCurrentWeekNumber(g.created_at)
                                                    );
                                                    setGroupPickerOpen(false);
                                                    setGroupQuery('');
                                                }}
                                                className={cn(
                                                    "flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-secondary",
                                                    selectedGroupId === g.id && "bg-blue-50/60 dark:bg-secondary"
                                                )}
                                            >
                                                <Check className={cn('h-3.5 w-3.5 shrink-0 mt-px', selectedGroupId === g.id ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-0')} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={cn(
                                                            "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                                            PROGRAM_BADGE_STYLES[program]
                                                        )}>
                                                            {PROGRAM_LABELS[program]}
                                                        </span>
                                                        <span className="truncate text-xs font-medium text-gray-900 dark:text-foreground">
                                                            {getGroupDateText(g)}
                                                        </span>
                                                        {g.is_over && (
                                                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">(завершена)</span>
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
                        Скрыть завершённые
                    </Label>
                </div>
            </div>

            {/* Week navigation */}
            {selectedGroupId && (
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-stretch rounded-lg border border-gray-200 dark:border-border overflow-hidden bg-white dark:bg-card">
                        <button
                            type="button"
                            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                            disabled={currentWeek <= 1}
                            title={currentWeek <= 1 ? 'Это первая неделя' : 'Предыдущая неделя'}
                            className="flex w-8 items-center justify-center border-r border-gray-200 dark:border-border text-gray-500 hover:bg-gray-50 dark:hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <Select value={currentWeek.toString()} onValueChange={(val) => setCurrentWeek(parseInt(val))}>
                            <SelectTrigger className="h-auto min-w-[150px] gap-2 border-none rounded-none px-3 py-1 focus:ring-0 shadow-none bg-transparent hover:bg-gray-50 dark:hover:bg-secondary">
                                <SelectValue>
                                    <div className="flex flex-col items-center leading-tight text-center">
                                        <span className="text-xs font-semibold text-gray-900 dark:text-foreground">
                                            Неделя {currentWeek}
                                            <span className="text-gray-400 font-normal"> / {maxWeek}</span>
                                            {isViewingCurrentWeek && <span className="ml-1 text-[9px] font-bold uppercase text-blue-500 align-middle">сейчас</span>}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{viewedRangeLabel}</span>
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {Array.from({ length: maxWeek }, (_, i) => i + 1).map(w => (
                                    <SelectItem key={w} value={w.toString()} className="text-xs">
                                        <span className="flex items-center gap-2">
                                            <span className="font-medium">Неделя {w}</span>
                                            {selectedGroup && <span className="text-gray-400">{weekRangeLabel(selectedGroup.created_at, w)}</span>}
                                            {w === realCurrentWeek && <span className="text-[9px] font-bold uppercase text-blue-500">сейчас</span>}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <button
                            type="button"
                            onClick={() => setCurrentWeek(Math.min(maxWeek, currentWeek + 1))}
                            disabled={currentWeek >= maxWeek}
                            title={currentWeek >= maxWeek ? 'Это последняя неделя' : 'Следующая неделя'}
                            className="flex w-8 items-center justify-center border-l border-gray-200 dark:border-border text-gray-500 hover:bg-gray-50 dark:hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed"
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
                            title="Перейти к текущей неделе"
                        >
                            Сейчас
                        </Button>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="border border-gray-300 dark:border-border overflow-x-auto">
            {filteredGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">Нет групп по выбранным фильтрам</p>
                    <p className="text-xs mt-1">Снимите «Скрыть завершённые» или выберите другой предмет</p>
                </div>
            ) : loading || !data ? (
                <Table className="border-collapse w-full text-xs">
                    <TableHeader className="bg-gray-100 dark:bg-secondary sticky top-0 z-30">
                        <TableRow className="h-auto border-b border-gray-300 dark:border-border hover:bg-gray-100 dark:hover:bg-secondary">
                             <TableHead className="w-48 sticky left-0 z-40 bg-gray-100 dark:bg-secondary p-2 border-r border-gray-300 dark:border-border"><Skeleton className="h-4 w-20 bg-gray-200 dark:bg-gray-700" /></TableHead>
                             {/* Skeleton columns */}
                             {[1, 2, 3].map(i => (
                                <TableHead key={i} className="p-0 border-r border-gray-300 dark:border-border h-12 min-w-[100px] align-middle bg-gray-100 dark:bg-secondary">
                                   <div className="p-1 flex justify-center"><Skeleton className="h-3 w-12 bg-gray-200 dark:bg-gray-700" /></div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <TableRow key={idx} className="border-b border-gray-300 dark:border-border h-8">
                                <TableCell className="p-2 sticky left-0 z-30 bg-white dark:bg-card border-r border-gray-300 dark:border-border">
                                    <Skeleton className="h-3 w-32 bg-gray-100 dark:bg-gray-700" />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            ) : (
            <Table className="border-collapse w-full text-xs">
              <TableHeader className="bg-gray-100 dark:bg-secondary sticky top-0 z-30">
                <TableRow className="h-auto border-b border-gray-300 dark:border-border hover:bg-gray-100 dark:hover:bg-secondary">
                    <TableHead className="w-48 sticky left-0 z-40 bg-gray-100 dark:bg-secondary font-semibold text-gray-700 dark:text-gray-300 p-2 border-r border-gray-300 dark:border-border text-left align-middle text-center">
                        Студент
                    </TableHead>
                    {/* Dynamic Lesson Columns */}
                    {data.lessons.map(lesson => (
                        <TableHead key={`lesson-${lesson.lesson_number}`} className="p-0 text-center border-r border-gray-300 dark:border-border h-16 min-w-[160px] align-top bg-gray-100 dark:bg-secondary">
                            <div className="flex flex-col h-full">
                                <div className="py-2 border-b border-gray-300 dark:border-border font-semibold text-gray-700 dark:text-gray-300 bg-gray-200/50 dark:bg-gray-700/50 text-xs flex flex-col items-center">
                                    <span className="text-sm">{formatDateParts(lesson.start_datetime).date}</span>
                                    <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400 leading-tight uppercase">{formatDateParts(lesson.start_datetime).dayTime}</span>
                                </div>
                                <div className="flex flex-1 items-stretch">
                                    <div className="w-1/2 py-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 border-r border-gray-300 dark:border-border text-center uppercase tracking-tighter flex items-center justify-center">
                                        Урок
                                    </div>
                                    <div className="w-1/2 py-2 text-[10px] font-bold text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-secondary text-center uppercase tracking-tighter flex items-center justify-center" title={lesson.homework?.title || "Без ДЗ"}>
                                        ДЗ
                                    </div>
                                </div>
                            </div>
                        </TableHead>
                    ))}
                    
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.curator_hour && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-gray-400 dark:text-gray-500")}
                        onClick={() => toggleColumn('curator_hour')}
                        title={enabledCols.curator_hour ? "Нажмите, чтобы скрыть" : "Нажмите, чтобы показать"}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>Час<br/>куратора</span>
                            <Input 
                                type="date" 
                                className="h-6 w-24 text-[10px] p-1 mt-1 border-gray-300 dark:border-border"
                                value={enabledCols.curator_hour_date || ''}
                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const newDate = e.target.value;
                                    setEnabledCols(prev => ({ ...prev, curator_hour_date: newDate }));
                                    updateLeaderboardConfig({
                                        group_id: selectedGroupId!,
                                        week_number: currentWeek,
                                        curator_hour_date: newDate
                                    });
                                }}
                            />
                            {enabledCols.curator_hour 
                                ? <Eye className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    {isSatGroup ? (
                        <>
                            <TableHead className="text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight">
                                SAT Math
                            </TableHead>
                            <TableHead className="text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight">
                                SAT Verbal
                            </TableHead>
                        </>
                    ) : isIeltsGroup ? (
                        <TableHead className="text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight">IELTS</TableHead>
                    ) : (
                        <TableHead className="text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight">Пробный<br/>экзамен</TableHead>
                    )}
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.study_buddy && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-gray-400 dark:text-gray-500")}
                        onClick={() => toggleColumn('study_buddy')}
                        title={enabledCols.study_buddy ? "Нажмите, чтобы скрыть" : "Нажмите, чтобы показать"}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>Учебный<br/>бадди</span>
                            {enabledCols.study_buddy 
                                ? <Eye className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.self_reflection_journal && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-gray-400 dark:text-gray-500")}
                        onClick={() => toggleColumn('self_reflection_journal')}
                        title={enabledCols.self_reflection_journal ? "Нажмите, чтобы скрыть" : "Нажмите, чтобы показать"}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>Журнал</span>
                            {enabledCols.self_reflection_journal 
                                ? <Eye className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.weekly_evaluation && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-gray-400 dark:text-gray-500")}
                        onClick={() => toggleColumn('weekly_evaluation')}
                        title={enabledCols.weekly_evaluation ? "Нажмите, чтобы скрыть" : "Нажмите, чтобы показать"}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>Ежен.<br/>оценка</span>
                            {enabledCols.weekly_evaluation 
                                ? <Eye className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    <TableHead 
                        className={cn("text-center font-semibold p-2 w-28 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle whitespace-normal leading-tight cursor-pointer hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors select-none group relative", !enabledCols.extra_points && "opacity-60 bg-gray-50 dark:bg-secondary/50 text-gray-400 dark:text-gray-500")}
                        onClick={() => toggleColumn('extra_points')}
                        title={enabledCols.extra_points ? "Нажмите, чтобы скрыть" : "Нажмите, чтобы показать"}
                    >
                        <div className="flex flex-col items-center justify-center gap-1">
                            <span>Доп.</span>
                            {enabledCols.extra_points 
                                ? <Eye className="w-3 h-3 text-gray-400 opacity-50 group-hover:opacity-100 transition-opacity absolute top-1 right-1" /> 
                                : <EyeOff className="w-3 h-3 text-gray-500 absolute top-1 right-1" />
                            }
                        </div>
                    </TableHead>
                    
                    <TableHead className="text-center font-bold p-2 w-16 text-gray-800 dark:text-foreground bg-gray-100 dark:bg-secondary border-r border-gray-300 dark:border-border align-middle">Итого</TableHead>
                    <TableHead className="text-center font-bold p-2 w-16 sticky right-0 z-40 bg-gray-100 dark:bg-secondary align-middle shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.students.map((student, index) => {
                    const percent = calculatePercent(student);
                    return (
                    <TableRow key={student.student_id} className="hover:bg-blue-50/50 dark:hover:bg-secondary/50 border-b border-gray-300 dark:border-border h-12">
                        <TableCell className="p-2 sticky left-0 z-30 bg-white dark:bg-card border-r border-gray-300 dark:border-border">
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-400 w-4 text-right font-mono">{index + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => setStudentHwModal({ open: true, studentId: student.student_id, studentName: student.student_name })}
                                    title={`${student.student_name} — все домашние задания`}
                                    className="group flex items-center gap-1 truncate max-w-[150px] font-medium text-gray-900 dark:text-foreground hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors"
                                >
                                    <span className="truncate">{student.student_name}</span>
                                    <ClipboardList className="w-3 h-3 shrink-0 text-gray-300 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
                                </button>
                            </div>
                        </TableCell>
                        
                        {/* Dynamic Lesson Cells */}
                        {data.lessons.map(lessonInfo => {
                            const lessonKey = lessonInfo.lesson_number.toString();
                            const lessonStatus = student.lessons[lessonKey];
                            // Handle cases where lesson data might not be populated for student yet
                            const status = lessonStatus ? lessonStatus.attendance_status : 'absent';
                            const hwStatus = lessonStatus ? lessonStatus.homework_status : null;
                            
                            return (
                                <TableCell key={`cell-${lessonKey}`} className="p-0 border-r border-gray-300 dark:border-border">
                                    <div className="flex w-full h-12 items-stretch">
                                        <div className="w-1/2 border-r border-gray-300 dark:border-border">
                                            <AttendanceToggle 
                                                initialStatus={status}
                                                onChange={(newStatus) => handleAttendanceChange(student.student_id, lessonKey, newStatus)}
                                                disabled={user?.role === 'curator'}
                                            />
                                        </div>
                                        <div className="w-1/2 bg-gray-50 dark:bg-secondary flex items-center justify-center p-0">
                                            <div
                                                className={cn(
                                                    "w-full text-center text-[11px] h-full flex items-center justify-center",
                                                    hwStatus?.submitted ? "text-green-700 dark:text-green-400 font-bold" : (hwStatus?.score != null) ? "text-orange-700 dark:text-orange-400 font-medium" : "text-gray-400",
                                                    hwStatus?.submitted && "cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                                )}
                                                onClick={() => {
                                                    if (!hwStatus?.submitted) return
                                                    setHwModal({
                                                        open: true,
                                                        studentName: student.student_name,
                                                        lessonTitle: lessonInfo.title || `Lesson ${lessonInfo.lesson_number}`,
                                                        score: hwStatus.score,
                                                        maxScore: hwStatus.max_score,
                                                        feedback: hwStatus.feedback ?? null,
                                                        submittedAt: hwStatus.submitted_at ?? null,
                                                        gradedAt: hwStatus.graded_at ?? null,
                                                    })
                                                }}
                                                title={hwStatus?.submitted ? 'Click to see feedback' : undefined}
                                            >
                                                {hwStatus?.submitted 
                                                    ? `${hwStatus.score !== null ? hwStatus.score : 'Сдано'}`
                                                    : '-'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </TableCell>
                            );
                        })}

                        <TableCell className={cn("p-0 border-r border-gray-300 dark:border-border h-12", !enabledCols.curator_hour && "bg-gray-100 dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.curator_hour} max={MAX_SCORES.curator_hour} onChange={(v) => handleManualScoreChange(student.student_id, 'curator_hour', v)} />
                        </TableCell>
                        {isSatGroup ? (
                            <>
                                <TableCell className="p-0 border-r border-gray-300 dark:border-border h-12">
                                    <div
                                        className={cn(
                                            "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                            student.sat_math_correct_count != null
                                                ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                : ""
                                        )}
                                        onClick={() => {
                                            if (student.sat_math_correct_count == null) return
                                            setSatModal({
                                                open: true,
                                                studentName: student.student_name,
                                                section: 'math',
                                                testName: student.sat_math_test_name ?? null,
                                                feedback: student.sat_math_feedback ?? null,
                                                correct: student.sat_math_correct_count ?? null,
                                                total: student.sat_math_total_count ?? null,
                                                completedAt: student.sat_math_completed_at ?? null,
                                            })
                                        }}
                                        title={student.sat_math_correct_count != null ? 'Click to see Math feedback' : undefined}
                                    >
                                        <span className="text-gray-900 dark:text-foreground">
                                            {renderSectionFraction(student.sat_math_correct_count, student.sat_math_total_count)}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell className="p-0 border-r border-gray-300 dark:border-border h-12">
                                    <div
                                        className={cn(
                                            "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                            student.sat_verbal_correct_count != null
                                                ? "cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                : ""
                                        )}
                                        onClick={() => {
                                            if (student.sat_verbal_correct_count == null) return
                                            setSatModal({
                                                open: true,
                                                studentName: student.student_name,
                                                section: 'verbal',
                                                testName: student.sat_verbal_test_name ?? null,
                                                feedback: student.sat_verbal_feedback ?? null,
                                                correct: student.sat_verbal_correct_count ?? null,
                                                total: student.sat_verbal_total_count ?? null,
                                                completedAt: student.sat_verbal_completed_at ?? null,
                                            })
                                        }}
                                        title={student.sat_verbal_correct_count != null ? 'Click to see Verbal feedback' : undefined}
                                    >
                                        <span className="text-gray-900 dark:text-foreground">
                                            {renderSectionFraction(student.sat_verbal_correct_count, student.sat_verbal_total_count)}
                                        </span>
                                    </div>
                                </TableCell>
                            </>
                        ) : isIeltsGroup ? (
                            <TableCell className="p-0 border-r border-gray-300 dark:border-border h-12">
                                <div
                                    className={cn(
                                        "w-full h-full flex items-center justify-center text-xs font-semibold transition-colors",
                                        hasIeltsData(student)
                                            ? "cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                            : ""
                                    )}
                                    onClick={() => {
                                        if (!hasIeltsData(student)) return
                                        setIeltsModal({ open: true, student })
                                    }}
                                    title={hasIeltsData(student) ? 'Click to see IELTS results and feedback' : undefined}
                                >
                                    {student.ielts_overall_band != null ? (
                                        <span className="text-gray-900 dark:text-foreground">{formatBand(student.ielts_overall_band)}</span>
                                    ) : hasIeltsData(student) ? (
                                        <span className="text-gray-500 dark:text-gray-400">—</span>
                                    ) : (
                                        <span className="text-gray-400 italic">Не сдано</span>
                                    )}
                                </div>
                            </TableCell>
                        ) : (
                            <TableCell className="p-0 border-r border-gray-300 dark:border-border h-12">
                                <div className="w-full h-full flex items-center justify-center text-xs font-medium">
                                    {student.mock_exam > 0 ? (
                                        <span className="text-gray-900 dark:text-foreground">{student.mock_exam}%</span>
                                    ) : (
                                        <span className="text-gray-400 italic">Не сдано</span>
                                    )}
                                </div>
                            </TableCell>
                        )}
                        <TableCell className={cn("p-0 border-r border-gray-300 dark:border-border", !enabledCols.study_buddy && "bg-gray-100 dark:bg-secondary opacity-50 pointer-events-none")}>
                            <div className="h-12 w-full">
                                <AttendanceToggle 
                                    initialStatus={student.study_buddy === 15 ? 'attended' : 'absent'} 
                                    onChange={(s) => handleManualScoreChange(student.student_id, 'study_buddy', s === 'attended' ? '15' : '0')} 
                                    disabled={false}
                                />
                            </div>
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-gray-300 dark:border-border", !enabledCols.self_reflection_journal && "bg-gray-100 dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.self_reflection_journal} max={MAX_SCORES.self_reflection_journal} onChange={(v) => handleManualScoreChange(student.student_id, 'self_reflection_journal', v)} />
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-gray-300 dark:border-border", !enabledCols.weekly_evaluation && "bg-gray-100 dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.weekly_evaluation} max={MAX_SCORES.weekly_evaluation} onChange={(v) => handleManualScoreChange(student.student_id, 'weekly_evaluation', v)} />
                        </TableCell>
                        <TableCell className={cn("p-0 border-r border-gray-300 dark:border-border", !enabledCols.extra_points && "bg-gray-100 dark:bg-secondary opacity-50 pointer-events-none")}>
                            <ScoreSelect value={student.extra_points} max={10} onChange={(v) => handleManualScoreChange(student.student_id, 'extra_points', v)} />
                        </TableCell>

                        <TableCell className="p-2 text-center font-semibold text-gray-900 dark:text-foreground border-r border-gray-300 dark:border-border bg-white dark:bg-card">
                            {calculateTotal(student)}
                        </TableCell>
                         <TableCell className={cn(
                             "p-2 text-center font-bold sticky right-0 z-30 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]",
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
    </div>

    {/* ── HW Feedback Modal ──────────────────────────────────────── */}
    <Dialog open={hwModal.open} onOpenChange={(open) => setHwModal(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-border">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">{hwModal.lessonTitle}</p>
          <h2 className="text-base font-semibold text-gray-900 dark:text-foreground">{hwModal.studentName}</h2>
          {hwModal.submittedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Submitted {new Date(hwModal.submittedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Score strip */}
        {hwModal.score !== null ? (
          <div className="flex items-center justify-between px-5 py-3 bg-green-50 dark:bg-green-900/20">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              {hwModal.score}{hwModal.maxScore != null ? `/${hwModal.maxScore}` : ''} pts
            </span>
            {hwModal.gradedAt && (
              <span className="text-xs text-green-600/70 dark:text-green-500/70">
                Checked {new Date(hwModal.gradedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
              </span>
            )}
          </div>
        ) : (
          <div className="px-5 py-3 bg-gray-50 dark:bg-secondary text-xs text-gray-400">
            Not graded yet
          </div>
        )}

        {/* Feedback body */}
        <div className="px-5 py-4">
          {hwModal.feedback ? (
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {hwModal.feedback}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">No comment left</p>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* ── SAT Feedback Modal ─────────────────────────────────────── */}
    <Dialog open={satModal.open} onOpenChange={(open) => setSatModal(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-border shrink-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn(
              "text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
              satModal.section === 'math'
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                : "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400"
            )}>
              SAT {satModal.section === 'math' ? 'Math' : 'Verbal'}
            </span>
            {satModal.completedAt && (
              <span className="text-xs text-gray-400">
                {new Date(satModal.completedAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-foreground">{satModal.studentName}</h2>
          {satModal.testName && (
            <p className="text-xs text-gray-400 mt-0.5">{satModal.testName}</p>
          )}
        </div>

        {/* Score strip */}
        <div className={cn(
          "flex items-center gap-3 px-5 py-3 shrink-0",
          satModal.section === 'math'
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "bg-purple-50 dark:bg-purple-900/20"
        )}>
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            satModal.section === 'math' ? "text-blue-700 dark:text-blue-400" : "text-purple-700 dark:text-purple-400"
          )}>
            {satModal.correct ?? '—'}
          </span>
          <span className="text-gray-400 text-sm">/ {satModal.total ?? '—'}</span>
          {satModal.correct != null && satModal.total ? (
            <span className="ml-auto text-sm font-medium text-gray-500 dark:text-gray-400">
              {Math.round((satModal.correct / satModal.total) * 100)}%
            </span>
          ) : null}
        </div>

        {/* Feedback body */}
        <div className="px-5 py-4 overflow-y-auto">
          {satModal.feedback ? (
            <MarkdownContent>{satModal.feedback}</MarkdownContent>
          ) : (
            <p className="text-sm text-gray-400 italic">No feedback available</p>
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
          const writingFb = s.ielts_writing_feedback;
          const speakingFb = s.ielts_speaking_feedback;
          const speakingCriteria: { label: string; text?: string | null }[] = [
            { label: 'Fluency & Coherence', text: speakingFb?.fluencyCoherence },
            { label: 'Lexical Resource', text: speakingFb?.lexicalResource },
            { label: 'Grammatical Range & Accuracy', text: speakingFb?.grammaticalRange },
            { label: 'Pronunciation', text: speakingFb?.pronunciation },
            { label: 'Overall', text: speakingFb?.overall },
          ];
          const hasWritingFb = Boolean(writingFb?.task1 || writingFb?.task2);
          const hasSpeakingFb = speakingCriteria.some(c => c.text);
          return (
            <>
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-gray-100 dark:border-border shrink-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    IELTS
                  </span>
                  {s.ielts_weekly_set_title && (
                    <span className="text-xs text-gray-400">{s.ielts_weekly_set_title}</span>
                  )}
                </div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-foreground">{s.student_name}</h2>
              </div>

              {/* Band strip */}
              <div className="flex items-center gap-2 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
                {bands.map(b => (
                  <div key={b.label} className="flex flex-col items-center flex-1">
                    <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{b.label.slice(0, 1)}</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      b.value != null ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400"
                    )} title={b.label}>
                      {formatBand(b.value)}
                    </span>
                  </div>
                ))}
                <div className="flex flex-col items-center flex-1 border-l border-emerald-200 dark:border-emerald-800 pl-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Overall</span>
                  <span className={cn(
                    "text-2xl font-bold tabular-nums",
                    s.ielts_overall_band != null ? "text-emerald-700 dark:text-emerald-400" : "text-gray-400"
                  )}>
                    {formatBand(s.ielts_overall_band)}
                  </span>
                </div>
              </div>

              {/* Feedback body */}
              <div className="px-5 py-4 overflow-y-auto space-y-5">
                {hasWritingFb && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                      Writing feedback{s.ielts_writing_test_name ? ` · ${s.ielts_writing_test_name}` : ''}
                    </h3>
                    <div className="space-y-3">
                      {writingFb?.task1 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Task 1</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{writingFb.task1}</p>
                        </div>
                      )}
                      {writingFb?.task2 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Task 2</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{writingFb.task2}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {hasSpeakingFb && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                      Speaking feedback
                    </h3>
                    <div className="space-y-3">
                      {speakingCriteria.filter(c => c.text).map(c => (
                        <div key={c.label}>
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{c.label}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!hasWritingFb && !hasSpeakingFb && (
                  <p className="text-sm text-gray-400 italic">No feedback available</p>
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
    </>
  );
}

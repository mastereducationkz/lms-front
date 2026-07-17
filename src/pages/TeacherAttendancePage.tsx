import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { 
  Loader2,
  Star,
  MousePointerClick,
  X,
  ChevronsUpDown,
  Check,
  Search,
  Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import apiClient, { getGroupFullAttendanceMatrix, updateAttendanceBulk, setLessonTopic, getCuratorGroups } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Group, CourseType } from '../types';
import { cn } from '../lib/utils';
import { isAttendanceLockedLesson } from '../lib/attendance';
import { parseAsUTC } from '../lib/datetime';
import {
  PROGRAM_LABELS, PROGRAM_BADGE_STYLES, getGroupProgramType,
  formatGroupLabel, getGroupDateText, pluralizeGroups, sortGroupsByCreatedAt,
} from '../lib/groupPicker';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";

interface LessonMeta {
    lesson_number: number;
    event_id: number;
    title: string;
    topic?: string | null;
    start_datetime: string;
}

interface StudentLessonStatus {
    event_id: number;
    attendance_status: string;
    activity_score?: number;
}

interface StudentRow {
    student_id: number;
    student_name: string;
    lessons: { [key: string]: StudentLessonStatus };
}

interface AttendanceData {
    lessons: LessonMeta[];
    students: StudentRow[];
}

export default function TeacherAttendancePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupComboOpen, setGroupComboOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<'all' | CourseType>('all');
  const [hideCompletedGroups, setHideCompletedGroups] = useState(true);
  
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Track changes locally: Map<studentId, Set<lessonKey>>
  const [changedLessons, setChangedLessons] = useState<Map<number, Set<string>>>(new Map());
  
  // Activity score modal state
  const [activityModal, setActivityModal] = useState<{
    open: boolean;
    studentId: number | null;
    lessonKey: string | null;
    studentName: string;
    currentScore: number;
  }>({ open: false, studentId: null, lessonKey: null, studentName: '', currentScore: 0 });

  // Lesson topic edit modal state
  const [topicModal, setTopicModal] = useState<{
    open: boolean;
    lesson: LessonMeta | null;
    value: string;
  }>({ open: false, lesson: null, value: '' });
  const [savingTopic, setSavingTopic] = useState(false);

  useEffect(() => {
    loadGroups();
  }, [user]);

  useEffect(() => {
    if (selectedGroupId) {
      loadAttendanceData();
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      let fetchedGroups;
      try {
          // Fetch every group (high limit) without the heavy per-group student payload —
          // the picker only needs group metadata.
          fetchedGroups = await apiClient.getTeacherGroups(1000, false);
      } catch (e) {
          fetchedGroups = await getCuratorGroups();
      }

      // Keep the full list (including completed groups); filtering is handled by
      // the picker's program filter + "hide completed" toggle, same as the leaderboard.
      const allGroups = sortGroupsByCreatedAt(fetchedGroups || []);
      setGroups(allGroups);

      // Default selection: URL group if present, otherwise the first non-completed
      // group (falling back to the first group overall).
      const urlGroupId = searchParams.get('group');
      const defaultGroup = allGroups.find(g => !g.is_over) || allGroups[0];
      if (urlGroupId && allGroups.some(g => g.id === Number(urlGroupId))) {
          setSelectedGroupId(Number(urlGroupId));
      } else if (defaultGroup) {
          setSelectedGroupId(defaultGroup.id);
      }
    } catch (err) {
      console.error('Failed to load groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceData = async () => {
    if (!selectedGroupId) return;
    
    // Update URL when group changes
    setSearchParams(prev => {
        prev.set('group', selectedGroupId.toString());
        return prev;
    });

    try {
      setLoading(true);
      setChangedLessons(new Map());
      const result = await getGroupFullAttendanceMatrix(selectedGroupId);
      setData(result);
    } catch (err) {
      console.error('Failed to load attendance data:', err);
      toast.error('Load error');
    } finally {
      setLoading(false);
    }
  };

  const updateStudentStatus = (studentId: number, lessonKey: string, status: string, activityScore?: number) => {
    setData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(s => {
          if (s.student_id !== studentId) return s;
          const lesson = s.lessons[lessonKey];
          if (!lesson) return s;
          return {
            ...s,
            lessons: {
              ...s.lessons,
              [lessonKey]: { 
                ...lesson, 
                attendance_status: status,
                ...(activityScore !== undefined && { activity_score: activityScore })
              }
            }
          };
        })
      };
    });

    setChangedLessons(prev => {
      const next = new Map(prev);
      const studentChanges = next.get(studentId) || new Set<string>();
      studentChanges.add(lessonKey);
      next.set(studentId, studentChanges);
      return next;
    });
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
          return {
            ...s,
            lessons: {
              ...s.lessons,
              [lessonKey]: { ...lesson, activity_score: score }
            }
          };
        })
      };
    });

    setChangedLessons(prev => {
      const next = new Map(prev);
      const studentChanges = next.get(studentId) || new Set<string>();
      studentChanges.add(lessonKey);
      next.set(studentId, studentChanges);
      return next;
    });
  };

  const toggleStudentStatus = (studentId: number, lessonKey: string, currentStatus: string) => {
      let nextStatus = 'attended';
      if (currentStatus === 'pending') nextStatus = 'attended';
      else if (currentStatus === 'attended') nextStatus = 'late';
      else if (currentStatus === 'late') nextStatus = 'missed';
      else if (currentStatus === 'missed') nextStatus = 'cancelled';
      else if (currentStatus === 'cancelled') nextStatus = 'pending';

      updateStudentStatus(studentId, lessonKey, nextStatus);
  };

  const totalChangesCount = useMemo(() => {
    let count = 0;
    changedLessons.forEach(changes => { count += changes.size; });
    return count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changedLessons, data]);

  const saveAllChanges = async () => {
    if (!selectedGroupId || !data || totalChangesCount === 0) return;

    try {
      setSaving(true);
      const updates: any[] = [];

      for (const [studentId, lessonKeys] of changedLessons.entries()) {
          const student = data.students.find(s => s.student_id === studentId);
          if (!student) continue;

          for (const lessonKey of lessonKeys) {
              const statusData = student.lessons[lessonKey];
              if (!statusData) continue;

              const score = statusData.attendance_status === 'attended' ? 10 : 0;
              updates.push({
                group_id: selectedGroupId,
                week_number: 1, 
                lesson_index: parseInt(lessonKey),
                student_id: studentId,
                score: score,
                status: statusData.attendance_status,
                event_id: statusData.event_id,
                activity_score: statusData.activity_score
              });
          }
      }

      if (updates.length > 0) {
          await updateAttendanceBulk({ updates });
      }

      toast.success('Changes saved');
      setChangedLessons(new Map());
    } catch (err) {
      console.error('Save failed:', err);
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isFutureLesson = isAttendanceLockedLesson;

  const lastActualLessonId = useMemo(() => {
      if (!data) return null;
      const pastLessons = data.lessons.filter(l => !isFutureLesson(l.start_datetime));
      if (pastLessons.length === 0) return null;
      const last = [...pastLessons].sort((a, b) => 
          new Date(b.start_datetime).getTime() - new Date(a.start_datetime).getTime()
      )[0];
      return last.event_id;
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return []
    let students = data.students

    if (searchTerm.trim()) {
      students = students.filter(s =>
        s.student_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    return students
  }, [data, searchTerm]);

  const selectedGroupName = useMemo(
    () => groups.find(g => g.id === selectedGroupId)?.name ?? '',
    [groups, selectedGroupId],
  )

  // Program filter + hide-completed, then subject/date/teacher search — same as the leaderboard.
  const filteredGroups = useMemo(() => {
    let result = groups;
    if (hideCompletedGroups) result = result.filter(g => !g.is_over);
    if (programFilter !== 'all') result = result.filter(g => getGroupProgramType(g) === programFilter);
    return sortGroupsByCreatedAt(result);
  }, [groups, hideCompletedGroups, programFilter]);

  const groupMatches = useMemo(() => {
    const q = groupSearch.trim().toLowerCase();
    if (!q) return filteredGroups;
    return filteredGroups.filter(g =>
      (g.name || '').toLowerCase().includes(q) ||
      formatGroupLabel(g).toLowerCase().includes(q)
    );
  }, [filteredGroups, groupSearch]);

  const formatDate = (dateStr: string) => {
      // Backend stores in UTC, convert to Kazakhstan time (GMT+5)
      const dt = parseAsUTC(dateStr);
      return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Almaty' });
  };

  const formatDay = (dateStr: string) => {
      // Backend stores in UTC, convert to Kazakhstan time (GMT+5)
      const dt = parseAsUTC(dateStr);
      return dt.toLocaleDateString('ru-RU', { weekday: 'short', timeZone: 'Asia/Almaty' });
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'attended': return 'bg-green-200 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-300 dark:hover:bg-green-900/60';
          case 'late': return 'bg-yellow-200 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500 hover:text-white dark:hover:bg-yellow-900/60';
          case 'missed': return 'bg-rose-500 dark:bg-rose-900/50 text-white dark:text-rose-400 hover:bg-rose-600 dark:hover:bg-rose-900/70';
          case 'cancelled': return 'bg-slate-400 dark:bg-slate-700 text-white dark:text-slate-200 hover:bg-slate-500 dark:hover:bg-slate-600';
          case 'pending': return 'bg-gray-100/50 dark:bg-secondary text-gray-400 hover:bg-gray-200 dark:hover:bg-secondary/80';
          default: return 'bg-gray-50 dark:bg-secondary text-gray-400 hover:bg-gray-200 dark:hover:bg-secondary/80 border-gray-100 dark:border-border';
      }
  };

  const getStatusLabel = (status: string) => {
      switch (status) {
          case 'attended': return 'Present';
          case 'late': return 'Late';
          case 'missed': return 'Absent';
          case 'cancelled': return 'Cancelled';
          case 'pending': return '-';
          default: return 'None';
      }
  };

  const markAllPresentForLesson = (lesson: LessonMeta) => {
      if (!data || isFutureLesson(lesson.start_datetime)) return;
      const lessonKey = lesson.lesson_number.toString();
      data.students.forEach((student) => {
          updateStudentStatus(student.student_id, lessonKey, 'attended');
      });
  };

  const openTopicModal = (lesson: LessonMeta) => {
      setTopicModal({ open: true, lesson, value: lesson.topic ?? '' });
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
          // Update the lesson column in place. The event may have been materialized
          // server-side, so adopt the returned (real) event_id.
          setData(prev => {
              if (!prev) return prev;
              return {
                  ...prev,
                  lessons: prev.lessons.map(l =>
                      l.event_id === lesson.event_id
                          ? { ...l, topic: res.topic, event_id: res.event_id }
                          : l
                  ),
              };
          });
          toast.success(res.topic ? 'Topic saved' : 'Topic cleared');
          setTopicModal({ open: false, lesson: null, value: '' });
      } catch (err) {
          console.error('Failed to save lesson topic:', err);
          toast.error('Failed to save topic');
      } finally {
          setSavingTopic(false);
      }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto min-h-screen text-gray-900 dark:text-foreground font-sans">
      {/* Header - Aligned with AnalyticsPage */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">Group Attendance</h1>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select value={programFilter} onValueChange={(value) => setProgramFilter(value as 'all' | CourseType)}>
            <SelectTrigger className="h-9 w-full sm:w-[140px] text-sm">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              <SelectItem value="sat">SAT</SelectItem>
              <SelectItem value="ielts">IELTS</SelectItem>
              <SelectItem value="nuet">NUET</SelectItem>
              <SelectItem value="general_english">General English</SelectItem>
            </SelectContent>
          </Select>

          <Popover open={groupComboOpen} onOpenChange={(open) => {
            setGroupComboOpen(open)
            if (!open) setGroupSearch('')
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={groupComboOpen}
                className="w-full sm:w-[280px] justify-between bg-white dark:bg-card border-gray-200 dark:border-border font-normal h-9 text-sm"
              >
                <span className="truncate text-left">
                  {selectedGroupName || 'Select group…'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
              {/* Search input */}
              <div className="flex items-center border-b border-gray-200 dark:border-border px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 text-gray-400" />
                <input
                  autoFocus
                  placeholder="Search by subject, date or teacher…"
                  className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                />
                {groupSearch && (
                  <button onClick={() => setGroupSearch('')} className="text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between px-3 py-1 border-b border-gray-100 dark:border-border">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {groupMatches.length} {pluralizeGroups(groupMatches.length)}
                </span>
              </div>
              {/* List */}
              <div className="max-h-72 overflow-y-auto py-0.5">
                {groupMatches.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">No groups found</p>
                ) : (
                  groupMatches.map(g => {
                    const program = getGroupProgramType(g);
                    const teacher = (g.teacher_name || '').trim();
                    return (
                      <button
                        key={g.id}
                        className={cn(
                          'flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-secondary transition-colors',
                          selectedGroupId === g.id && 'bg-blue-50/60 dark:bg-secondary'
                        )}
                        onClick={() => {
                          setSelectedGroupId(g.id)
                          setGroupComboOpen(false)
                          setGroupSearch('')
                        }}
                      >
                        <Check className={cn('h-3.5 w-3.5 shrink-0 mt-px', selectedGroupId === g.id ? 'opacity-100 text-blue-600' : 'opacity-0')} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', PROGRAM_BADGE_STYLES[program])}>
                              {PROGRAM_LABELS[program]}
                            </span>
                            <span className="truncate text-xs font-medium text-gray-900 dark:text-foreground">
                              {getGroupDateText(g)}
                            </span>
                            {g.is_over && (
                              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">(completed)</span>
                            )}
                          </div>
                          {teacher && (
                            <div className="truncate text-[11px] text-muted-foreground leading-tight">{teacher}</div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 px-1">
            <Checkbox
              id="att-hide-completed-groups"
              checked={hideCompletedGroups}
              onCheckedChange={(checked) => setHideCompletedGroups(Boolean(checked))}
            />
            <Label htmlFor="att-hide-completed-groups" className="text-xs text-muted-foreground cursor-pointer select-none whitespace-nowrap">
              Hide completed
            </Label>
          </div>
          
          <Button 
            onClick={loadAttendanceData} 
            disabled={loading || totalChangesCount === 0}
            variant="ghost"
            className="text-gray-400 hover:text-gray-600 font-medium"
          >
            Cancel
          </Button>
          
          <Button 
            onClick={saveAllChanges} 
            disabled={saving || totalChangesCount === 0}
            className={cn(
                "font-semibold shadow-sm",
                totalChangesCount > 0 ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-gray-100 dark:bg-secondary text-gray-400 border-gray-200 dark:border-border"
            )}
            variant={totalChangesCount > 0 ? "default" : "outline"}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save Changes {totalChangesCount > 0 && `(${totalChangesCount})`}
          </Button>
        </div>
      </div>

      <div className="border border-gray-200 dark:border-border rounded-lg overflow-hidden bg-white dark:bg-card shadow-sm">
        {/* Sub-header / Filters */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-border flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                        <Input 
                            placeholder="Search students..." 
                            className="w-full md:w-64 h-9 bg-gray-50/50 dark:bg-secondary border-gray-200 dark:border-border text-sm focus-visible:ring-blue-500/20 pr-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                onClick={() => setSearchTerm('')}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Clear search */}
                    {searchTerm.trim() && (
                        <button
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
                
                <div className="flex items-center gap-6 text-sm shrink-0">
                    {data && data.lessons.length > 0 && (
                        <button 
                            className={cn(
                              "text-sm font-semibold hover:underline",
                              lastActualLessonId
                                ? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                : "text-gray-400 dark:text-gray-500 cursor-not-allowed no-underline"
                            )}
                            disabled={!lastActualLessonId}
                            onClick={() => {
                                const lastLesson = data.lessons.find((l) => l.event_id === lastActualLessonId);
                                if (lastLesson) {
                                    markAllPresentForLesson(lastLesson);
                                }
                            }}
                        >
                            Mark all present
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Interaction hint */}
        {data && data.lessons.length > 0 && (
          <div className="px-6 py-2.5 border-b border-gray-200 dark:border-border bg-blue-50/40 dark:bg-blue-900/10 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
            <span>
              Tip: click a lesson date in the header to mark all students <span className="font-semibold">Present</span> for that lesson.
            </span>
          </div>
        )}

        {/* Matrix Grid */}
        <div className="overflow-x-auto relative min-h-[400px]">
            {loading ? (
                <div className="p-8 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            ) : !data || data.lessons.length === 0 ? (
                <div className="py-24 text-center text-gray-500 dark:text-gray-400 font-medium">
                    No lessons available for this group.
                </div>
            ) : (
                <Table className="border-collapse text-left">
                    <TableHeader>
                        <TableRow className="bg-gray-50/50 dark:bg-secondary hover:bg-gray-50/50 dark:hover:bg-secondary">
                            <TableHead className="sticky left-0 z-40 bg-gray-50 dark:bg-secondary border-r border-gray-200 dark:border-border px-3 py-3 md:px-6 md:py-4 min-w-[140px] md:min-w-[220px]">
                                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">Student</span>
                            </TableHead>
                            {data.lessons.map(lesson => {
                                const isLastActual = lesson.event_id === lastActualLessonId;
                                const isFuture = isFutureLesson(lesson.start_datetime);
                                return (
                                    <TableHead
                                        key={lesson.event_id}
                                        className={cn(
                                        "text-center min-w-[110px] px-1 py-2 md:px-2 md:py-3 transition-colors border-r border-gray-200 dark:border-border",
                                        isFuture && "bg-gray-50/30 dark:bg-secondary/30 font-normal text-gray-400",
                                        !isFuture && "cursor-pointer hover:bg-blue-50/20 dark:hover:bg-blue-900/10",
                                        isLastActual && "bg-blue-50/30 dark:bg-blue-900/10 border-l-2 border-r-2 border-blue-600 dark:border-blue-500/40"
                                        )}
                                        onClick={() => !isFuture && markAllPresentForLesson(lesson)}
                                        title={isFuture ? 'Future lesson' : 'Mark all present for this date'}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className={cn(
                                                "text-[10px] font-medium capitalize",
                                                isLastActual ? "text-blue-600 dark:text-blue-400 font-bold" : "text-gray-400"
                                            )}>{formatDay(lesson.start_datetime)}</span>
                                            <span className={cn(
                                                "text-sm font-bold",
                                                isLastActual ? "text-blue-700 dark:text-blue-400" : "text-gray-900 dark:text-foreground"
                                            )}>{formatDate(lesson.start_datetime)}</span>
                                            {!isFuture ? (
                                              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600/80 dark:text-blue-300/80">
                                                Mark all
                                              </span>
                                            ) : (
                                              <span className="mt-0.5 text-[9px] uppercase tracking-wide text-gray-300 dark:text-gray-600">
                                                Future
                                              </span>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openTopicModal(lesson); }}
                                                className="mt-1 flex items-center gap-1 max-w-[100px] group/topic cursor-pointer"
                                                title={lesson.topic ? `Тема: ${lesson.topic} (нажмите, чтобы изменить)` : 'Добавить тему урока'}
                                            >
                                                <Pencil className="h-2.5 w-2.5 shrink-0 text-gray-400 group-hover/topic:text-blue-500" />
                                                <span className={cn(
                                                    "truncate text-[9px] normal-case font-normal",
                                                    lesson.topic ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600 italic"
                                                )}>
                                                    {lesson.topic || 'Тема'}
                                                </span>
                                            </button>
                                        </div>
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-gray-100 dark:divide-border">
                        {filteredStudents.map((student) => (
                        <TableRow key={student.student_id} className="hover:bg-gray-50/50 dark:hover:bg-secondary transition-colors group">
                            <TableCell className="sticky left-0 z-30 bg-white dark:bg-card border-r border-gray-200 dark:border-border px-3 py-3 md:px-6 md:py-3.5 group-hover:bg-gray-50 dark:group-hover:bg-secondary transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-900 dark:text-foreground truncate max-w-[120px] md:max-w-none">{student.student_name}</span>
                                </div>
                            </TableCell>
                            {data.lessons.map(lesson => {
                                const lessonKey = lesson.lesson_number.toString();
                                const lessonData = student.lessons[lessonKey];
                                const status = lessonData?.attendance_status || 'pending';
                                const activityScore = lessonData?.activity_score;
                                const isFuture = isFutureLesson(lesson.start_datetime);
                                const isChanged = changedLessons.get(student.student_id)?.has(lessonKey);
                                const isLastActual = lesson.event_id === lastActualLessonId;
                                
                                return (
                                <TableCell 
                                    key={`${student.student_id}-${lesson.event_id}`} 
                                    className={cn(
                                        "p-0 text-center transition-colors cursor-pointer select-none border-r border-gray-100/50 dark:border-border min-w-[110px]",
                                        isFuture ? "bg-gray-50/10 dark:bg-secondary/10 cursor-default" : getStatusColor(status),
                                        isLastActual && !isFuture && "border-l-2 border-r-2 border-blue-600 dark:border-blue-500/40 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.1)] dark:shadow-none",
                                        isChanged && "brightness-95"
                                    )}
                                    onClick={() => !isFuture && toggleStudentStatus(student.student_id, lessonKey, status)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (!isFuture && (status === 'attended' || status === 'late')) {
                                            setActivityModal({
                                                open: true,
                                                studentId: student.student_id,
                                                lessonKey,
                                                studentName: student.student_name,
                                                currentScore: activityScore || 0
                                            });
                                        }
                                    }}
                                >
                                    <div className="flex flex-row items-center justify-center h-10 w-full gap-1 lg:flex-col lg:gap-0">
                                        {isFuture ? (
                                            <div className="w-1.5 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full" />
                                        ) : (
                                            <>
                                                <span className="font-bold text-[11px] tracking-wide">
                                                    {getStatusLabel(status)}
                                                </span>
                                                {(status === 'attended' || status === 'late') && (
                                                    <div className="flex items-center gap-0.5 lg:mt-0.5">
                                                        {activityScore !== undefined && activityScore > 0 ? (
                                                            <>
                                                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                                <span className="text-[9px] font-medium text-yellow-600">{activityScore}</span>
                                                            </>
                                                        ) : (
                                                            <div 
                                                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity cursor-pointer flex items-center gap-0.5"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActivityModal({
                                                                        open: true,
                                                                        studentId: student.student_id,
                                                                        lessonKey,
                                                                        studentName: student.student_name,
                                                                        currentScore: 0
                                                                    });
                                                                }}
                                                                title="Add Activity Score"
                                                            >
                                                                <Star className="w-3 h-3 text-gray-400 hover:fill-gray-200 dark:hover:fill-gray-600" />
                                                                <span className="text-[9px] text-gray-400">+</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </TableCell>
                                );
                            })}
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </div>
      </div>

      {/* Activity Score Modal */}
      <Dialog open={activityModal.open} onOpenChange={(open) => !open && setActivityModal(prev => ({ ...prev, open: false }))}>
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
            <div className="mt-3 rounded-lg bg-gray-50 dark:bg-secondary border border-gray-200 dark:border-border p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Scale guide:</p>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">0</span> Did not participate at all</div>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">1-3</span> Minimal participation, mostly passive</div>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">4-5</span> Average participation, answered when asked</div>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">6-7</span> Active, volunteered answers, engaged</div>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">8-9</span> Very active, helped peers, asked questions</div>
              <div className="flex items-center gap-2"><span className="font-medium text-gray-600 dark:text-gray-400 w-10">10</span> Outstanding, led discussions, exceptional effort</div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActivityModal({ open: false, studentId: null, lessonKey: null, studentName: '', currentScore: 0 })}
            >
              Cancel
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
              Save Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lesson topic edit modal */}
      <Dialog open={topicModal.open} onOpenChange={(open) => !open && setTopicModal({ open: false, lesson: null, value: '' })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Тема урока</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {topicModal.lesson && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {topicModal.lesson.title}
              </p>
            )}
            <Input
              autoFocus
              maxLength={200}
              placeholder="Например: Present Perfect Tense"
              value={topicModal.value}
              onChange={(e) => setTopicModal(prev => ({ ...prev, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !savingTopic) saveTopic(); }}
            />
            <p className="text-xs text-gray-400">Оставьте поле пустым, чтобы удалить тему.</p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTopicModal({ open: false, lesson: null, value: '' })}
              disabled={savingTopic}
            >
              Отмена
            </Button>
            <Button onClick={saveTopic} disabled={savingTopic}>
              {savingTopic ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

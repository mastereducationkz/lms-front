import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { cn } from '../lib/utils';
import { toast } from '../components/Toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CuratorGroup {
  id: number;
  name: string;
  start_date: string | null;
  lessons_count: number | null;
  program_week: number | null;
  total_weeks: number | null;
  has_schedule: boolean;
}

interface CuratorTask {
  id: number;
  template_id: number;
  template_title: string | null;
  template_description: string | null;
  task_type: string | null;
  scope: string | null;
  curator_id: number;
  curator_name: string | null;
  student_id: number | null;
  student_name: string | null;
  group_id: number | null;
  group_name: string | null;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  result_text: string | null;
  screenshot_url: string | null;
  week_reference: string | null;
  program_week: number | null;
  created_at: string;
  updated_at: string;
}

interface TaskGroup {
  key: string;
  templateTitle: string;
  templateDescription: string | null;
  category: CategoryKey;
  tasks: CuratorTask[];
  dueDate: string | null;
  isGrouped: boolean;
  isMain: boolean;
}

// ─── Category config ─────────────────────────────────────────────────────────

type CategoryKey = 'os_parent' | 'os_student' | 'post' | 'group' | 'lesson' | 'practice' | 'call' | 'renewal' | 'onboarding';

const CATEGORY_DOT: Record<CategoryKey, string> = {
  os_parent: '#3b82f6', os_student: '#ef4444', post: '#f97316',
  group: '#a855f7', lesson: '#6366f1', practice: '#ef4444',
  call: '#10b981', renewal: '#dc2626', onboarding: '#22c55e',
};
const CATEGORY_LABEL: Record<CategoryKey, string> = {
  os_parent: 'ОС род.', os_student: 'ОС учен.', post: 'Посты',
  group: 'Группа', lesson: 'Урок', practice: 'Practice',
  call: 'Созвон', renewal: 'Продление', onboarding: 'Онбординг',
};

function classifyTask(task: CuratorTask): CategoryKey {
  const title = (task.template_title || '').toLowerCase();
  const type = (task.task_type || '').toLowerCase();
  if (type === 'onboarding') return 'onboarding';
  if (type === 'renewal') return 'renewal';
  if (title.includes('родител')) return 'os_parent';
  if (title.includes('обратная связь') && title.includes('лс')) return 'os_student';
  if (title.includes('ос ученику')) return 'os_student';
  if (title.includes('пост в беседу')) return 'post';
  if (title.includes('лидерборд')) return 'group';
  if (title.includes('кураторский час')) return 'call';
  if (title.includes('напоминание') && (title.includes('урок') || title.includes('вебинар'))) return 'lesson';
  if (title.includes('weekly practice') || title.includes('practice')) return 'practice';
  if (task.scope === 'group') return 'group';
  return 'os_student';
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:     { label: 'Ожидает',    bg: 'bg-gray-50',    text: 'text-gray-600'   },
  in_progress: { label: 'В процессе', bg: 'bg-blue-50',    text: 'text-blue-700'   },
  completed:   { label: 'Готово',     bg: 'bg-emerald-50', text: 'text-emerald-700' },
  overdue:     { label: 'Просрочено', bg: 'bg-red-50',     text: 'text-red-700'    },
};
const ALL_STATUSES = ['pending', 'in_progress', 'completed', 'overdue'];
const DAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

// ─── Week / date helpers ──────────────────────────────────────────────────────

function getISOWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDates(weekStr: string): Date[] {
  const [yearStr, weekPart] = weekStr.split('-W');
  const year = parseInt(yearStr), week = parseInt(weekPart);
  const jan4 = new Date(year, 0, 4);
  const dow = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}

/** Given a group's start_date and total_weeks, calculate the ISO week string for program_week N */
function isoWeekForProgramWeek(startDate: string, programWeek: number): string {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const target = new Date(sy, sm - 1, sd + (programWeek - 1) * 7);
  return getISOWeekString(target);
}

/** Shift an ISO week string by N weeks (positive = future, negative = past). */
function isoWeekAddWeeks(weekStr: string, delta: number): string {
  const dates = getWeekDates(weekStr);
  const monday = dates[0];
  monday.setDate(monday.getDate() + delta * 7);
  return getISOWeekString(monday);
}

/** Compute week offset (in weeks) from current ISO week to target ISO week. */
function getWeekOffset(targetWeekStr: string): number {
  const current = getISOWeekString(new Date());
  if (targetWeekStr === current) return 0;
  const currentMonday = getWeekDates(current)[0].getTime();
  const targetMonday = getWeekDates(targetWeekStr)[0].getTime();
  return Math.round((targetMonday - currentMonday) / (7 * 86400000));
}

/** Given an ISO week and group start_date, compute the program week (1-based) that contains that ISO week. */
function programWeekForIsoWeek(isoWeekStr: string, startDate: string): number | null {
  const monday = getWeekDates(isoWeekStr)[0];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const startLocal = new Date(sy, sm - 1, sd);
  const mondayLocal = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
  const deltaDays = Math.round((mondayLocal.getTime() - startLocal.getTime()) / 86400000);
  if (deltaDays < 0) return null;
  return Math.floor(deltaDays / 7) + 1;
}

function formatDeadlineTime(dueDate: string | null): string | null {
  if (!dueDate) return null;
  try {
    const d = new Date(dueDate);
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const almatyDate = new Date(utcMs + 5 * 60 * 60000);
    return `${String(almatyDate.getHours()).padStart(2, '0')}:${String(almatyDate.getMinutes()).padStart(2, '0')}`;
  } catch { return null; }
}

function getDueDayIndex(dueDate: string | null): number | null {
  if (!dueDate) return null;
  try {
    const d = new Date(dueDate);
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const almatyDate = new Date(utcMs + 5 * 60 * 60000);
    const day = almatyDate.getDay();
    return day === 0 ? 6 : day - 1;
  } catch { return null; }
}

function getWeekDateRange(weekStr: string): string {
  const dates = getWeekDates(weekStr);
  const m = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  const f = dates[0], l = dates[6];
  if (f.getMonth() === l.getMonth()) return `${f.getDate()} – ${l.getDate()} ${m[f.getMonth()]}`;
  return `${f.getDate()} ${m[f.getMonth()]} – ${l.getDate()} ${m[l.getMonth()]}`;
}

function groupTasksForDay(dayTasks: CuratorTask[]): TaskGroup[] {
  const map = new Map<string, CuratorTask[]>();
  for (const t of dayTasks) {
    // Per-student tasks: group by template_id (show as GroupedCard when multiple students)
    // Group-scoped tasks: split by group_id so each group gets its own card when viewing "Все группы"
    const key = t.student_id != null
      ? `${t.template_id}`
      : `${t.template_id}-${t.group_id ?? 0}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  const groups: TaskGroup[] = [];
  for (const [key, tasks] of map) {
    const first = tasks[0];
    const isMain = first.scope === 'student';
    groups.push({
      key,
      templateTitle: first.template_title || 'Задача',
      templateDescription: first.template_description || null,
      category: classifyTask(first),
      tasks,
      dueDate: first.due_date,
      isGrouped: tasks.length > 1 && tasks.every(t => t.student_id !== null),
      isMain,
    });
  }
  groups.sort((a, b) => (a.isMain === b.isMain ? 0 : a.isMain ? -1 : 1));
  return groups;
}

function getGroupStatus(tasks: CuratorTask[]): string {
  const total = tasks.length, done = tasks.filter(t => t.status === 'completed').length;
  const overdue = tasks.filter(t => t.status === 'overdue').length;
  if (done === total) return 'completed';
  if (overdue > 0) return 'overdue';
  if (done > 0) return 'in_progress';
  return 'pending';
}

const sLabel = (s: string) => STATUS_CONFIG[s]?.label || s;

// ─── Main Page ────────────────────────────────────────────────────────────────

function isLeaderboardTask(task: CuratorTask): boolean {
  return (task.template_title || '').toLowerCase().includes('лидерборд');
}

function getLeaderboardUrl(task: CuratorTask): string {
  const params = new URLSearchParams();
  if (task.group_id) params.set('groupId', String(task.group_id));
  if (task.program_week) params.set('week', String(task.program_week));
  return `/curator/leaderboard?${params.toString()}`;
}

export default function CuratorTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isHeadCurator = user?.role === 'head_curator';
  const [urlSynced, setUrlSynced] = useState(false);

  const [groups, setGroups] = useState<CuratorGroup[]>([]);
  const [curators, setCurators] = useState<Array<{ curator_id: number; curator_name: string }>>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedCuratorId, setSelectedCuratorId] = useState<number | null>(null);
  const [viewProgramWeek, setViewProgramWeek] = useState<number | null>(null); // null = current week
  const [viewIsoWeekOffset, setViewIsoWeekOffset] = useState(0); // offset from current ISO week when in calendar mode

  const [tasks, setTasks] = useState<CuratorTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Single task dialog
  const [singleDialogOpen, setSingleDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CuratorTask | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editResultText, setEditResultText] = useState('');
  const [editScreenshotUrl, setEditScreenshotUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Grouped task dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<TaskGroup | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);
  const [studentEditStatus, setStudentEditStatus] = useState('');
  const [studentEditResult, setStudentEditResult] = useState('');
  const [studentEditScreenshot, setStudentEditScreenshot] = useState('');
  const [studentSaving, setStudentSaving] = useState<number | null>(null);

  // ─── Derived values ────────────────────────────────────────────────────────

  const selectedGroup_data = groups.find(g => g.id === selectedGroupId) ?? null;
  const currentProgramWeek = selectedGroup_data?.program_week ?? null;
  const totalWeeks = selectedGroup_data?.total_weeks ?? null;

  // "Current" mode uses calendar ISO week; arrows switch to explicit program week view.
  const isCurrentCalendarMode = viewProgramWeek === null;

  // The program week we're currently viewing (only when user explicitly navigates weeks)
  const activeProgramWeek = isCurrentCalendarMode ? null : viewProgramWeek;
  const navProgramWeek = viewProgramWeek ?? currentProgramWeek;

  // ISO week string for the active week
  const activeIsoWeek = useMemo(() => {
    if (!isCurrentCalendarMode && selectedGroup_data?.start_date && activeProgramWeek) {
      return isoWeekForProgramWeek(selectedGroup_data.start_date, activeProgramWeek);
    }
    const base = getISOWeekString(new Date());
    return viewIsoWeekOffset === 0 ? base : isoWeekAddWeeks(base, viewIsoWeekOffset);
  }, [selectedGroup_data, activeProgramWeek, isCurrentCalendarMode, viewIsoWeekOffset]);

  // ─── Load groups ────────────────────────────────────────────────────────────

  useEffect(() => {
    apiClient.getCuratorTaskGroups().then(data => {
      setGroups(data);
      const week = searchParams.get('week');
      const groupIdParam = searchParams.get('groupId');
      if (week && /^\d{4}-W\d{2}$/.test(week)) {
        setViewIsoWeekOffset(getWeekOffset(week));
      }
      if (groupIdParam) {
        const gid = parseInt(groupIdParam, 10);
        if (!isNaN(gid) && data.some(g => g.id === gid)) {
          setSelectedGroupId(gid);
        } else if (data.length > 0 && !isHeadCurator && data.length === 1) {
          setSelectedGroupId(data[0].id);
        }
      } else if (data.length > 0 && !isHeadCurator && data.length === 1) {
        setSelectedGroupId(data[0].id);
      }
      setUrlSynced(true);
    }).catch(console.error);
  }, [isHeadCurator]);

  // Sync URL -> state when user navigates (back/forward)
  useEffect(() => {
    if (!urlSynced) return;
    const week = searchParams.get('week');
    const groupIdParam = searchParams.get('groupId');
    if (week && /^\d{4}-W\d{2}$/.test(week)) {
      setViewIsoWeekOffset(getWeekOffset(week));
    }
    if (groupIdParam) {
      const gid = parseInt(groupIdParam, 10);
      const valid = !isNaN(gid) && groups.length > 0 && groups.some(g => g.id === gid);
      setSelectedGroupId(valid ? gid : null);
    } else {
      setSelectedGroupId(null);
    }
  }, [searchParams, urlSynced, groups]);

  // Sync state -> URL
  useEffect(() => {
    if (!urlSynced) return;
    const params = new URLSearchParams();
    params.set('week', activeIsoWeek);
    if (selectedGroupId != null) params.set('groupId', String(selectedGroupId));
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      setSearchParams(params, { replace: true });
    }
  }, [activeIsoWeek, selectedGroupId, urlSynced]);

  // ─── Load curators (head curator only) ───────────────────────────────────────

  useEffect(() => {
    if (isHeadCurator) {
      apiClient.getCuratorsSummary().then(data => {
        setCurators(data.map((c: any) => ({ curator_id: c.curator_id, curator_name: c.curator_name || 'Unknown' })));
      }).catch(console.error);
    }
  }, [isHeadCurator]);

  // ─── Load tasks ────────────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      if (isHeadCurator) {
        const params: any = { limit: 200 };
        if (selectedCuratorId) params.curator_id = selectedCuratorId;
        if (selectedGroupId) params.group_id = selectedGroupId;
        if (filterStatus !== 'all') params.status = filterStatus;
        if (!isCurrentCalendarMode && selectedGroup_data && activeProgramWeek !== null) {
          params.program_week = activeProgramWeek;
        } else {
          params.week = activeIsoWeek;
        }
        const result = await apiClient.getAllCuratorTasks(params);
        setTasks(result.tasks || []);
      } else {
        const params: any = { limit: 200 };
        if (selectedGroupId) params.group_id = selectedGroupId;
        if (filterStatus !== 'all') params.status = filterStatus;
        if (!isCurrentCalendarMode && selectedGroup_data && activeProgramWeek !== null) {
          params.program_week = activeProgramWeek;
        } else {
          params.week = activeIsoWeek;
        }
        const result = await apiClient.getCuratorTasks(params);
        setTasks(result.tasks || []);
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [isHeadCurator, selectedGroupId, selectedCuratorId, selectedGroup_data, activeProgramWeek, activeIsoWeek, filterStatus, isCurrentCalendarMode]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ─── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await apiClient.generateWeeklyTasks(activeIsoWeek, selectedGroupId ?? undefined);
      toast(r.detail, 'success');
      await loadTasks();
    } catch (e: any) {
      toast(e?.response?.data?.detail || 'Ошибка генерации', 'error');
    } finally { setGenerating(false); }
  };

  // ─── Tasks by day ──────────────────────────────────────────────────────────

  const tasksByDay = useMemo(() => {
    const b: CuratorTask[][] = Array.from({ length: 7 }, () => []);
    const noDayTasks: CuratorTask[] = [];
    for (const t of tasks) {
      const idx = getDueDayIndex(t.due_date);
      if (idx !== null && idx >= 0 && idx < 7) b[idx].push(t);
      else noDayTasks.push(t);
    }
    if (noDayTasks.length > 0) b[0] = [...noDayTasks, ...b[0]];
    return b;
  }, [tasks]);

  const groupsByDay = useMemo(() => tasksByDay.map(dayTasks => groupTasksForDay(dayTasks)), [tasksByDay]);

  const done = tasks.filter(t => t.status === 'completed').length;
  const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  // ─── Dialog handlers ───────────────────────────────────────────────────────

  const openSingleDialog = (t: CuratorTask) => {
    setSelectedTask(t); setEditStatus(t.status);
    setEditResultText(t.result_text || ''); setEditScreenshotUrl(t.screenshot_url || '');
    setSingleDialogOpen(true);
  };

  const handleSaveSingle = async () => {
    if (!selectedTask) return;
    setSaving(true);
    try {
      const d: any = {};
      if (editStatus !== selectedTask.status) d.status = editStatus;
      if (editResultText !== (selectedTask.result_text || '')) d.result_text = editResultText;
      if (editScreenshotUrl !== (selectedTask.screenshot_url || '')) d.screenshot_url = editScreenshotUrl;
      if (Object.keys(d).length > 0) { await apiClient.updateCuratorTask(selectedTask.id, d); toast('Задача обновлена', 'success'); await loadTasks(); }
      setSingleDialogOpen(false);
    } catch (e: any) { toast(e?.response?.data?.detail || 'Ошибка', 'error'); }
    finally { setSaving(false); }
  };

  const openGroupDialog = (group: TaskGroup) => { setSelectedGroup(group); setExpandedStudentId(null); setGroupDialogOpen(true); };

  const expandStudent = (task: CuratorTask) => {
    if (expandedStudentId === task.id) { setExpandedStudentId(null); return; }
    setExpandedStudentId(task.id); setStudentEditStatus(task.status);
    setStudentEditResult(task.result_text || ''); setStudentEditScreenshot(task.screenshot_url || '');
  };

  const handleSaveStudent = async (task: CuratorTask) => {
    setStudentSaving(task.id);
    try {
      const d: any = {};
      if (studentEditStatus !== task.status) d.status = studentEditStatus;
      if (studentEditResult !== (task.result_text || '')) d.result_text = studentEditResult;
      if (studentEditScreenshot !== (task.screenshot_url || '')) d.screenshot_url = studentEditScreenshot;
      if (Object.keys(d).length > 0) { await apiClient.updateCuratorTask(task.id, d); toast('Обновлено', 'success'); await loadTasks(); }
      setExpandedStudentId(null);
    } catch (e: any) { toast(e?.response?.data?.detail || 'Ошибка', 'error'); }
    finally { setStudentSaving(null); }
  };

  const handleToggleComplete = async (task: CuratorTask) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    setStudentSaving(task.id);
    try { await apiClient.updateCuratorTask(task.id, { status: newStatus }); await loadTasks(); }
    catch (e: any) { toast(e?.response?.data?.detail || 'Ошибка', 'error'); }
    finally { setStudentSaving(null); }
  };

  const handleCompleteAll = async (group: TaskGroup) => {
    const pending = group.tasks.filter(t => t.status !== 'completed');
    if (pending.length === 0) return;
    const editable = isHeadCurator ? pending.filter(t => t.curator_id === Number(user?.id)) : pending;
    if (editable.length === 0) return;
    setStudentSaving(-1);
    try {
      await apiClient.bulkUpdateCuratorTasks(editable.map(t => t.id), 'completed');
      toast(`${editable.length} задач выполнено`, 'success');
      await loadTasks();
    } catch (e: any) { toast(e?.response?.data?.detail || 'Ошибка', 'error'); }
    finally { setStudentSaving(null); }
  };

  const liveGroup = useMemo(() => {
    if (!selectedGroup) return null;
    const liveTasks = tasks.filter(t => String(t.template_id) === selectedGroup.key);
    return liveTasks.length === 0 ? selectedGroup : { ...selectedGroup, tasks: liveTasks };
  }, [selectedGroup, tasks]);

  // ─── Header labels ─────────────────────────────────────────────────────────
  // All groups: show date range. Specific group: show relative program week.
  const viewedProgramWeek = selectedGroup_data?.start_date
    ? programWeekForIsoWeek(activeIsoWeek, selectedGroup_data.start_date)
    : null;
  const weekLabel = selectedGroup_data && viewedProgramWeek != null && totalWeeks && viewedProgramWeek >= 1 && viewedProgramWeek <= totalWeeks
    ? `Неделя ${viewedProgramWeek}${totalWeeks ? ` из ${totalWeeks}` : ''}`
    : getWeekDateRange(activeIsoWeek);

  const phaseLabel = viewedProgramWeek === 1 ? 'Онбординг'
    : totalWeeks && viewedProgramWeek != null && viewedProgramWeek >= totalWeeks - 1 ? 'Продление'
    : null;

  const hasGroupContext = selectedGroup_data != null;
  const canGoPrev = isCurrentCalendarMode
    ? viewIsoWeekOffset > -52
    : hasGroupContext && !!navProgramWeek && navProgramWeek > 1;
  const canGoNext = isCurrentCalendarMode
    ? viewIsoWeekOffset < 52
    : hasGroupContext && !!navProgramWeek && (totalWeeks ? navProgramWeek < totalWeeks : true);

  const handlePrevWeek = () => {
    if (!canGoPrev) return;
    if (isCurrentCalendarMode) {
      setViewIsoWeekOffset(o => o - 1);
    } else if (navProgramWeek) {
      setViewProgramWeek(navProgramWeek - 1);
    }
  };
  const handleNextWeek = () => {
    if (!canGoNext) return;
    if (isCurrentCalendarMode) {
      setViewIsoWeekOffset(o => o + 1);
    } else if (navProgramWeek) {
      setViewProgramWeek(navProgramWeek + 1);
    }
  };
  const handleCurrentWeek = () => {
    setViewProgramWeek(null);
    setViewIsoWeekOffset(0);
  };

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-gray-900">{weekLabel}</h1>
              {phaseLabel && (
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full text-white',
                  phaseLabel === 'Онбординг' ? 'bg-emerald-500' : 'bg-red-500'
                )}>{phaseLabel}</span>
              )}
            </div>
            {selectedGroup_data && viewedProgramWeek != null && (
              <p className="text-xs text-gray-400 mt-0.5">{getWeekDateRange(activeIsoWeek)}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Curator filter (head curator only) */}
          {isHeadCurator && curators.length > 0 && (
            <Select value={selectedCuratorId ? String(selectedCuratorId) : 'all'} onValueChange={v => setSelectedCuratorId(v === 'all' ? null : Number(v))}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Куратор" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все кураторы</SelectItem>
                {curators.map(c => (
                  <SelectItem key={c.curator_id} value={String(c.curator_id)}>{c.curator_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Group selector */}
          {groups.length > 0 && (
            <Select value={selectedGroupId ? String(selectedGroupId) : 'all'} onValueChange={v => { setSelectedGroupId(v === 'all' ? null : Number(v)); setViewProgramWeek(null); setViewIsoWeekOffset(0); }}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Все группы" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все группы</SelectItem>
                {groups.map(g => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}{g.program_week ? ` · нед. ${g.program_week}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Week navigation */}
          <div className="flex items-center border rounded-lg overflow-hidden bg-white h-8">
            <button className="h-full px-2.5 text-xs text-gray-500 hover:bg-gray-50 border-r transition-colors disabled:opacity-30" onClick={handlePrevWeek} disabled={!canGoPrev}>←</button>
            <button className="h-full px-3 text-xs text-gray-600 font-medium hover:bg-gray-50 transition-colors" onClick={handleCurrentWeek}>Текущая</button>
            <button className="h-full px-2.5 text-xs text-gray-500 hover:bg-gray-50 border-l transition-colors disabled:opacity-30" onClick={handleNextWeek} disabled={!canGoNext}>→</button>
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ожидает</SelectItem>
              <SelectItem value="in_progress">В процессе</SelectItem>
              <SelectItem value="completed">Готово</SelectItem>
              <SelectItem value="overdue">Просрочено</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats bar */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-4">
          <Progress value={pct} className="flex-1 h-1.5" />
          <span className="text-xs text-gray-500 tabular-nums whitespace-nowrap">{done} из {tasks.length}</span>
          {!isHeadCurator && (
            <Button onClick={handleGenerate} disabled={generating} size="sm" variant="ghost" className="h-7 px-2.5 text-xs text-gray-400 hover:text-gray-600">
              {generating ? 'Обновление...' : '↻ Перегенерировать'}
            </Button>
          )}
        </div>
      )}

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-gray-400">Загрузка...</div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-sm text-gray-400">
            Нет задач {activeProgramWeek ? `на неделю ${activeProgramWeek}` : 'на эту неделю'}
          </p>
          {!isHeadCurator && (
            <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline">
              {generating ? 'Генерация...' : 'Сгенерировать задачи'}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {DAY_LABELS.map((label, dayIdx) => {
            const dayGroups = groupsByDay[dayIdx];
            const dates = getWeekDates(activeIsoWeek);
            const isToday = dates[dayIdx].toDateString() === new Date().toDateString();
            const dayDate = dates[dayIdx].getDate();

            return (
              <div key={dayIdx} className="flex flex-col min-h-[300px]">
                <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-lg mb-2', isToday ? 'bg-gray-900' : 'bg-gray-100')}>
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', isToday ? 'text-white' : 'text-gray-500')}>{label}</span>
                  <span className={cn('text-xs font-medium', isToday ? 'text-gray-300' : 'text-gray-400')}>{dayDate}</span>
                </div>
                <div className="flex-1 space-y-2.5">
                  {(() => {
                    const mainGroups = dayGroups.filter(g => g.isMain);
                    const parallelGroups = dayGroups.filter(g => !g.isMain);
                    const renderGroup = (group: TaskGroup) => group.isGrouped
                      ? <GroupedCard key={group.key} group={group} onClick={() => openGroupDialog(group)} showCuratorName={isHeadCurator} isMain={group.isMain} />
                      : <SingleCard key={group.tasks[0].id} task={group.tasks[0]} onClick={() => openSingleDialog(group.tasks[0])} showCuratorName={isHeadCurator} onNavigate={navigate} isMain={group.isMain} />;
                    return (
                      <>
                        {mainGroups.map(renderGroup)}
                        {mainGroups.length > 0 && parallelGroups.length > 0 && (
                          <div className="border-t border-dashed border-gray-200 my-1" />
                        )}
                        {parallelGroups.map(renderGroup)}
                      </>
                    );
                  })()}
                  {dayGroups.length === 0 && <div className="flex items-center justify-center min-h-[60px]"><span className="text-[10px] text-gray-300">—</span></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Single task dialog */}
      <Dialog open={singleDialogOpen} onOpenChange={setSingleDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold pr-6">{selectedTask?.template_title}</DialogTitle>
            <DialogDescription className="sr-only">Детали задачи</DialogDescription>
          </DialogHeader>
          {selectedTask && (() => {
            const cat = classifyTask(selectedTask);
            const statusCfg = STATUS_CONFIG[selectedTask.status] || STATUS_CONFIG.pending;
            const canEditTask = !isHeadCurator || selectedTask.curator_id === Number(user?.id);
            return (
              <div className="space-y-4 py-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] gap-1.5 font-normal">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: CATEGORY_DOT[cat] }} />{CATEGORY_LABEL[cat]}
                  </Badge>
                  <Badge className={cn('border-0 text-[10px] px-2 py-0.5 rounded', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</Badge>
                  {selectedTask.student_name && <Badge variant="outline" className="text-[10px] font-normal">{selectedTask.student_name}</Badge>}
                  {selectedTask.group_name && <Badge variant="outline" className="text-[10px] font-normal">{selectedTask.group_name}</Badge>}
                  {isHeadCurator && selectedTask.curator_name && <Badge variant="outline" className="text-[10px] font-normal">{selectedTask.curator_name}</Badge>}
                  {selectedTask.program_week && <Badge variant="outline" className="text-[10px] font-normal">Нед. {selectedTask.program_week}</Badge>}
                </div>
                {selectedTask.template_description && <p className="text-sm text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3">{selectedTask.template_description}</p>}
                {selectedTask.due_date && <p className="text-xs text-gray-400">Дедлайн: {new Date(selectedTask.due_date).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Статус</label>
                  <Select value={editStatus} onValueChange={setEditStatus} disabled={!canEditTask}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{sLabel(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Результат</label>
                  <Textarea value={editResultText} onChange={e => setEditResultText(e.target.value)} placeholder="Опишите результат..." className="text-sm min-h-[70px] resize-none" disabled={!canEditTask} readOnly={!canEditTask} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Скриншот (ссылка)</label>
                  <Input value={editScreenshotUrl} onChange={e => setEditScreenshotUrl(e.target.value)} placeholder="https://..." className="text-sm h-9" disabled={!canEditTask} readOnly={!canEditTask} />
                </div>
                {selectedTask.screenshot_url && <a href={selectedTask.screenshot_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline inline-block">Открыть скриншот →</a>}
                {isLeaderboardTask(selectedTask) && selectedTask.group_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs mt-1"
                    onClick={() => { setSingleDialogOpen(false); navigate(getLeaderboardUrl(selectedTask)); }}
                  >
                    Перейти к лидерборду →
                  </Button>
                )}
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSingleDialogOpen(false)}>Закрыть</Button>
            {(!selectedTask || !isHeadCurator || selectedTask.curator_id === Number(user?.id)) && (
              <Button size="sm" onClick={handleSaveSingle} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grouped task dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold pr-6">{liveGroup?.templateTitle}</DialogTitle>
            <DialogDescription className="sr-only">Групповая задача</DialogDescription>
          </DialogHeader>
          {liveGroup && (() => {
            const doneCnt = liveGroup.tasks.filter(t => t.status === 'completed').length;
            const totalCnt = liveGroup.tasks.length;
            const groupPct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0;
            const groupSt = getGroupStatus(liveGroup.tasks);
            const statusCfg = STATUS_CONFIG[groupSt] || STATUS_CONFIG.pending;
            return (
              <div className="flex-1 overflow-hidden flex flex-col gap-3 py-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] gap-1.5 font-normal">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: CATEGORY_DOT[liveGroup.category] }} />{CATEGORY_LABEL[liveGroup.category]}
                  </Badge>
                  <Badge className={cn('border-0 text-[10px] px-2 py-0.5 rounded', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</Badge>
                  <span className="text-xs text-gray-400 ml-auto tabular-nums">{doneCnt}/{totalCnt}</span>
                </div>
                <Progress value={groupPct} className="h-1.5" />
                {liveGroup.templateDescription && <p className="text-sm text-gray-500 leading-relaxed bg-gray-50 rounded-lg p-3">{liveGroup.templateDescription}</p>}
                {doneCnt < totalCnt && (!isHeadCurator || liveGroup.tasks.some((t: CuratorTask) => t.curator_id === Number(user?.id))) && (
                  <Button size="sm" variant="outline" className="self-start text-xs" onClick={() => handleCompleteAll(liveGroup)} disabled={studentSaving === -1}>
                    {studentSaving === -1 ? 'Выполняем...' : `Отметить все как готово (${totalCnt - doneCnt})`}
                  </Button>
                )}
                <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
                  {liveGroup.tasks.slice().sort((a, b) => {
                    const order: Record<string, number> = { overdue: 0, pending: 1, in_progress: 2, completed: 3 };
                    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
                  }).map(task => {
                    const isExpanded = expandedStudentId === task.id;
                    const tStatusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
                    const isSavingThis = studentSaving === task.id;
                    const canEditThis = !isHeadCurator || task.curator_id === Number(user?.id);
                    return (
                      <div key={task.id} className="border border-gray-100 rounded-lg overflow-hidden">
                        <div className={cn('flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors', isExpanded && 'bg-gray-50')} onClick={() => expandStudent(task)}>
                          <button
                            onClick={e => { e.stopPropagation(); canEditThis && handleToggleComplete(task); }}
                            disabled={isSavingThis || !canEditThis}
                            className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors text-[10px]',
                              task.status === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-400' : 'border-gray-300 hover:border-emerald-400 text-transparent hover:text-emerald-400'
                            )}>✓</button>
                          <span className={cn('text-sm flex-1 truncate', task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700')}>
                            {task.student_name || task.group_name || '—'}
                          </span>
                          <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded', tStatusCfg.bg, tStatusCfg.text)}>{tStatusCfg.label}</span>
                          <span className={cn('text-[10px] transition-transform', isExpanded && 'rotate-180')}>▾</span>
                        </div>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-gray-100 bg-gray-50/50">
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">Статус</label>
                              <Select value={studentEditStatus} onValueChange={setStudentEditStatus} disabled={!canEditThis}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{sLabel(s)}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">Результат</label>
                              <Textarea value={studentEditResult} onChange={e => setStudentEditResult(e.target.value)} placeholder="Опишите результат..." className="text-xs min-h-[50px] resize-none" disabled={!canEditThis} readOnly={!canEditThis} />
                            </div>
                            <div>
                              <label className="block text-[10px] text-gray-400 mb-0.5">Скриншот</label>
                              <Input value={studentEditScreenshot} onChange={e => setStudentEditScreenshot(e.target.value)} placeholder="https://..." className="text-xs h-8" disabled={!canEditThis} readOnly={!canEditThis} />
                            </div>
                            {canEditThis && (
                              <div className="flex justify-end gap-1.5 pt-1">
                                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setExpandedStudentId(null)}>Отмена</Button>
                                <Button size="sm" className="text-xs h-7" onClick={() => handleSaveStudent(task)} disabled={isSavingThis}>{isSavingThis ? '...' : 'Сохранить'}</Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          <DialogFooter><Button variant="ghost" size="sm" onClick={() => setGroupDialogOpen(false)}>Закрыть</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Card components ──────────────────────────────────────────────────────────

function SingleCard({ task, onClick, showCuratorName, onNavigate, isMain }: { task: CuratorTask; onClick: () => void; showCuratorName?: boolean; onNavigate?: (url: string) => void; isMain?: boolean }) {
  const cat = classifyTask(task);
  const deadline = formatDeadlineTime(task.due_date);
  const isCompleted = task.status === 'completed';
  const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const showLeaderboardLink = isLeaderboardTask(task) && task.group_id && onNavigate;
  return (
    <button onClick={onClick} className={cn('w-full text-left bg-white rounded-lg p-3 transition-all hover:shadow-md hover:-translate-y-px active:shadow-sm active:translate-y-0 border', isCompleted && 'opacity-50')} style={{ borderColor: isMain ? `${CATEGORY_DOT[cat]}66` : undefined }}>
      <p className={cn('text-[13px] font-medium leading-snug line-clamp-2', isCompleted ? 'text-gray-400 line-through' : 'text-gray-800')}>{task.template_title}</p>
      {(task.student_name || task.group_name || (showCuratorName && task.curator_name)) && (
        <p className="text-[11px] text-gray-400 mt-1.5 line-clamp-1">
          {[task.student_name, task.group_name, showCuratorName && task.curator_name ? task.curator_name : null].filter(Boolean).join(' · ')}
        </p>
      )}
      {showLeaderboardLink && (
        <span
          role="link"
          className="inline-block text-[10px] text-blue-500 hover:text-blue-700 hover:underline mt-1.5 cursor-pointer"
          onClick={e => { e.stopPropagation(); onNavigate!(getLeaderboardUrl(task)); }}
        >
          Открыть лидерборд →
        </span>
      )}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_DOT[cat] }} />
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</span>
        </div>
        {deadline && <span className={cn('text-[10px]', task.status === 'overdue' ? 'text-red-500 font-medium' : 'text-gray-400')}>{deadline}</span>}
      </div>
    </button>
  );
}

function GroupedCard({ group, onClick, showCuratorName, isMain }: { group: TaskGroup; onClick: () => void; showCuratorName?: boolean; isMain?: boolean }) {
  const deadline = formatDeadlineTime(group.dueDate);
  const doneCnt = group.tasks.filter(t => t.status === 'completed').length;
  const totalCnt = group.tasks.length;
  const groupPct = totalCnt > 0 ? Math.round((doneCnt / totalCnt) * 100) : 0;
  const allDone = doneCnt === totalCnt;
  const groupSt = getGroupStatus(group.tasks);
  const statusCfg = STATUS_CONFIG[groupSt] || STATUS_CONFIG.pending;
  const curatorNames = showCuratorName ? [...new Set(group.tasks.map(t => t.curator_name).filter(Boolean))] : [];
  return (
    <button onClick={onClick} className={cn('w-full text-left bg-white rounded-lg p-3 transition-all hover:shadow-md hover:-translate-y-px active:shadow-sm active:translate-y-0 border', allDone && 'opacity-50')} style={{ borderColor: isMain ? `${CATEGORY_DOT[group.category]}66` : undefined }}>
      <p className={cn('text-[13px] font-medium leading-snug line-clamp-2', allDone ? 'text-gray-400 line-through' : 'text-gray-800')}>{group.templateTitle}</p>
      {showCuratorName && curatorNames.length > 0 && (
        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">{curatorNames.join(', ')}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all', allDone ? 'bg-emerald-400' : 'bg-blue-400')} style={{ width: `${groupPct}%` }} />
        </div>
        <span className="text-[11px] text-gray-400 tabular-nums">{doneCnt}/{totalCnt}</span>
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CATEGORY_DOT[group.category] }} />
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded', statusCfg.bg, statusCfg.text)}>{statusCfg.label}</span>
        </div>
        {deadline && <span className={cn('text-[10px]', groupSt === 'overdue' ? 'text-red-500 font-medium' : 'text-gray-400')}>{deadline}</span>}
      </div>
    </button>
  );
}

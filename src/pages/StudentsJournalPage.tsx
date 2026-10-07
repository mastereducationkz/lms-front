import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { CompletionMeta } from '../components/progress/CompletionMeta';
import type { CheckpointSummary } from '../lib/completion';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';
import UserAvatar from '@/components/mascot/UserAvatar';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: number;
  name: string;
  email: string;
  is_inactive?: boolean;
  avatar_url: string | null;
  mascot?: string | null;
  group_id: number;
  group_name: string;
  attendance_attended: number;
  attendance_total: number;
  attendance_rate: number | null;
  lms_progress: number | null;
  lms_lessons_done?: number;
  lms_lessons_total?: number;
  checkpoints?: CheckpointSummary | null;
  hw_submitted: number;
  hw_avg_score: number | null;
  az_status: 'not_started' | 'draft' | 'submitted';
  last_activity: string | null;
}

interface Group {
  id: number;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function azBadge(status: StudentRow['az_status']) {
  if (status === 'submitted') return <Badge className="bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30 text-[11px] font-medium">Сдано</Badge>;
  if (status === 'draft') return <Badge className="bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30 text-[11px] font-medium">Черновик</Badge>;
  return <Badge className="bg-muted text-muted-foreground border-border text-[11px] font-medium">Не начато</Badge>;
}

function attendanceBadge(rate: number | null, attended: number, total: number) {
  if (total === 0) return <span className="text-muted-foreground text-sm">—</span>;
  const pct = rate ?? 0;
  const color = pct >= 80 ? 'text-green-700 dark:text-green-300' : pct >= 60 ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-600 dark:text-red-300';
  return (
    <span className={`text-sm font-medium ${color}`}>
      {attended}/{total} <span className="text-muted-foreground font-normal">({pct}%)</span>
    </span>
  );
}

function progressBar(value: number | null) {
  if (value === null) return <span className="text-muted-foreground text-sm">—</span>;
  const color = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-brand-solid' : 'bg-muted-foreground/30';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-sm text-muted-foreground">{value}%</span>
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentsJournalPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  // Debounced: without it every keystroke fired a /student-journal/list request.
  const debouncedSearch = useDebouncedValue(search, 350);
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: pageSize, offset: page * pageSize };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (selectedGroup !== 'all') params.group_id = Number(selectedGroup);
      if (showArchived) params.include_archived = true;
      if (showInactive) params.include_inactive = true;
      const data = await apiClient.getStudentsJournal(params);
      setStudents(data.students);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedGroup, page, showArchived, showInactive]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiClient.getStudentJournalGroups(showArchived).then(setGroups).catch(console.error);
  }, [showArchived]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [debouncedSearch, selectedGroup, showArchived, showInactive]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="max-w-[1440px] mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-foreground">Журнал студентов</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} студентов</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Input
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-52 h-8 text-sm"
          />
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue placeholder="Все группы" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все группы</SelectItem>
              {groups.map(g => (
                <SelectItem key={g.id} value={String(g.id)}>
                  {g.name}{(g as { is_archived?: boolean }).is_archived ? ' (архив)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded border-border"
            />
            Архивные группы
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-border"
            />
            Деактивированные
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-muted border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Студент</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Группа</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Посещаемость</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">LMS</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Домашки</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Assignment Zero</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Активность</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  {search || selectedGroup !== 'all' ? 'Студенты не найдены' : 'Нет студентов'}
                </td>
              </tr>
            ) : (
              students.map(s => (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/curator/students/${s.id}`)}
                  data-tip="journal-row"
                  className="border-b border-border hover:bg-muted/60 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar userId={s.id} name={s.name} avatarUrl={s.avatar_url} mascot={s.mascot} isStudent size={28} />
                      <div>
                        <p className="font-medium text-foreground text-sm leading-tight">
                          {s.name}
                          {s.is_inactive && (
                            <span className="ml-1.5 text-[10px] font-normal text-red-500 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded px-1 py-px align-middle">деактивирован</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">{s.group_name}</span>
                  </td>
                  <td className="px-4 py-3">
                    {attendanceBadge(s.attendance_rate, s.attendance_attended, s.attendance_total)}
                  </td>
                  <td className="px-4 py-3">
                    {progressBar(s.lms_progress)}
                    <CompletionMeta
                      className="mt-1"
                      lessonsDone={s.lms_lessons_done}
                      lessonsTotal={s.lms_lessons_total}
                      checkpoints={s.checkpoints}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {s.hw_submitted > 0 ? (
                      <span className="text-sm text-foreground">
                        {s.hw_submitted} сдано{s.hw_avg_score !== null ? ` · ${s.hw_avg_score} б.` : ''}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{azBadge(s.az_status)}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">{formatDate(s.last_activity)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Показано {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} из {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Назад</Button>
            <span className="flex items-center px-2">Стр. {page + 1} из {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Вперёд</Button>
          </div>
        </div>
      )}
    </div>
  );
}

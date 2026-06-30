import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Search, Users, AlertCircle, ArrowLeft, Calendar } from 'lucide-react';
import { toast } from '../components/Toast';
import api from '../services/api';
import {
  StudentsTable,
  ViewDialog,
} from '../components/curator-homeworks';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import { Dialog, DialogContent } from '../components/ui/dialog';
import type {
  GroupData,
  AssignmentData,
  StudentProgress,
  StatusFilter,
  SubmissionDetails,
} from '../components/curator-homeworks';

interface GroupStat {
  group: GroupData;
  id: number;
  name: string;
  isOver: boolean;
  assignmentsCount: number;
  expected: number;
  submitted: number;
  notSubmitted: number;
  overdue: number;
  rate: number;
}

const formatDueDate = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const formatDueShort = (dateString: string | null): string => {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const CuratorHomeworksPage: React.FC = () => {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  // Overview controls
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [showCompletedGroups, setShowCompletedGroups] = useState(false);

  // Assignment-detail popup
  const [detailAssignment, setDetailAssignment] = useState<AssignmentData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Submission view dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<StudentProgress | null>(null);
  const [viewAssignment, setViewAssignment] = useState<AssignmentData | null>(null);
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);

  useEffect(() => {
    fetchHomeworks();
  }, []);

  const fetchHomeworks = async () => {
    try {
      setLoading(true);
      const response = await api.getCuratorHomeworkByGroup();
      const groupsData = response?.groups || [];
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error) {
      console.error('Error fetching homeworks:', error);
      toast('Не удалось загрузить домашние задания', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionDetails = async (assignmentId: number, submissionId: number) => {
    try {
      setLoadingSubmission(true);
      const details = await api.getSubmission(assignmentId.toString(), submissionId.toString());
      setSubmissionDetails(details);
    } catch (error) {
      console.error('Error fetching submission details:', error);
      toast('Не удалось загрузить детали работы', 'error');
      setSubmissionDetails(null);
    } finally {
      setLoadingSubmission(false);
    }
  };

  const handleViewStudent = (student: StudentProgress, assignment: AssignmentData) => {
    setViewStudent(student);
    setViewAssignment(assignment);
    setViewDialogOpen(true);
    setSubmissionDetails(null);
    if (student.submission_id) {
      fetchSubmissionDetails(assignment.id, student.submission_id);
    }
  };

  const handleCloseViewDialog = (open: boolean) => {
    setViewDialogOpen(open);
    if (!open) setSubmissionDetails(null);
  };

  const openGroup = (id: number) => {
    setSelectedGroupId(id);
    setDetailAssignment(null);
  };

  const openAssignment = (a: AssignmentData) => {
    setDetailAssignment(a);
    setSearchQuery('');
    setStatusFilter('all');
  };

  // Aggregate student-submission health per group (summary.submitted already includes graded)
  const groupStats = useMemo<GroupStat[]>(() => {
    return groups.map((g) => {
      let expected = 0, submitted = 0, notSubmitted = 0, overdue = 0;
      for (const a of g.assignments) {
        expected += a.summary.total_students;
        submitted += a.summary.submitted;
        notSubmitted += a.summary.not_submitted;
        overdue += a.summary.overdue;
      }
      return {
        group: g,
        id: g.group_id,
        name: g.group_name,
        isOver: !!g.is_over,
        assignmentsCount: g.assignments.length,
        expected, submitted, notSubmitted, overdue,
        rate: expected > 0 ? submitted / expected : 1,
      };
    });
  }, [groups]);

  const scopeGroups = useMemo(
    () => groupStats.filter((s) => showCompletedGroups || !s.isOver),
    [groupStats, showCompletedGroups],
  );

  const rollup = useMemo(
    () => scopeGroups.reduce((acc, g) => {
      acc.groups += 1;
      acc.assignments += g.assignmentsCount;
      acc.expected += g.expected;
      acc.submitted += g.submitted;
      acc.notSubmitted += g.notSubmitted;
      acc.overdue += g.overdue;
      return acc;
    }, { groups: 0, assignments: 0, expected: 0, submitted: 0, notSubmitted: 0, overdue: 0 }),
    [scopeGroups],
  );

  const overviewGroups = useMemo(() => {
    let rows = scopeGroups;
    if (needsAttentionOnly) rows = rows.filter((s) => s.overdue > 0 || s.notSubmitted > 0);
    const q = groupSearch.trim().toLowerCase();
    if (q) rows = rows.filter((s) => s.name.toLowerCase().includes(q));
    return [...rows].sort((a, b) => {
      if (a.isOver !== b.isOver) return a.isOver ? 1 : -1;
      const aHas = a.assignmentsCount > 0 ? 1 : 0;
      const bHas = b.assignmentsCount > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      if (b.overdue !== a.overdue) return b.overdue - a.overdue;
      if (b.notSubmitted !== a.notSubmitted) return b.notSubmitted - a.notSubmitted;
      return a.rate - b.rate;
    });
  }, [scopeGroups, needsAttentionOnly, groupSearch]);

  const selected = useMemo(
    () => groupStats.find((s) => s.id === selectedGroupId) || null,
    [groupStats, selectedGroupId],
  );

  const rollupRate = rollup.expected > 0
    ? Math.round((rollup.submitted / rollup.expected) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ── Detail view: one group, assignments as a table ──────────────────────────
  if (selected) {
    const pct = Math.round(selected.rate * 100);
    const sortedAssignments = [...selected.group.assignments].sort((a, b) => {
      const aAtt = a.summary.overdue + a.summary.not_submitted;
      const bAtt = b.summary.overdue + b.summary.not_submitted;
      return bAtt - aAtt;
    });

    return (
      <div className="container mx-auto p-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setSelectedGroupId(null)} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Все группы
        </Button>

        {/* Group health header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold truncate">{selected.name}</h1>
            {selected.isOver && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">
                Завершена
              </span>
            )}
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span><b className="text-base">{pct}%</b> <span className="text-muted-foreground">сдано</span></span>
            {selected.notSubmitted > 0 && (
              <span className="text-amber-600 dark:text-amber-400"><b className="text-base">{selected.notSubmitted}</b> не сдано</span>
            )}
            {selected.overdue > 0 && (
              <span className="text-red-600 dark:text-red-400"><b className="text-base">{selected.overdue}</b> просрочено</span>
            )}
          </div>
        </div>

        {/* Assignments table */}
        {sortedAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p>В этой группе нет заданий</p>
          </div>
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Задание</TableHead>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Срок</TableHead>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground w-[200px]">Сдано</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssignments.map((a) => {
                    const s = a.summary;
                    const pct = s.total_students > 0 ? Math.round((s.submitted / s.total_students) * 100) : 0;
                    return (
                      <TableRow
                        key={a.id}
                        onClick={() => openAssignment(a)}
                        className="cursor-pointer hover:bg-muted/50"
                      >
                        <TableCell className="py-2">
                          <div className="font-medium leading-tight">{a.title}</div>
                          <div className="text-xs text-muted-foreground leading-tight">{a.course_title}</div>
                        </TableCell>
                        <TableCell className="py-2 text-muted-foreground whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {formatDueShort(a.due_date)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="space-y-1 min-w-[150px]">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                {s.submitted}/{s.total_students}
                              </span>
                            </div>
                            <div className="text-[11px] tabular-nums">
                              {s.overdue > 0 && <span className="font-medium text-red-600 dark:text-red-400">{s.overdue} просрочено</span>}
                              {s.overdue > 0 && s.not_submitted > 0 && <span className="text-muted-foreground"> · </span>}
                              {s.not_submitted > 0 && <span className="text-amber-600 dark:text-amber-400">{s.not_submitted} не сдано</span>}
                              {s.overdue === 0 && s.not_submitted === 0 && <span className="text-green-600 dark:text-green-400">✓ всё сдано</span>}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Assignment-detail popup */}
        <Dialog open={detailAssignment !== null} onOpenChange={(open) => { if (!open) setDetailAssignment(null); }}>
          <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[88vh] flex flex-col">
            {detailAssignment && (
              <>
                <div className="px-6 pt-5 pb-4 border-b">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold truncate">{detailAssignment.title}</h2>
                      <p className="text-xs text-muted-foreground">
                        {detailAssignment.course_title} · Срок: {formatDueDate(detailAssignment.due_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
                    <span><b>{detailAssignment.summary.submitted}</b>/{detailAssignment.summary.total_students} <span className="text-muted-foreground">сдано</span></span>
                    {detailAssignment.summary.not_submitted > 0 && (
                      <span className="text-amber-600 dark:text-amber-400"><b>{detailAssignment.summary.not_submitted}</b> не сдано</span>
                    )}
                    {detailAssignment.summary.overdue > 0 && (
                      <span className="text-red-600 dark:text-red-400"><b>{detailAssignment.summary.overdue}</b> просрочено</span>
                    )}
                  </div>
                </div>

                <div className="px-6 py-3 border-b flex flex-wrap gap-3 items-center">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Поиск по имени студента..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-[170px] h-9">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все</SelectItem>
                      <SelectItem value="submitted">На проверке</SelectItem>
                      <SelectItem value="graded">Оценено</SelectItem>
                      <SelectItem value="not_submitted">Не сдано</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="overflow-y-auto px-2 py-1">
                  <StudentsTable
                    students={detailAssignment.students}
                    assignment={detailAssignment}
                    searchQuery={searchQuery}
                    statusFilter={statusFilter}
                    onViewStudent={(student) => handleViewStudent(student, detailAssignment)}
                  />
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <ViewDialog
          open={viewDialogOpen}
          onOpenChange={handleCloseViewDialog}
          student={viewStudent}
          assignment={viewAssignment}
          submissionDetails={submissionDetails}
          isLoading={loadingSubmission}
        />
      </div>
    );
  }

  // ── Overview: compact group cards sorted by attention ───────────────────────
  return (
    <div className="container mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-bold">Домашние задания</h1>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <FileText className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">Нет домашних заданий</p>
          <p className="text-sm">Задания ваших групп появятся здесь</p>
        </div>
      ) : (
        <>
          {/* Summary rollup */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded-lg border bg-card px-5 py-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums">{rollup.groups}</span>
              <span className="text-xs text-muted-foreground">групп</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums">{rollup.assignments}</span>
              <span className="text-xs text-muted-foreground">заданий</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{rollupRate}%</span>
              <span className="text-xs text-muted-foreground">сдано</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{rollup.notSubmitted}</span>
              <span className="text-xs text-muted-foreground">не сдано</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{rollup.overdue}</span>
              <span className="text-xs text-muted-foreground">просрочено</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск группы..."
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            <button
              type="button"
              onClick={() => setNeedsAttentionOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
                needsAttentionOnly
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  : 'border-border bg-card text-muted-foreground hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              Только отстающие
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="show-completed-groups"
                checked={showCompletedGroups}
                onCheckedChange={(checked) => setShowCompletedGroups(Boolean(checked))}
              />
              <Label htmlFor="show-completed-groups" className="text-sm text-muted-foreground cursor-pointer select-none">
                Показывать завершенные группы
              </Label>
            </div>
          </div>

          {/* Group cards */}
          {overviewGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p>{needsAttentionOnly ? 'Все группы в порядке' : 'Ничего не найдено'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {overviewGroups.map((g) => {
                const pct = Math.round(g.rate * 100);
                const barColor = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-red-500';
                const empty = g.assignmentsCount === 0;
                return (
                  <button
                    key={g.id}
                    onClick={() => openGroup(g.id)}
                    className="bg-card rounded-lg border p-4 text-left hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <h3 className="font-bold truncate">{g.name}</h3>
                      {g.isOver && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">
                          Завершена
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2.5">{g.assignmentsCount} заданий</div>
                    {empty ? (
                      <div className="text-xs text-muted-foreground italic">Нет заданий</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">{pct}%</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-2.5 tabular-nums">
                          {g.submitted}/{g.expected} сдано
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {g.overdue > 0 && (
                            <span className="font-semibold text-red-600 dark:text-red-400">{g.overdue} просрочено</span>
                          )}
                          {g.notSubmitted > 0 && (
                            <span className="font-medium text-amber-600 dark:text-amber-400">{g.notSubmitted} не сдано</span>
                          )}
                          {g.overdue === 0 && g.notSubmitted === 0 && (
                            <span className="font-medium text-green-600 dark:text-green-400">✓ всё сдано</span>
                          )}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CuratorHomeworksPage;

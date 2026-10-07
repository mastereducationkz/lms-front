import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Users, AlertCircle, ArrowLeft, Calendar, ArrowUp, ArrowDown, Check } from 'lucide-react';
import { toast } from '../components/Toast';
import api from '../services/api';
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
import type { GroupData } from '../components/curator-homeworks';
import { formatDateTime } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/curatorHomeworks';

interface GroupStat {
  group: GroupData;
  id: number;
  name: string;
  isOver: boolean;
  teacherId: number | null;
  teacherName: string | null;
  assignmentsCount: number;
  expected: number;
  submitted: number;
  notSubmitted: number;
  overdue: number;
  rate: number;
}

const formatDueShort = (dateString: string | null): string => {
  if (!dateString) return '—';
  return formatDateTime(dateString, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const CuratorHomeworksPage: React.FC = () => {
  const navigate = useNavigate();
  const t = useT();
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigate to an assignment, but honour Ctrl/Cmd/middle-click by opening a new
  // tab (table rows can't be real <a> tags, so we replicate the native behaviour).
  const openAssignment = (e: React.MouseEvent, id: number) => {
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      e.preventDefault();
      window.open(`/homework/${id}`, '_blank', 'noopener');
      return;
    }
    navigate(`/homework/${id}`);
  };

  // Overview controls
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<number | 'all'>('all');
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [showCompletedGroups, setShowCompletedGroups] = useState(false);
  // Sort the assignments table by deadline; toggled via the "Срок" column header.
  const [deadlineDir, setDeadlineDir] = useState<'asc' | 'desc'>('asc');

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
      toast(t('curatorHomeworks.loadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const openGroup = (id: number) => {
    setSelectedGroupId(id);
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
        teacherId: g.teacher_id ?? null,
        teacherName: g.teacher_name ?? null,
        assignmentsCount: g.assignments.length,
        expected, submitted, notSubmitted, overdue,
        rate: expected > 0 ? submitted / expected : 1,
      };
    });
  }, [groups]);

  // Distinct teachers across the loaded groups (for the teacher filter)
  const teacherOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const g of groups) {
      if (g.teacher_id != null && !byId.has(g.teacher_id)) {
        byId.set(g.teacher_id, g.teacher_name || t('curatorHomeworks.teacherFallback', { id: g.teacher_id }));
      }
    }
    return Array.from(byId, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [groups, t]);

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
    if (selectedTeacherId !== 'all') rows = rows.filter((s) => s.teacherId === selectedTeacherId);
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
  }, [scopeGroups, selectedTeacherId, needsAttentionOnly, groupSearch]);

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
      // Assignments with no deadline sink to the bottom regardless of direction.
      const at = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bt = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (at !== bt) return deadlineDir === 'asc' ? at - bt : bt - at;
      // Tie-break by attention so equal-deadline rows stay meaningfully ordered.
      return (b.summary.overdue + b.summary.not_submitted) - (a.summary.overdue + a.summary.not_submitted);
    });

    return (
      <div className="container mx-auto space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setSelectedGroupId(null)} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          {t('curatorHomeworks.allGroups')}
        </Button>

        {/* Group health header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-5 h-5 text-primary shrink-0" />
            <h1 className="text-xl font-bold truncate">{selected.name}</h1>
            {selected.teacherName && (
              <span className="text-sm text-muted-foreground truncate">· {selected.teacherName}</span>
            )}
            {selected.isOver && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">
                {t('curatorHomeworks.group.finished')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span><b className="text-base">{pct}%</b> <span className="text-muted-foreground">{t('curatorHomeworks.stats.submitted')}</span></span>
            {selected.notSubmitted > 0 && (
              <span className="text-amber-600 dark:text-amber-400"><b className="text-base">{selected.notSubmitted}</b> {t('curatorHomeworks.stats.notSubmitted')}</span>
            )}
            {selected.overdue > 0 && (
              <span className="text-red-600 dark:text-red-400"><b className="text-base">{selected.overdue}</b> {t('curatorHomeworks.stats.overdue')}</span>
            )}
          </div>
        </div>

        {/* Assignments table */}
        {sortedAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p>{t('curatorHomeworks.group.noAssignments')}</p>
          </div>
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">{t('curatorHomeworks.table.assignment')}</TableHead>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => setDeadlineDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
                        title={t('curatorHomeworks.table.sortByDue')}
                      >
                        {t('curatorHomeworks.table.due')}
                        {deadlineDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      </button>
                    </TableHead>
                    <TableHead className="h-9 py-2 text-[10px] uppercase tracking-wider text-muted-foreground w-[200px]">{t('curatorHomeworks.table.submitted')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAssignments.map((a) => {
                    const s = a.summary;
                    const rowPct = s.total_students > 0 ? Math.round((s.submitted / s.total_students) * 100) : 0;
                    return (
                      <TableRow
                        key={a.id}
                        onClick={(e) => openAssignment(e, a.id)}
                        onAuxClick={(e) => { if (e.button === 1) openAssignment(e, a.id); }}
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
                              <div className="flex-1 bg-gray-200 dark:bg-muted rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-brand-solid" style={{ width: `${rowPct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                {s.submitted}/{s.total_students}
                              </span>
                            </div>
                            <div className="text-[11px] tabular-nums">
                              {s.overdue > 0 && <span className="font-medium text-red-600 dark:text-red-400">{t('curatorHomeworks.count.overdue', { count: s.overdue })}</span>}
                              {s.overdue > 0 && s.not_submitted > 0 && <span className="text-muted-foreground"> · </span>}
                              {s.not_submitted > 0 && <span className="text-amber-600 dark:text-amber-400">{t('curatorHomeworks.count.notSubmitted', { count: s.not_submitted })}</span>}
                              {s.overdue === 0 && s.not_submitted === 0 && <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><Check className="h-3.5 w-3.5" aria-hidden="true" />{t('curatorHomeworks.count.allSubmitted')}</span>}
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
      </div>
    );
  }

  // ── Overview: compact group cards sorted by attention ───────────────────────
  return (
    <div className="container mx-auto space-y-5">
      <h1 className="text-2xl font-bold">{t('curatorHomeworks.title')}</h1>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <FileText className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">{t('curatorHomeworks.empty.title')}</p>
          <p className="text-sm">{t('curatorHomeworks.empty.hint')}</p>
        </div>
      ) : (
        <>
          {/* Summary rollup */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 rounded-lg border bg-card px-5 py-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums">{rollup.groups}</span>
              <span className="text-xs text-muted-foreground">{t('curatorHomeworks.stats.groups', { count: rollup.groups })}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold tabular-nums">{rollup.assignments}</span>
              <span className="text-xs text-muted-foreground">{t('curatorHomeworks.stats.assignments', { count: rollup.assignments })}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-brand tabular-nums">{rollupRate}%</span>
              <span className="text-xs text-muted-foreground">{t('curatorHomeworks.stats.submitted')}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{rollup.notSubmitted}</span>
              <span className="text-xs text-muted-foreground">{t('curatorHomeworks.stats.notSubmitted')}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-red-600 dark:text-red-400 tabular-nums">{rollup.overdue}</span>
              <span className="text-xs text-muted-foreground">{t('curatorHomeworks.stats.overdue')}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('curatorHomeworks.filter.searchGroups')}
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                className="pl-9 bg-card"
              />
            </div>
            {teacherOptions.length > 0 && (
              <Select
                value={selectedTeacherId === 'all' ? 'all' : String(selectedTeacherId)}
                onValueChange={(v) => setSelectedTeacherId(v === 'all' ? 'all' : Number(v))}
              >
                <SelectTrigger className="w-[220px] h-9 bg-card">
                  <SelectValue placeholder={t('curatorHomeworks.filter.teacher')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('curatorHomeworks.filter.allTeachers')}</SelectItem>
                  {teacherOptions.map((opt) => (
                    <SelectItem key={opt.id} value={String(opt.id)}>{opt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <button
              type="button"
              onClick={() => setNeedsAttentionOnly((v) => !v)}
              data-tip="lagging-filter"
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors ${
                needsAttentionOnly
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  : 'border-border bg-card text-muted-foreground hover:border-border'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              {t('curatorHomeworks.filter.needsAttention')}
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="show-completed-groups"
                checked={showCompletedGroups}
                onCheckedChange={(checked) => setShowCompletedGroups(Boolean(checked))}
              />
              <Label htmlFor="show-completed-groups" className="text-sm text-muted-foreground cursor-pointer select-none">
                {t('curatorHomeworks.filter.showFinished')}
              </Label>
            </div>
          </div>

          {/* Group cards */}
          {overviewGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FileText className="w-12 h-12 mb-3 opacity-50" />
              <p>{needsAttentionOnly ? t('curatorHomeworks.filter.allOnTrack') : t('curatorHomeworks.filter.nothingFound')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 @6xl:grid-cols-4 gap-4">
              {overviewGroups.map((g) => {
                const pct = Math.round(g.rate * 100);
                const barColor = pct >= 90 ? 'bg-green-500' : pct >= 60 ? 'bg-brand-solid' : 'bg-red-500';
                const empty = g.assignmentsCount === 0;
                return (
                  <button
                    key={g.id}
                    onClick={() => openGroup(g.id)}
                    className="bg-card rounded-lg border p-4 text-left hover:border-brand hover:shadow-md transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <h3 className="font-bold truncate">{g.name}</h3>
                      {g.isOver && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border text-muted-foreground shrink-0">
                          {t('curatorHomeworks.group.finished')}
                        </span>
                      )}
                    </div>
                    {g.teacherName && (
                      <div className="text-xs text-muted-foreground mb-1 truncate">{g.teacherName}</div>
                    )}
                    <div className="text-xs text-muted-foreground mb-2.5">{t('curatorHomeworks.group.assignments', { count: g.assignmentsCount })}</div>
                    {empty ? (
                      <div className="text-xs text-muted-foreground italic">{t('curatorHomeworks.group.empty')}</div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 bg-gray-200 dark:bg-muted rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap">{pct}%</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mb-2.5 tabular-nums">
                          {t('curatorHomeworks.count.submittedOf', { submitted: g.submitted, expected: g.expected })}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                          {g.overdue > 0 && (
                            <span className="font-semibold text-red-600 dark:text-red-400">{t('curatorHomeworks.count.overdue', { count: g.overdue })}</span>
                          )}
                          {g.notSubmitted > 0 && (
                            <span className="font-medium text-amber-600 dark:text-amber-400">{t('curatorHomeworks.count.notSubmitted', { count: g.notSubmitted })}</span>
                          )}
                          {g.overdue === 0 && g.notSubmitted === 0 && (
                            <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400"><Check className="h-3.5 w-3.5" aria-hidden="true" />{t('curatorHomeworks.count.allSubmitted')}</span>
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

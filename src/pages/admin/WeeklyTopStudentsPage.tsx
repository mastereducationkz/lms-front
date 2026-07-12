import { useEffect, useMemo, useState } from 'react';
import { Trophy, ChevronLeft, ChevronRight, Download, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import { getWeeklyTopStudents, exportWeeklyTopStudents, getGroups } from '../../services/api';

const PROGRAMS = [
  { value: 'all', label: 'All programs' },
  { value: 'sat', label: 'SAT' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'general_english', label: 'General English' },
  { value: 'nuet', label: 'NUET' },
];

const PRESETS = [10, 25, 50, 100];

// --- week helpers (Monday-start) ---------------------------------------- //
function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7; // 0 = Monday
  copy.setDate(copy.getDate() - day);
  return copy;
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function fmtRange(mondayISO: string): string {
  const [y, m, d] = mondayISO.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
}

const num = (v: number | null | undefined, dp = 0) =>
  v === null || v === undefined ? '—' : v.toFixed(dp);

function scoreColor(score: number): string {
  if (score >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
  if (score >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300';
}

export default function WeeklyTopStudentsPage() {
  const [weekStart, setWeekStart] = useState<string>(() => toISO(mondayOf(new Date())));
  const [programType, setProgramType] = useState<string>('all');
  const [groupId, setGroupId] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);
  const [limitInput, setLimitInput] = useState<string>('100');

  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);
  const [showAttention, setShowAttention] = useState<boolean>(false);

  const currentMondayISO = useMemo(() => toISO(mondayOf(new Date())), []);
  const isCurrentWeek = weekStart === currentMondayISO;

  // Load groups (optionally scoped by the selected program).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getGroups(programType !== 'all' ? { program_type: programType as any } : undefined);
        const list = Array.isArray(res) ? res : (res as any)?.groups ?? [];
        if (!cancelled) {
          setGroups(list.map((g: any) => ({ id: g.id, name: g.name })));
        }
      } catch {
        if (!cancelled) setGroups([]);
      }
    })();
    return () => { cancelled = true; };
  }, [programType]);

  // Reset the group filter if it no longer belongs to the selected program.
  useEffect(() => {
    if (groupId !== 'all' && !groups.some((g) => String(g.id) === groupId)) {
      setGroupId('all');
    }
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  const queryParams = useMemo(() => ({
    week_start: weekStart,
    ...(programType !== 'all' ? { program_type: programType } : {}),
    ...(groupId !== 'all' ? { group_id: Number(groupId) } : {}),
    limit,
  }), [weekStart, programType, groupId, limit]);

  // Fetch leaderboard (debounced so typing in the Top-N field doesn't spam).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const res = await getWeeklyTopStudents(queryParams);
        if (!cancelled) setData(res);
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Failed to load weekly top students.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [queryParams]);

  const commitLimit = () => {
    const parsed = parseInt(limitInput, 10);
    const clamped = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 1000) : 100;
    setLimit(clamped);
    setLimitInput(String(clamped));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportWeeklyTopStudents(queryParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `weekly-top-students_${weekStart}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export the report.');
    } finally {
      setExporting(false);
    }
  };

  const students = data?.students ?? [];
  const needsAttention = data?.needs_attention ?? [];

  return (
    <div className="max-w-[100rem] mx-auto px-6 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-6 w-6 text-amber-500" />
            Weekly Top Students
          </h1>
          <p className="text-sm text-muted-foreground">
            Composite activity ranking — homework, course progress, study time, and points combined.
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || loading} variant="outline">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export Excel
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-4">
          {/* Week navigation */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Week</Label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setWeekStart(toISO(addDays(new Date(weekStart), -7)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[150px] text-center text-sm font-medium tabular-nums px-2">
                {fmtRange(weekStart)}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setWeekStart(toISO(addDays(new Date(weekStart), 7)))}
                disabled={isCurrentWeek}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isCurrentWeek && (
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(currentMondayISO)}>
                  This week
                </Button>
              )}
            </div>
          </div>

          {/* Top-N */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Top-N</Label>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                max={1000}
                value={limitInput}
                onChange={(e) => setLimitInput(e.target.value)}
                onBlur={commitLimit}
                onKeyDown={(e) => e.key === 'Enter' && commitLimit()}
                className="w-24"
              />
              {PRESETS.map((p) => (
                <Button
                  key={p}
                  variant={limit === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setLimit(p); setLimitInput(String(p)); }}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          {/* Program */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Program</Label>
            <Select value={programType} onValueChange={setProgramType}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROGRAMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Group */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="w-[220px]"><SelectValue placeholder="All groups" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All groups</SelectItem>
                {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-sm text-muted-foreground self-center">
            {loading ? 'Loading…' : `${data?.total_students ?? 0} students · showing top ${students.length}`}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-md px-4 py-3">{error}</div>
      )}

      {/* Leaderboard */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Group</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Curator</TableHead>
                  <TableHead className="text-center">Prog</TableHead>
                  <TableHead className="text-center" title="on-time / submitted / due">HW</TableHead>
                  <TableHead className="text-center">Avg %</TableHead>
                  <TableHead className="text-center">Steps/wk</TableHead>
                  <TableHead className="text-center">% course/wk</TableHead>
                  <TableHead className="text-center">Study min</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Streak</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && students.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-12 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : students.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center py-12 text-muted-foreground">No students for this selection.</TableCell></TableRow>
                ) : students.map((s: any) => {
                  const hw = s.homework;
                  const sub = s.subscores;
                  const scoreTitle =
                    `Subscores — Homework: ${num(sub.homework, 1)}, Course: ${num(sub.course, 1)}, ` +
                    `Study: ${num(sub.study, 1)}, Engagement: ${num(sub.engagement, 1)}`;
                  return (
                    <TableRow key={s.student_id}>
                      <TableCell className="text-center font-medium tabular-nums">{s.rank}</TableCell>
                      <TableCell className="font-medium">{s.student_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.group_name ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{s.teacher_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.curator_name}</TableCell>
                      <TableCell className="text-center uppercase text-xs text-muted-foreground">{s.program_type ?? '—'}</TableCell>
                      <TableCell className="text-center tabular-nums" title="on-time / submitted / due">
                        {hw.due > 0 ? `${hw.on_time}/${hw.submitted}/${hw.due}` : '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">{num(hw.avg_pct, 0)}{hw.avg_pct != null ? '%' : ''}</TableCell>
                      <TableCell className="text-center tabular-nums">{s.steps_week}</TableCell>
                      <TableCell className="text-center tabular-nums" title={s.top_course_name ?? ''}>{num(s.course_pct_week, 1)}%</TableCell>
                      <TableCell className="text-center tabular-nums">{s.study_minutes_week}</TableCell>
                      <TableCell className="text-center tabular-nums">{s.points_week}</TableCell>
                      <TableCell className="text-center tabular-nums">{s.daily_streak}</TableCell>
                      <TableCell className="text-center">
                        <span
                          title={scoreTitle}
                          className={`inline-block min-w-[3rem] rounded-md px-2 py-1 text-sm font-semibold tabular-nums ${scoreColor(s.activity_score)}`}
                        >
                          {s.activity_score.toFixed(1)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Needs attention */}
      {needsAttention.length > 0 && (
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowAttention((v) => !v)}>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              Needs Attention — {needsAttention.length} students with missing / late homework
              <span className="ml-auto text-sm font-normal text-muted-foreground">{showAttention ? 'Hide' : 'Show'}</span>
            </CardTitle>
          </CardHeader>
          {showAttention && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Group</TableHead>
                      <TableHead>Teacher</TableHead>
                      <TableHead>Curator</TableHead>
                      <TableHead className="text-center">Due</TableHead>
                      <TableHead className="text-center">Submitted</TableHead>
                      <TableHead className="text-center">On-time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {needsAttention.map((n: any) => (
                      <TableRow key={n.student_id}>
                        <TableCell className="font-medium">{n.student_name}</TableCell>
                        <TableCell className="text-muted-foreground">{n.group_name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{n.teacher_name}</TableCell>
                        <TableCell className="text-muted-foreground">{n.curator_name}</TableCell>
                        <TableCell className="text-center tabular-nums">{n.due}</TableCell>
                        <TableCell className="text-center tabular-nums">{n.submitted}</TableCell>
                        <TableCell className="text-center tabular-nums">{n.on_time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}

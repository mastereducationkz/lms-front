import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Download, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  exportBluebookGrid,
  getBluebookGrid,
  getBluebookGroups,
  type BluebookGrid,
  type BluebookGroupOption,
} from '../services/api/exams';

/**
 * Staff view: students as rows, Bluebook tests 4-11 as columns, each split into
 * Verbal | Math | Score.
 *
 * Every test 4-11 is always rendered, whether assigned or not, so coverage gaps are
 * visible. Each cell says which of three things it is - a score, "not submitted"
 * (assigned, student didn't do it) or "not assigned" (no homework exists) - because
 * a blank cell cannot tell those apart.
 *
 * Stacking: the app Topbar is `sticky top-0 z-10`, so every sticky cell here stays
 * BELOW z-10. Sticky cells only need to out-rank sibling cells, not the app chrome;
 * using z-30/z-40 made the table scroll over the page header.
 */

const Z_STICKY_CELL = 'z-[2]';
const Z_STICKY_CORNER = 'z-[3]';

const trendMeta = (trend: string | null | undefined) => {
  switch (trend) {
    case 'up':
      return { Icon: ArrowUp, cls: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'improved' };
    case 'down':
      return { Icon: ArrowDown, cls: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'declined' };
    case 'same':
      return { Icon: ArrowRight, cls: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'unchanged' };
    default:
      return { Icon: null, cls: '', label: '' };
  }
};

const formatDayMonth = (iso: string | null) => {
  if (!iso) return null;
  const [, m, d] = iso.split('-');
  return m && d ? `${d}.${m}` : null;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function BluebookGroupGridPage() {
  const [groups, setGroups] = useState<BluebookGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [grid, setGrid] = useState<BluebookGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const firstLoad = useRef(true);

  // Search runs server-side (it matches teacher names too, which the client cannot do
  // from the option list alone) and is debounced so typing does not spam the API.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const rows = await getBluebookGroups(search.trim() || undefined);
        if (cancelled) return;
        setGroups(rows);
        // Only auto-select on the very first load; re-selecting on every search would
        // yank the grid out from under someone who is still typing.
        if (firstLoad.current && rows.length > 0) {
          setGroupId(rows[0].id);
          firstLoad.current = false;
        }
      } catch {
        if (!cancelled) setError('Could not load your groups.');
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    }, firstLoad.current ? 0 : 300);

    return () => { cancelled = true; clearTimeout(handle); };
  }, [search]);

  const load = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      setGrid(await getBluebookGrid(id));
    } catch (e: any) {
      setGrid(null);
      setError(
        e?.response?.status === 403
          ? 'You do not have access to this group.'
          : 'Could not load the Bluebook results for this group.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (groupId != null) load(groupId);
  }, [groupId, load]);

  const handleExport = async () => {
    if (groupId == null) return;
    setExporting(true);
    try {
      const blob = await exportBluebookGrid(groupId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bluebook_${grid?.group_name ?? 'group'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const stats = grid?.group_stats;
  const headerLine = useMemo(() => {
    if (!grid) return null;
    const bits = [grid.group_name];
    if (grid.teacher_name) bits.push(grid.teacher_name);
    if (grid.start_date) bits.push(`Start: ${grid.start_date}`);
    return bits.join('  ·  ');
  }, [grid]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Bluebook results</h1>
          {headerLine && <p className="text-sm text-muted-foreground mt-0.5">{headerLine}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search group or teacher…"
              aria-label="Search groups by name or teacher"
              className="pl-8 w-56"
            />
          </div>

          <label htmlFor="bb-group" className="sr-only">Group</label>
          <select
            id="bb-group"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm max-w-[22rem]"
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            disabled={groupsLoading || groups.length === 0}
          >
            {groups.length === 0 && <option value="">No matching groups</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.teacher_name ? `${g.name} — ${g.teacher_name}` : g.name}
              </option>
            ))}
          </select>

          <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting || !grid}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>

      {!groupsLoading && groups.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {search.trim()
            ? `No SAT groups match “${search.trim()}”.`
            : 'You have no SAT groups.'}
        </CardContent></Card>
      )}

      {loading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      )}

      {!loading && error && (
        <Card><CardContent className="p-8 text-center text-red-600 dark:text-red-400" role="alert">
          {error}
        </CardContent></Card>
      )}

      {/* ---- group statistics ---- */}
      {!loading && !error && grid && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Stat label="Students" value={String(stats.student_count)}
                hint={stats.students_with_no_results ? `${stats.students_with_no_results} with no results` : 'all have results'} />
          <Stat label="Tests assigned" value={`${stats.tests_assigned} / ${stats.tests_available}`} />
          <Stat label="Completion" value={pct(stats.completion_rate)}
                hint={`${stats.submitted_count} of ${stats.expected_count}`} />
          <Stat label="Avg latest" value={stats.average_latest_total?.toString() ?? '–'}
                hint={stats.median_latest_total != null ? `median ${stats.median_latest_total}` : undefined} />
          <Stat label="Best in group" value={stats.highest_total?.toString() ?? '–'}
                hint={stats.lowest_latest_total != null ? `lowest ${stats.lowest_latest_total}` : undefined} />
          <Stat label="Avg improvement"
                value={stats.average_improvement != null
                  ? `${stats.average_improvement > 0 ? '+' : ''}${stats.average_improvement}` : '–'}
                hint={`${stats.improved_count} up · ${stats.declined_count} down`} />
        </div>
      )}

      {!loading && !error && grid && grid.rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No students in this group yet.
        </CardContent></Card>
      )}

      {!loading && !error && grid && grid.rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="border-collapse w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      rowSpan={2} scope="col"
                      className={`w-44 md:w-64 sticky left-0 ${Z_STICKY_CORNER} bg-background border-r align-bottom`}
                    >
                      Student
                    </TableHead>
                    {grid.columns.map((c) => (
                      <TableHead
                        key={c.key} colSpan={3} scope="colgroup"
                        className={`p-1 text-center border-r min-w-[150px] align-top ${
                          c.is_assigned ? '' : 'bg-muted/40'
                        }`}
                      >
                        <div className="font-semibold">
                          {c.is_baseline ? 'Baseline #5' : `Bluebook #${c.test_number}`}
                        </div>
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {c.is_baseline
                            ? `${formatDayMonth(c.due_date) ?? '—'} · Assignment Zero`
                            : c.is_assigned
                              ? `${c.week_number ? `Week ${c.week_number} · ` : ''}${formatDayMonth(c.due_date) ?? 'no due date'}`
                              : 'not assigned'}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead colSpan={4} scope="colgroup"
                               className="p-1 text-center border-l min-w-[220px] align-top bg-muted/30">
                      <div className="font-semibold">Student summary</div>
                    </TableHead>
                    <TableHead colSpan={2} scope="colgroup"
                               className="p-1 text-center border-l min-w-[120px] align-top bg-muted/30">
                      <div className="font-semibold">Official result</div>
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {grid.columns.map((c) => (
                      <Fragment key={c.key}>
                        <TableHead scope="col" className="text-center font-normal">Verbal</TableHead>
                        <TableHead scope="col" className="text-center font-normal">Math</TableHead>
                        <TableHead scope="col" className="text-center font-normal border-r">Score</TableHead>
                      </Fragment>
                    ))}
                    <TableHead scope="col" className="text-center font-normal border-l">Done</TableHead>
                    <TableHead scope="col" className="text-center font-normal">Best</TableHead>
                    <TableHead scope="col" className="text-center font-normal">Latest</TableHead>
                    <TableHead scope="col" className="text-center font-normal">vs base</TableHead>
                    <TableHead scope="col" className="text-center font-normal border-l">Score</TableHead>
                    <TableHead scope="col" className="text-center font-normal">Date</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {grid.rows.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell className={`p-2 sticky left-0 ${Z_STICKY_CELL} bg-background border-r`}>
                        <div className="font-medium truncate">{row.full_name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {row.display_id || row.email}
                        </div>
                      </TableCell>

                      {grid.columns.map((c) => {
                        const cell = row.cells[c.key];
                        if (!cell || cell.state !== 'submitted') {
                          const notAssigned = !cell || cell.state === 'not_assigned';
                          return (
                            <TableCell
                              key={c.key} colSpan={3}
                              className={`text-center border-r italic text-[11px] ${
                                notAssigned
                                  ? 'text-muted-foreground/60 bg-muted/30'
                                  : 'text-amber-700 dark:text-amber-500'
                              }`}
                            >
                              {notAssigned ? 'Not assigned' : 'Not submitted'}
                            </TableCell>
                          );
                        }
                        const { Icon, cls, label } = trendMeta(cell.trend);
                        return (
                          <Fragment key={c.key}>
                            <TableCell className="text-center">{cell.verbal_score}</TableCell>
                            <TableCell className="text-center">{cell.math_score}</TableCell>
                            <TableCell className={`text-center border-r font-semibold ${cls}`}>
                              <span className="inline-flex items-center gap-0.5">
                                {cell.total_score}
                                {/* Arrow as well as colour, so the trend survives
                                    greyscale printing and colour-blind viewing. */}
                                {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                                {label && (
                                  <span className="sr-only">
                                    {` ${label}${cell.delta != null ? ` by ${Math.abs(cell.delta)}` : ''}`}
                                  </span>
                                )}
                              </span>
                            </TableCell>
                          </Fragment>
                        );
                      })}

                      <TableCell className="text-center border-l">
                        {row.assigned_count > 0 ? `${row.submitted_count}/${row.assigned_count}` : '–'}
                      </TableCell>
                      <TableCell className="text-center font-medium">{row.best_total ?? '–'}</TableCell>
                      <TableCell className="text-center font-medium">{row.latest_total ?? '–'}</TableCell>
                      <TableCell className="text-center">
                        {row.improvement_from_baseline == null ? '–' : (
                          <span className={
                            row.improvement_from_baseline > 0
                              ? 'text-green-700 dark:text-green-400'
                              : row.improvement_from_baseline < 0
                                ? 'text-red-700 dark:text-red-400'
                                : ''
                          }>
                            {row.improvement_from_baseline > 0 ? '+' : ''}{row.improvement_from_baseline}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-semibold border-l">
                        {row.official_result ? Number(row.official_result.total_score) : '–'}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {row.official_result?.test_date ?? '–'}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Column aggregates. Unassigned tests are excluded from completion:
                      nobody was asked to sit them. */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className={`p-2 sticky left-0 ${Z_STICKY_CELL} bg-muted border-r`}>
                      Average
                    </TableCell>
                    {grid.columns.map((c) => {
                      const s = grid.column_stats[c.key];
                      return (
                        <Fragment key={c.key}>
                          <TableCell className="text-center">{s?.mean_verbal ?? '–'}</TableCell>
                          <TableCell className="text-center">{s?.mean_math ?? '–'}</TableCell>
                          <TableCell className="text-center border-r">{s?.mean_total ?? '–'}</TableCell>
                        </Fragment>
                      );
                    })}
                    <TableCell colSpan={4} className="border-l" />
                    <TableCell colSpan={2} className="border-l" />
                  </TableRow>

                  <TableRow className="bg-muted/30 text-muted-foreground">
                    <TableCell className={`p-2 sticky left-0 ${Z_STICKY_CELL} bg-muted border-r`}>
                      Submitted
                    </TableCell>
                    {grid.columns.map((c) => {
                      const s = grid.column_stats[c.key];
                      return (
                        <TableCell key={c.key} colSpan={3} className="text-center border-r">
                          {!c.is_assigned && !c.is_baseline
                            ? '—'
                            : c.is_baseline
                              ? `${s?.submitted_count ?? 0}`
                              : `${s?.submitted_count ?? 0} / ${s?.expected_count ?? 0}`}
                        </TableCell>
                      );
                    })}
                    <TableCell colSpan={4} className="border-l" />
                    <TableCell colSpan={2} className="border-l" />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

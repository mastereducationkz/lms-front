import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import apiClient from '../services/api';
import { exportBluebookGrid, getBluebookGrid, type BluebookGrid } from '../services/api/exams';
import { formatGroupLabel, getGroupProgramType } from '../lib/groupPicker';
import type { Group } from '../types';

/**
 * Staff view: students as rows, chronological Bluebook results as columns, each column
 * split into Verbal | Math | Score.
 *
 * Layout follows CuratorLeaderboardPage's proven recipe for wide tables - sticky
 * identity column, sticky trailing column, and grouped headers built from nested divs
 * rather than colSpan (colSpan cannot be made sticky).
 *
 * Row scope is enforced server-side: the grid endpoint 403s for a group outside the
 * caller's scope, so this page cannot be used to reach another teacher's group by
 * editing the URL.
 */

const trendMeta = (trend: string | null | undefined) => {
  switch (trend) {
    case 'up':
      return {
        Icon: ArrowUp,
        cell: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        label: 'improved',
      };
    case 'down':
      return {
        Icon: ArrowDown,
        cell: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        label: 'declined',
      };
    case 'same':
      return {
        Icon: ArrowRight,
        cell: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
        label: 'unchanged',
      };
    default:
      return { Icon: null, cell: '', label: '' };
  }
};

const formatDayMonth = (iso: string | null) => {
  if (!iso) return null;
  const [, m, d] = iso.split('-');
  return m && d ? `${d}.${m}` : null;
};

export default function BluebookGroupGridPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [grid, setGrid] = useState<BluebookGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await apiClient.getMyGroups();
        // Bluebook is a SAT-family artefact; NUET shares the Math/Verbal structure.
        const relevant = all.filter((g: Group) => {
          const p = getGroupProgramType(g);
          return p === 'sat' || p === 'nuet';
        });
        if (cancelled) return;
        setGroups(relevant);
        if (relevant.length > 0) setGroupId(relevant[0].id);
        else setLoading(false);
      } catch {
        if (!cancelled) {
          setError('Could not load your groups.');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const header = useMemo(() => {
    if (!grid) return null;
    const bits = [grid.group_name];
    if (grid.teacher_name) bits.push(grid.teacher_name);
    if (grid.start_date) bits.push(`Start: ${grid.start_date}`);
    return bits.join('  |  ');
  }, [grid]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Bluebook results</h1>
        <div className="flex items-center gap-2">
          <label htmlFor="bb-group" className="sr-only">Group</label>
          <select
            id="bb-group"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{formatGroupLabel(g)}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExport}
            disabled={exporting || !grid}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {exporting ? 'Exporting…' : 'Export'}
          </Button>
        </div>
      </div>

      {loading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading…</CardContent></Card>
      )}

      {!loading && error && (
        <Card><CardContent className="p-8 text-center text-red-600 dark:text-red-400" role="alert">{error}</CardContent></Card>
      )}

      {!loading && !error && groups.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          You have no SAT or NUET groups.
        </CardContent></Card>
      )}

      {!loading && !error && grid && grid.rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No students in this group yet.
        </CardContent></Card>
      )}

      {!loading && !error && grid && grid.rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">{header}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border-t overflow-x-auto">
              <Table className="border-collapse w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className="w-40 md:w-56 sticky left-0 z-40 bg-background border-r align-bottom"
                      scope="col"
                    >
                      Student
                    </TableHead>
                    {grid.columns.map((c) => (
                      <TableHead
                        key={c.key}
                        colSpan={3}
                        scope="colgroup"
                        className="p-1 text-center border-r min-w-[150px] align-top"
                      >
                        <div className="font-semibold">
                          {c.week_number ? `Week ${c.week_number}` : c.label}
                          {c.test_number ? ` · #${c.test_number}` : ''}
                        </div>
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {formatDayMonth(c.due_date) ?? '—'}
                          {c.is_baseline ? ' · baseline' : ''}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead
                      colSpan={2}
                      scope="colgroup"
                      className="p-1 text-center min-w-[120px] md:sticky md:right-0 z-40 bg-background border-l align-top"
                    >
                      <div className="font-semibold">Official result</div>
                    </TableHead>
                  </TableRow>
                  <TableRow>
                    {grid.columns.map((c) => (
                      // Key belongs on the Fragment, not its children: a bare <> inside
                      // .map() has no key and React warns on every render.
                      <Fragment key={c.key}>
                        <TableHead scope="col" className="text-center font-normal">Verbal</TableHead>
                        <TableHead scope="col" className="text-center font-normal">Math</TableHead>
                        <TableHead scope="col" className="text-center font-normal border-r">Score</TableHead>
                      </Fragment>
                    ))}
                    <TableHead scope="col" className="text-center font-normal md:sticky md:right-[60px] z-40 bg-background border-l">Score</TableHead>
                    <TableHead scope="col" className="text-center font-normal md:sticky md:right-0 z-40 bg-background">Date</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {grid.rows.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell className="p-2 sticky left-0 z-30 bg-background border-r font-medium">
                        <div className="truncate">{row.full_name}</div>
                        {row.display_id && (
                          <div className="text-[10px] text-muted-foreground">{row.display_id}</div>
                        )}
                      </TableCell>

                      {grid.columns.map((c) => {
                        const cell = row.cells[c.key];
                        if (!cell) {
                          return (
                            <Fragment key={c.key}>
                              <TableCell className="text-center text-muted-foreground">–</TableCell>
                              <TableCell className="text-center text-muted-foreground">–</TableCell>
                              <TableCell className="text-center text-muted-foreground border-r">–</TableCell>
                            </Fragment>
                          );
                        }
                        const { Icon, cell: cellClass, label } = trendMeta(cell.trend);
                        return (
                          <Fragment key={c.key}>
                            <TableCell className="text-center">{cell.verbal_score}</TableCell>
                            <TableCell className="text-center">{cell.math_score}</TableCell>
                            <TableCell
                              className={`text-center border-r font-semibold ${cellClass}`}
                            >
                              <span className="inline-flex items-center gap-0.5">
                                {cell.total_score}
                                {/* Arrow, not colour alone - the trend must survive
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

                      <TableCell className="text-center font-semibold md:sticky md:right-[60px] z-30 bg-background border-l">
                        {row.official_result ? Number(row.official_result.total_score) : '–'}
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground md:sticky md:right-0 z-30 bg-background">
                        {row.official_result?.test_date ?? '–'}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Per-column aggregates. Baseline is excluded from completion because
                      it is Assignment Zero data, not homework. */}
                  <TableRow className="bg-muted/50 font-medium">
                    <TableCell className="p-2 sticky left-0 z-30 bg-muted border-r">Average</TableCell>
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
                    <TableCell className="md:sticky md:right-[60px] z-30 bg-muted border-l" />
                    <TableCell className="md:sticky md:right-0 z-30 bg-muted" />
                  </TableRow>

                  <TableRow className="bg-muted/30 text-muted-foreground">
                    <TableCell className="p-2 sticky left-0 z-30 bg-muted border-r">Submitted</TableCell>
                    {grid.columns.map((c) => {
                      const s = grid.column_stats[c.key];
                      return (
                        <TableCell key={`${c.key}-done`} colSpan={3} className="text-center border-r">
                          {c.is_baseline
                            ? `${s?.submitted_count ?? 0}`
                            : `${s?.submitted_count ?? 0} / ${s?.expected_count ?? 0}`}
                        </TableCell>
                      );
                    })}
                    <TableCell className="md:sticky md:right-[60px] z-30 bg-muted border-l" />
                    <TableCell className="md:sticky md:right-0 z-30 bg-muted" />
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

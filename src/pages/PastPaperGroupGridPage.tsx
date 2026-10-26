import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { PastPaperScore } from '../components/assignments/PastPaperScore';
import { GroupStateFilter } from '../components/exams/GroupStateFilter';
import { getBluebookGroups, type BluebookGroupOption } from '../services/api/exams';
import { getPastPaperGrid, type PastPaperGrid, type PastPaperGridCell, type PastPaperGridPaper } from '../services/api/pastPapers';
import { defaultGroupState, groupOptionLabel, type GroupState } from '../lib/groupState';
import { formatDate } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import { useAuth } from '../contexts/AuthContext';
import '@/lib/i18n/catalogs/pastPapers';
import '@/lib/i18n/catalogs/teacherInsights';
import '@/lib/i18n/catalogs/exams';

/**
 * Staff view of the SAT practice papers given to a group as homework: students as rows, the papers
 * assigned to the group as columns. Kept apart from the Bluebook grid on purpose; the scaled
 * figure is the platform's ESTIMATE, always labelled, and nothing here ranks anyone.
 */

const Z_STICKY_CELL = 'z-[2]';
const Z_STICKY_CORNER = 'z-[3]';

function Cell({ cell, paper }: { cell: PastPaperGridCell | undefined; paper: PastPaperGridPaper }) {
  const t = useT();
  const state = cell?.state ?? 'not_started';
  if (!cell || state === 'not_started') {
    return <span className="italic text-amber-700 dark:text-amber-500" data-state="not_started">{t('pastPapers.grid.notStarted')}</span>;
  }
  if (state === 'in_progress') {
    return <span className="text-muted-foreground" data-state="in_progress">{t('pastPapers.state.inProgress')}</span>;
  }
  if (state === 'reset_waiting') {
    return <span className="text-muted-foreground" data-state="reset_waiting">{t('pastPapers.grid.resetWaiting')}</span>;
  }
  return (
    <div className="space-y-0.5" data-state="completed">
      <PastPaperScore totalScaledEstimate={cell.total_scaled_estimate} rw={cell.rw} math={cell.math} isPartial={paper.is_partial} />
      <div className="flex flex-wrap justify-center gap-1">
        {cell.late && <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-400">{t('pastPapers.grid.late')}</Badge>}
        {cell.before_assigned && <Badge variant="outline">{t('pastPapers.grid.beforeAssigned')}</Badge>}
      </div>
    </div>
  );
}

export default function PastPaperGroupGridPage() {
  const t = useT();
  const { user } = useAuth();
  const [groupState, setGroupState] = useState<GroupState>(() => defaultGroupState(user?.role));
  const [groups, setGroups] = useState<BluebookGroupOption[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [grid, setGrid] = useState<PastPaperGrid | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstLoad = useRef(true);

  // The group list is the Bluebook one (same scope rules); search runs server-side, debounced.
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const rows = await getBluebookGroups(search.trim() || undefined, groupState);
        if (cancelled) return;
        setGroups(rows);
        if (firstLoad.current && rows.length > 0) {
          setGroupId(rows[0].id);
          firstLoad.current = false;
        }
      } catch {
        if (!cancelled) setError(t('teacherInsights.bluebook.loadGroupsFailed'));
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    }, firstLoad.current ? 0 : 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [search, groupState]);

  useEffect(() => {
    if (groupId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getPastPaperGrid(groupId)
      .then((result) => { if (!cancelled) setGrid(result); })
      .catch((e: any) => {
        if (cancelled) return;
        setGrid(null);
        setError(e?.response?.status === 403 ? t('teacherInsights.bluebook.noAccess') : t('pastPapers.grid.loadFailed'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('pastPapers.grid.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{grid ? `${grid.group.name}  ·  ${t('pastPapers.grid.estimateNote')}` : t('pastPapers.grid.estimateNote')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <GroupStateFilter value={groupState} onChange={(next) => {
            setGroupState(next); setGroupId(null); setGrid(null); setGroupsLoading(true); firstLoad.current = true;
          }} />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('teacherInsights.bluebook.searchPlaceholder')}
              aria-label={t('teacherInsights.bluebook.searchAria')}
              className="pl-8 w-56"
            />
          </div>
          <label htmlFor="pp-group" className="sr-only">{t('teacherInsights.bluebook.group')}</label>
          <select
            id="pp-group"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm max-w-[22rem]"
            value={groupId ?? ''}
            onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
            disabled={groupsLoading || groups.length === 0}
          >
            {groups.length === 0 && <option value="">{t('teacherInsights.bluebook.noMatchingGroups')}</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{groupOptionLabel(g, t('exams.groupState.tag'))}</option>
            ))}
          </select>
        </div>
      </div>

      {!groupsLoading && groups.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {search.trim() ? t('teacherInsights.bluebook.noGroupsMatch', { query: search.trim() }) : t('teacherInsights.bluebook.noGroups')}
        </CardContent></Card>
      )}

      {loading && <Card><CardContent className="p-8 text-center text-muted-foreground">{t('common.loading')}</CardContent></Card>}

      {!loading && error && (
        <Card><CardContent className="p-8 text-center text-red-600 dark:text-red-400" role="alert">{error}</CardContent></Card>
      )}

      {!loading && !error && grid && grid.papers.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t('pastPapers.grid.noPapers')}</CardContent></Card>
      )}

      {!loading && !error && grid && grid.papers.length > 0 && grid.rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">{t('teacherInsights.bluebook.noStudents')}</CardContent></Card>
      )}

      {!loading && !error && grid && grid.papers.length > 0 && grid.rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="border-collapse w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className={`w-44 @2xl:w-64 sticky left-0 ${Z_STICKY_CORNER} bg-background border-r align-bottom`}>
                      {t('teacherInsights.bluebook.col.student')}
                    </TableHead>
                    {grid.papers.map((p) => (
                      <TableHead key={p.paper_id} scope="col" className="p-1 text-center border-r min-w-[170px] align-top">
                        <div className="font-semibold">{p.paper_title}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {p.is_partial && `${t('pastPapers.partial')} · `}
                          {p.due_date ? t('pastPapers.grid.due', { date: formatDate(p.due_date) }) : t('teacherInsights.bluebook.noDueDate')}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grid.rows.map((row) => (
                    <TableRow key={row.student_id}>
                      <TableCell className={`p-2 sticky left-0 ${Z_STICKY_CELL} bg-background border-r`}>
                        <div className="font-medium truncate">{row.name}</div>
                      </TableCell>
                      {grid.papers.map((p) => (
                        <TableCell key={p.paper_id} className="text-center border-r align-top">
                          <Cell cell={row.cells[String(p.paper_id)]} paper={p} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

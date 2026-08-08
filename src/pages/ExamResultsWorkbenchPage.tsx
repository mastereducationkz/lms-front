import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  exportExamResults,
  getExamGroups,
  getExamResults,
  getSatOfficialDates,
  type ExamGroupOption,
  type ExamResultFilters,
  type ExamResultRow,
  type SatOfficialDate,
} from '../services/api/exams';

/**
 * Authorized exam-results workbench: filter by exam, official date / cohort / range,
 * status and group; see student and parent contact details; export the exact filtered
 * set to XLSX.
 *
 * Rows are scoped server-side, so this page shows a teacher only their groups and an
 * admin everything, from the same component. The export re-derives that scope from the
 * authenticated user, so it can never contain a row the table would not show.
 *
 * Contact fields render an em dash when unknown rather than an empty cell: `users` has
 * no phone or telegram column at all (those come only from Assignment Zero) and a
 * parent name exists only where a parent account is linked. Blank would read as "not
 * filled in yet" instead of "we do not hold this".
 */

type ExamType = 'sat' | 'ielts' | 'nuet';
type DateField = 'planned' | 'actual';

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'sat', label: 'SAT' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'nuet', label: 'NUET' },
];

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'reported', label: 'Reported' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

const statusTone: Record<string, string> = {
  reported: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  verified: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export default function ExamResultsWorkbenchPage() {
  const [examType, setExamType] = useState<ExamType>('sat');
  const [dateField, setDateField] = useState<DateField>('planned');
  const [exactDate, setExactDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [status, setStatus] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [search, setSearch] = useState('');

  const [officialDates, setOfficialDates] = useState<SatOfficialDate[]>([]);
  const [groups, setGroups] = useState<ExamGroupOption[]>([]);
  const [rows, setRows] = useState<ExamResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Official SAT dates power the cohort selector. Past dates are included so historical
  // cohorts remain selectable; anticipated 2027-28 dates are excluded so nobody filters
  // by a date College Board has not committed to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { dates } = await getSatOfficialDates({ includeAnticipated: false, includePast: true });
        if (!cancelled) setOfficialDates(dates);
      } catch { /* the cohort selector simply stays empty */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getExamGroups({ program: examType });
        if (!cancelled) setGroups(list);
      } catch { /* group filter stays empty; the rest of the page still works */ }
    })();
    return () => { cancelled = true; };
  }, [examType]);

  const filters: ExamResultFilters = useMemo(() => ({
    examType,
    dateField,
    ...(groupId !== '' ? { groupId } : {}),
    ...(exactDate ? { exactDate } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(status ? { status: status as any } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 500,
  }), [examType, dateField, groupId, exactDate, dateFrom, dateTo, status, search]);

  const load = useCallback(async (f: ExamResultFilters) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getExamResults(f));
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.status === 403
        ? 'You do not have access to those results.'
        : 'Could not load exam results.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const handle = setTimeout(() => load(filters), 300);
    return () => clearTimeout(handle);
  }, [filters, load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportExamResults(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exam-results_${examType}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const resetFilters = () => {
    setExactDate(''); setDateFrom(''); setDateTo('');
    setStatus(''); setGroupId(''); setSearch('');
  };

  const withResult = rows.filter((r) => r.result).length;
  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Exam results</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Filter by official exam date, cohort or range. Export what you see.
          </p>
        </div>
        <Button size="sm" onClick={handleExport} disabled={exporting || rows.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {exporting ? 'Exporting…' : 'Export XLSX'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Exam type */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-20">Exam</span>
            <div className="flex gap-1" role="group" aria-label="Exam type">
              {EXAM_TYPES.map((t) => (
                <Button
                  key={t.value}
                  size="sm"
                  variant={examType === t.value ? 'default' : 'outline'}
                  aria-pressed={examType === t.value}
                  onClick={() => { setExamType(t.value); setExactDate(''); setGroupId(''); }}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Which date the filters apply to - explicit, never inferred */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-20">Date basis</span>
            <div className="flex gap-1" role="group" aria-label="Which date to filter on">
              <Button size="sm" variant={dateField === 'planned' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'planned'}
                      onClick={() => setDateField('planned')}>
                Planned date
              </Button>
              <Button size="sm" variant={dateField === 'actual' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'actual'}
                      onClick={() => setDateField('actual')}>
                Actual test date
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {dateField === 'planned'
                ? 'Who is scheduled to sit the exam'
                : 'When the exam was actually taken (rows without a result are hidden)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {isSat && (
              <div>
                <label htmlFor="er-cohort" className="text-xs font-medium">Official date (cohort)</label>
                <select id="er-cohort" value={exactDate}
                        onChange={(e) => setExactDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Any date</option>
                  {officialDates.map((d) => (
                    <option key={d.test_date} value={d.test_date}>
                      {d.label}{d.is_past ? ' (past)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="er-from" className="text-xs font-medium">From</label>
              <Input id="er-from" type="date" value={dateFrom} className="mt-1"
                     onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="er-to" className="text-xs font-medium">To</label>
              <Input id="er-to" type="date" value={dateTo} className="mt-1"
                     onChange={(e) => setDateTo(e.target.value)} />
            </div>

            <div>
              <label htmlFor="er-group" className="text-xs font-medium">Group</label>
              <select id="er-group" value={groupId}
                      onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">All my groups</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.teacher_name ? `${g.name} — ${g.teacher_name}` : g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="er-status" className="text-xs font-medium">Status</label>
              <select id="er-status" value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      aria-hidden="true" />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Search student name…" aria-label="Search by student name"
                     className="pl-8" />
            </div>
            <Button size="sm" variant="ghost" onClick={resetFilters}>Reset</Button>
            <span className="text-xs text-muted-foreground">
              {loading ? 'Loading…' : `${rows.length} student${rows.length === 1 ? '' : 's'} · ${withResult} with a result`}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="p-8 text-center text-red-600 dark:text-red-400" role="alert">
          {error}
        </CardContent></Card>
      )}

      {!error && !loading && rows.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No students match these filters.
        </CardContent></Card>
      )}

      {!error && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-[3] bg-background border-r w-52">Student</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Parent phone</TableHead>
                    <TableHead>Planned</TableHead>
                    <TableHead>Test date</TableHead>
                    {isSat && <><TableHead className="text-center">Verbal</TableHead><TableHead className="text-center">Math</TableHead></>}
                    {isIelts && <>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">R</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">S</TableHead>
                    </>}
                    <TableHead className="text-center">{isIelts ? 'Overall' : 'Total'}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const r = row.result;
                    return (
                      <TableRow key={row.student.student_id}>
                        <TableCell className="sticky left-0 z-[2] bg-background border-r font-medium">
                          {row.student.full_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{dash(row.group_name)}</TableCell>
                        <TableCell>{dash(row.student.student_phone)}</TableCell>
                        <TableCell>{dash(row.student.telegram_tag)}</TableCell>
                        <TableCell>{dash(row.student.parent_full_name)}</TableCell>
                        <TableCell>{dash(row.student.parent_phone)}</TableCell>
                        <TableCell>{dash(row.planned_test_date)}</TableCell>
                        <TableCell>{dash(r?.test_date)}</TableCell>
                        {isSat && <>
                          <TableCell className="text-center">{r?.verbal_score ?? '—'}</TableCell>
                          <TableCell className="text-center">{r?.math_score ?? '—'}</TableCell>
                        </>}
                        {isIelts && <>
                          <TableCell className="text-center">{r?.listening_band ?? '—'}</TableCell>
                          <TableCell className="text-center">{r?.reading_band ?? '—'}</TableCell>
                          <TableCell className="text-center">{r?.writing_band ?? '—'}</TableCell>
                          <TableCell className="text-center">{r?.speaking_band ?? '—'}</TableCell>
                        </>}
                        <TableCell className="text-center font-semibold">
                          {r ? Number(r.total_score) : '—'}
                        </TableCell>
                        <TableCell>
                          {r ? (
                            <Badge className={statusTone[r.status] ?? ''} variant="secondary">
                              {r.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">no result</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {/* Whether evidence exists - never the storage key, which is PII. */}
                          {r?.has_proof ? 'yes' : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

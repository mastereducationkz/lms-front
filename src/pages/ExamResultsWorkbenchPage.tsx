import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, Download, FileText, MessageSquareQuote, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useAuth } from '../contexts/AuthContext';
import { FinishedTag, GroupStateFilter } from '../components/exams/GroupStateFilter';
import { defaultGroupState, groupOptionLabel, type GroupState } from '../lib/groupState';
import { useT } from '../lib/i18n/react';
import { RecordResultDialog } from '../components/exams/RecordResultDialog';
import { TestimonialDialog } from '../components/exams/TestimonialDialog';
import {
  exportExamResults,
  listTestimonials,
  getExamGroups,
  getExamResults,
  getSatOfficialDates,
  openResultProof,
  updatePlannedDate,
  type ExamGroupOption,
  type ExamResultFilters,
  type ExamResultRow,
  type SatOfficialDate,
  type Testimonial,
} from '../services/api/exams';
import '@/lib/i18n/catalogs/exams';
import { InitialScoreCell, ScoreChange } from '../components/exams/InitialScoreCell';

/**
 * The single exam-results screen: triage, reporting, recording and evidence in one
 * place. It replaces three overlapping pages - the curator task list
 * (/curator/exam-results), the admin tracking list (/exam-results) and the read-only
 * workbench - which each did part of the job and disagreed with each other.
 *
 * One component serves every staff role. Rows are scoped server-side, so a teacher sees
 * their groups and an admin sees everything; write controls are hidden for readers and
 * the backend rejects them regardless.
 */

type ExamType = 'sat' | 'ielts' | 'nuet';
type DateField = 'planned' | 'actual';
type Preset = 'all' | 'todo' | 'overdue' | 'done';

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'sat', label: 'SAT' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'nuet', label: 'NUET' },
];

const WRITE_ROLES = new Set(['curator', 'head_curator', 'admin']);
// Approving releases material to the sales team, so it is deliberately narrower than
// collecting it: the person who gathered the photo is not the only check on it.
const APPROVE_ROLES = new Set(['head_curator', 'admin']);

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

const triageTone: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  pending: 'bg-brand-subtle text-brand-subtle-foreground',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  unscheduled: 'bg-muted text-muted-foreground',
  // «Не хочет делиться» (owner, 2026-10-02): handled by the curator, not neglect — neutral, not red.
  declined: 'bg-muted text-foreground',
};

const chipBase = 'inline-block rounded px-1.5 py-0.5 text-[10px] leading-4 whitespace-nowrap';
const chipOk = `${chipBase} font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300`;
const chipMuted = `${chipBase} bg-muted text-muted-foreground`;

/**
 * Why a row may be used in marketing. The two grounds are shown separately because they
 * permit different things: a score is a fact with no consent attached, while a
 * testimonial IS the consent record - only it allows using the student's name or photo.
 * Renders nothing when the row is not eligible.
 */
function MarketingChips({ row }: { row: ExamResultRow }) {
  const t = useT();
  if (!row.marketing_eligible) return null;
  const byScore = row.marketing_basis.includes('score');
  const byTestimonial = row.marketing_basis.includes('testimonial');
  // The qualifying sitting, spelled out: the verdict is judged on the student's current
  // attempt, which is not always the attempt this row displays - a status or date filter
  // can narrow the row to another one.
  const scoreTitle = row.marketing_score != null && row.marketing_test_date != null
    ? t('exams.marketing.scoreTitleWithAttempt', {
        threshold: row.marketing_threshold ?? '', score: Number(row.marketing_score), date: row.marketing_test_date,
      })
    : t('exams.marketing.scoreTitle', { threshold: row.marketing_threshold ?? '' });
  return (
    <span className="inline-flex items-center gap-1">
      {byScore && (
        <span className={chipOk}
              title={scoreTitle}>
          {t('exams.marketing.score')}
        </span>
      )}
      {byTestimonial && (
        <span className={chipOk}
              title={t('exams.marketing.testimonialTitle')}>
          {t('exams.marketing.testimonial')}
        </span>
      )}
      {byScore && !byTestimonial && (
        <span className={chipMuted}
              title={t('exams.marketing.noConsentTitle')}>
          {t('exams.marketing.noConsent')}
        </span>
      )}
    </span>
  );
}

export default function ExamResultsWorkbenchPage() {
  const { user } = useAuth();
  const t = useT();
  const canWrite = WRITE_ROLES.has(user?.role || '');
  const canApprove = APPROVE_ROLES.has(user?.role || '');

  const [examType, setExamType] = useState<ExamType>('sat');
  const [dateField, setDateField] = useState<DateField>('planned');
  const [preset, setPreset] = useState<Preset>('all');
  const [exactDate, setExactDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [groupState, setGroupState] = useState<GroupState>(() => defaultGroupState(user?.role));
  const [search, setSearch] = useState('');

  const [officialDates, setOfficialDates] = useState<SatOfficialDate[]>([]);
  const [groups, setGroups] = useState<ExamGroupOption[]>([]);
  const [rows, setRows] = useState<ExamResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [recording, setRecording] = useState<ExamResultRow | null>(null);
  const [testimonialFor, setTestimonialFor] = useState<ExamResultRow | null>(null);
  const [testimonials, setTestimonials] = useState<Record<number, Testimonial>>({});
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [rescheduling, setRescheduling] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { dates } = await getSatOfficialDates({ includeAnticipated: false, includePast: true });
        if (!cancelled) setOfficialDates(dates);
      } catch { /* cohort selector stays empty; the page still works */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getExamGroups({ program: examType, groupState });
        if (!cancelled) setGroups(list);
      } catch { /* group filter stays empty */ }
    })();
    return () => { cancelled = true; };
  }, [examType, groupState]);

  const filters: ExamResultFilters = useMemo(() => ({
    examType,
    dateField,
    ...(groupId !== '' ? { groupId } : {}),
    groupState,
    ...(exactDate ? { exactDate } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    // Server-side as well as client-side (see `visible`): the export takes these same
    // filters, so an XLSX of marketing-ready rows matches the screen exactly.
    ...(marketingOnly ? { marketingOnly: true } : {}),
    limit: 500,
  }), [examType, dateField, groupId, groupState, exactDate, dateFrom, dateTo, search, marketingOnly]);

  const load = useCallback(async (f: ExamResultFilters) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getExamResults(f));
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.status === 403
        ? t('exams.errors.noAccess')
        : t('exams.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const handle = setTimeout(() => load(filters), 300);
    return () => clearTimeout(handle);
  }, [filters, load]);

  const loadTestimonials = useCallback(async () => {
    if (!canWrite) return;   // readers do not see marketing material
    try {
      const list = await listTestimonials();
      setTestimonials(Object.fromEntries(list.map((x) => [x.student_id, x])));
    } catch { /* the column simply shows nothing */ }
  }, [canWrite]);

  useEffect(() => { loadTestimonials(); }, [loadTestimonials]);

  // Triage presets filter client-side: the status is derived per row, and re-querying
  // for a view of data already on screen would just add latency.
  const visible = useMemo(() => rows.filter((r) => {
    // "Marketing-ready" is decided server-side per row: the current attempt is above
    // the exam's threshold (SAT > 1400) OR an approved, consented testimonial exists.
    // The row carries the verdict, so no testimonial lookup is needed here.
    // Explicitly `=== false`, so a row WITHOUT the field passes: the two apps deploy
    // independently, and against an older API (which ignores `marketing_only` and sends
    // no verdict) this degrades to "no filtering" instead of emptying the grid.
    if (marketingOnly && r.marketing_eligible === false) return false;
    if (preset === 'all') return true;
    if (preset === 'done') return r.triage_status === 'completed';
    if (preset === 'overdue') return r.triage_status === 'overdue';
    return r.triage_status === 'overdue' || r.triage_status === 'due';
  }), [rows, preset, marketingOnly]);

  // The threshold these rows were judged against, straight from the rows - null on an
  // exam type with no score rule (IELTS, NUET) and before the first page arrives. The
  // label must not advertise a score rule on a tab where no score can ever qualify.
  const marketingThreshold =
    rows.find((r) => r.marketing_threshold != null)?.marketing_threshold ?? null;
  const marketingLabel =
    marketingThreshold != null
      ? t('exams.marketing.readyWithThreshold', { exam: examType.toUpperCase(), threshold: marketingThreshold })
      : rows.length > 0
        ? t('exams.marketing.readyTestimonialOnly')
        : t('exams.marketing.ready');

  const counts = useMemo(() => ({
    all: rows.length,
    todo: rows.filter((r) => r.triage_status === 'overdue' || r.triage_status === 'due').length,
    overdue: rows.filter((r) => r.triage_status === 'overdue').length,
    done: rows.filter((r) => r.triage_status === 'completed').length,
  }), [rows]);

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
      setError(t('exams.errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const reschedule = async (row: ExamResultRow, newDate: string) => {
    if (!newDate) return;
    setRescheduling(row.student.student_id);
    setError(null);
    try {
      await updatePlannedDate({
        student_id: row.student.student_id,
        exam_type: examType,
        planned_test_date: newDate,
      });
      setNotice(t('exams.notice.rescheduled'));
      await load(filters);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail
        : t('exams.errors.rescheduleFailed'));
    } finally {
      setRescheduling(null);
    }
  };

  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';
  const pastDates = officialDates.filter((d) => d.is_past);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('exams.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('exams.subtitle')}
          </p>
        </div>
        <Button size="sm" onClick={handleExport} disabled={exporting || visible.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {exporting ? t('exams.export.running') : t('exams.export.button')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24">{t('exams.filters.exam')}</span>
            <div className="flex gap-1" role="group" aria-label={t('exams.filters.examType')}>
              {EXAM_TYPES.map((x) => (
                <Button key={x.value} size="sm"
                        variant={examType === x.value ? 'default' : 'outline'}
                        aria-pressed={examType === x.value}
                        onClick={() => { setExamType(x.value); setExactDate(''); setGroupId(''); }}>
                  {x.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Triage presets - the daily "who do I chase" workflow the old curator page owned. */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24">{t('exams.filters.show')}</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('exams.filters.triage')}>
              {([['all', t('exams.preset.all'), counts.all],
                 ['todo', t('exams.preset.todo'), counts.todo],
                 ['overdue', t('exams.preset.overdue'), counts.overdue],
                 ['done', t('exams.preset.done'), counts.done]] as const).map(([key, label, n]) => (
                <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'}
                        aria-pressed={preset === key}
                        onClick={() => setPreset(key as Preset)}>
                  {label} <span className="ml-1 opacity-70">{n}</span>
                </Button>
              ))}
            </div>
            {/* Every reader, not only writers: the score is already on screen, and the
                testimonial basis only says a consented testimonial exists - the material
                itself stays behind the write-gated «Отзыв» column. */}
            <label className="ml-2 inline-flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={marketingOnly}
                     onChange={(e) => setMarketingOnly(e.target.checked)} />
              {marketingLabel}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24">{t('exams.filters.dateBasis')}</span>
            <div className="flex gap-1" role="group" aria-label={t('exams.filters.whichDate')}>
              <Button size="sm" variant={dateField === 'planned' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'planned'} onClick={() => setDateField('planned')}>
                {t('exams.filters.planned')}
              </Button>
              <Button size="sm" variant={dateField === 'actual' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'actual'} onClick={() => setDateField('actual')}>
                {t('exams.filters.actual')}
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {dateField === 'planned'
                ? t('exams.filters.plannedHint')
                : t('exams.filters.actualHint')}
            </span>
          </div>

          {/* The picked group may not exist in the new list, so the choice starts over with the state. */}
          <GroupStateFilter value={groupState} onChange={(next) => { setGroupState(next); setGroupId(''); }} />

          <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-4 gap-2">
            {isSat && (
              <div>
                <label htmlFor="er-cohort" className="text-xs font-medium">
                  {t('exams.filters.officialDate')}
                </label>
                <select id="er-cohort" value={exactDate} onChange={(e) => setExactDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">{t('exams.filters.anyDate')}</option>
                  {officialDates.map((d) => (
                    <option key={d.test_date} value={d.test_date}>
                      {d.is_past ? t('exams.filters.pastDate', { label: d.label }) : d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="er-from" className="text-xs font-medium">{t('exams.filters.from')}</label>
              <Input id="er-from" type="date" value={dateFrom} className="mt-1"
                     onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="er-to" className="text-xs font-medium">{t('exams.filters.to')}</label>
              <Input id="er-to" type="date" value={dateTo} className="mt-1"
                     onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label htmlFor="er-group" className="text-xs font-medium">{t('exams.filters.group')}</label>
              <select id="er-group" value={groupId}
                      onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('exams.filters.allMyGroups')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {groupOptionLabel(g, t('exams.groupState.tag'))}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                      aria-hidden="true" />
              <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder={t('exams.filters.searchPlaceholder')}
                     aria-label={t('exams.filters.searchLabel')} className="pl-8" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => {
              setExactDate(''); setDateFrom(''); setDateTo(''); setGroupId(''); setGroupState(defaultGroupState(user?.role)); setSearch(''); setPreset('all');
            }}>{t('exams.filters.reset')}</Button>
            <span className="text-xs text-muted-foreground">
              {loading ? t('common.loading') : `${visible.length} / ${rows.length}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {notice && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/30 px-3 py-2 text-xs text-green-800 dark:text-green-300"
             role="status">{notice}</div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs text-red-700 dark:text-red-300"
             role="alert">{error}</div>
      )}

      {!loading && visible.length === 0 && !error && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          {t('exams.empty')}
        </CardContent></Card>
      )}

      {visible.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className="sticky left-0 z-[3] bg-background border-r w-52">{t('exams.columns.student')}</TableHead>
                    <TableHead>{t('exams.columns.group')}</TableHead>
                    <TableHead>{t('exams.columns.phone')}</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead>{t('exams.columns.parent')}</TableHead>
                    <TableHead>{t('exams.columns.parentPhone')}</TableHead>
                    <TableHead>{t('exams.columns.planned')}</TableHead>
                    <TableHead>{t('exams.columns.askOn')}</TableHead>
                    <TableHead>{t('exams.columns.testDate')}</TableHead>
                    <TableHead className="text-center">{t('exams.columns.initial')}</TableHead>
                    {isSat && <><TableHead className="text-center">Verbal</TableHead><TableHead className="text-center">Math</TableHead></>}
                    <TableHead className="text-center">{isIelts ? 'Overall' : t('exams.columns.total')}</TableHead>
                    <TableHead className="text-center whitespace-nowrap">{t('exams.columns.marketing')}</TableHead>
                    <TableHead>{t('exams.columns.status')}</TableHead>
                    <TableHead className="text-center">{t('exams.columns.proof')}</TableHead>
                    {canWrite && <TableHead className="text-center">{t('exams.columns.testimonial')}</TableHead>}
                    {canWrite && <TableHead className="text-right">{t('exams.columns.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => {
                    const r = row.result;
                    const id = row.student.student_id;
                    const isOpen = expanded.has(id);
                    return (
                      <Fragment key={id}>
                        <TableRow>
                          <TableCell className="p-1">
                            {row.attempts.length > 1 && (
                              <button onClick={() => toggle(id)}
                                      aria-expanded={isOpen}
                                      aria-label={t('exams.row.attemptHistory')}
                                      className="p-1 rounded hover:bg-accent">
                                {isOpen ? <ChevronDown className="h-3.5 w-3.5" />
                                        : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="sticky left-0 z-[2] bg-background border-r font-medium">
                            {row.student.full_name}
                            {row.attempts.length > 1 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ×{row.attempts.length}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{dash(row.group_name)}<FinishedTag finished={row.group_is_finished} /></TableCell>
                          <TableCell>{dash(row.student.student_phone)}</TableCell>
                          <TableCell>{dash(row.student.telegram_tag)}</TableCell>
                          <TableCell>{dash(row.student.parent_full_name)}</TableCell>
                          <TableCell>{dash(row.student.parent_phone)}</TableCell>
                          <TableCell>{dash(row.planned_test_date)}</TableCell>
                          <TableCell>{dash(row.ask_result_on)}</TableCell>
                          <TableCell>{dash(r?.test_date)}</TableCell>
                          <TableCell className="text-center">
                            <InitialScoreCell initial={row.initial} examType={examType} />
                          </TableCell>
                          {isSat && <>
                            <TableCell className="text-center">{r?.verbal_score ?? '—'}</TableCell>
                            <TableCell className="text-center">{r?.math_score ?? '—'}</TableCell>
                          </>}
                          <TableCell className="text-center font-semibold">
                            {r ? Number(r.total_score) : '—'}
                            {r && <ScoreChange change={row.initial?.change} examType={examType} />}
                          </TableCell>
                          <TableCell className="text-center">
                            <MarketingChips row={row} />
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={triageTone[row.triage_status ?? ''] ?? ''}
                                   title={row.triage_status === 'declined' ? row.decline_note ?? undefined : undefined}>
                              {row.triage_status === 'declined'
                                ? t('exams.row.declined')
                                : row.triage_status ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {r?.has_proof ? (
                              <button type="button"
                                      onClick={() => openResultProof(r.id).catch(
                                        () => setError(t('exams.errors.openFileFailed')))}
                                      className="inline-flex items-center gap-1 text-primary hover:underline"
                                      aria-label={t('exams.row.openProof')}>
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('exams.row.view')}
                              </button>
                            ) : '—'}
                          </TableCell>
                          {canWrite && (
                            <TableCell className="text-center whitespace-nowrap">
                              {(() => {
                                const tst = testimonials[id];
                                return (
                                  <button
                                    onClick={() => setTestimonialFor(row)}
                                    className="inline-flex items-center gap-1 hover:underline"
                                    aria-label={t('exams.row.testimonialAndPhoto')}
                                  >
                                    <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
                                    {tst?.is_marketing_ready
                                      ? <span className="text-green-700 dark:text-green-400">
                                          {t('exams.row.testimonialReady')}
                                        </span>
                                      : tst
                                        ? <span className="text-muted-foreground">{tst.status}</span>
                                        : <span className="text-muted-foreground">{t('exams.row.testimonialAdd')}</span>}
                                  </button>
                                );
                              })()}
                            </TableCell>
                          )}
                          {canWrite && (
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <label className="sr-only" htmlFor={`resch-${id}`}>
                                  {t('exams.row.reschedule')}
                                </label>
                                <input id={`resch-${id}`} type="date"
                                       disabled={rescheduling === id}
                                       defaultValue={row.planned_test_date ?? ''}
                                       onChange={(e) => reschedule(row, e.target.value)}
                                       title={t('exams.row.reschedulePlanned')}
                                       className="rounded border border-input bg-background px-1.5 py-1 text-[11px]" />
                                <Button size="sm" variant="secondary"
                                        onClick={() => setRecording(row)}>
                                  <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                                  {t('exams.row.addResult')}
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>

                        {isOpen && row.attempts.map((a) => (
                          <TableRow key={`${id}-${a.id}`} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="sticky left-0 z-[2] bg-muted/30 border-r pl-6 text-muted-foreground">
                              <CalendarClock className="inline h-3 w-3 mr-1" aria-hidden="true" />
                              {t('exams.row.attempt', { date: a.test_date })}
                            </TableCell>
                            <TableCell colSpan={7} />
                            <TableCell>{a.test_date}</TableCell>
                            {isSat && <>
                              <TableCell className="text-center">{a.verbal_score ?? '—'}</TableCell>
                              <TableCell className="text-center">{a.math_score ?? '—'}</TableCell>
                            </>}
                            <TableCell className="text-center font-medium">{Number(a.total_score)}</TableCell>
                            <TableCell />
                            <TableCell><span className="text-muted-foreground">{a.status}</span></TableCell>
                            <TableCell className="text-center">
                              {a.has_proof ? (
                                <button type="button"
                                        onClick={() => openResultProof(a.id).catch(
                                          () => setError(t('exams.errors.openFileFailed')))}
                                        className="text-primary hover:underline">{t('exams.row.view')}</button>
                              ) : '—'}
                            </TableCell>
                            {canWrite && <TableCell />}
                            {canWrite && <TableCell />}
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {testimonialFor && (
        <TestimonialDialog
          studentId={testimonialFor.student.student_id}
          studentName={testimonialFor.student.full_name}
          examResultId={testimonialFor.result?.id ?? null}
          canApprove={canApprove}
          onClose={() => setTestimonialFor(null)}
          // Eligibility is computed server-side and rides on the rows, so approving or
          // revoking a testimonial has to refetch them too - refreshing only the
          // testimonials map left the «Маркетинг» chips showing the previous verdict.
          onSaved={() => { loadTestimonials(); load(filters); }}
        />
      )}

      {recording && (
        <RecordResultDialog
          row={recording}
          examType={examType}
          officialDates={pastDates}
          onClose={() => setRecording(null)}
          onSaved={() => { setNotice(t('exams.notice.resultSaved')); load(filters); }}
        />
      )}
    </div>
  );
}

import { NativeSelect } from '@/components/ui/native-select';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import { GroupStateFilter } from '../components/exams/GroupStateFilter';
import { examResultsDefaultGroupState, groupOptionLabel, type GroupState } from '../lib/groupState';
import { useT } from '../lib/i18n/react';
import { RecordResultDialog } from '../components/exams/RecordResultDialog';
import { AttemptsDialog } from '../components/exams/AttemptsDialog';
import { AddSectionsDialog } from '../components/exams/AddSectionsDialog';
import { TestimonialDialog } from '../components/exams/TestimonialDialog';
import {
  exportExamResults,
  listTestimonials,
  getExamGroups,
  getAllExamResults,
  getSatOfficialDates,
  updatePlannedDate,
  type ExamGroupOption,
  type ExamResultFilters,
  type ExamResultRow,
  type SatOfficialDate,
  type Testimonial,
} from '../services/api/exams';
import '@/lib/i18n/catalogs/exams';
import '@/lib/i18n/catalogs/teacherInsights';
import { ExamStudentsTable, isOutcome, type RowActions } from '../components/exams/ExamStudentsTable';
import { ResultFoldersView } from '../components/exams/ResultFoldersView';
import { DeepLinkedProof, ExamViewHeader, type ExamView } from '../components/exams/ExamViewHeader';
import { datePassedNoResult } from '../components/exams/datePassed';

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
type Preset = 'all' | 'todo' | 'overdue' | 'date_passed' | 'no_result' | 'done';

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'sat', label: 'SAT' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'nuet', label: 'NUET' },
];

const WRITE_ROLES = new Set(['curator', 'head_curator', 'admin']);
// Approving releases material to the sales team, so it is deliberately narrower than
// collecting it: the person who gathered the photo is not the only check on it.
const APPROVE_ROLES = new Set(['head_curator', 'admin']);

export default function ExamResultsWorkbenchPage() {
  const { user } = useAuth();
  const t = useT();
  const canWrite = WRITE_ROLES.has(user?.role || '');
  const canApprove = APPROVE_ROLES.has(user?.role || '');

  const [view, setView] = useState<ExamView>(() => (new URLSearchParams(window.location.search).get('view') === 'folders' ? 'folders' : 'students'));
  const [examType, setExamType] = useState<ExamType>('sat');
  const [dateField, setDateField] = useState<DateField>('planned');
  const [preset, setPreset] = useState<Preset>('all');
  const [exactDate, setExactDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');
  const [groupState, setGroupState] = useState<GroupState>(() => examResultsDefaultGroupState(user?.role));
  const [search, setSearch] = useState('');

  const [officialDates, setOfficialDates] = useState<SatOfficialDate[]>([]);
  const [groups, setGroups] = useState<ExamGroupOption[]>([]);
  const [rows, setRows] = useState<ExamResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [historyFor, setHistoryFor] = useState<ExamResultRow | null>(null);
  const [recording, setRecording] = useState<ExamResultRow | null>(null);
  const [breakdownFor, setBreakdownFor] = useState<ExamResultRow | null>(null);
  const [testimonialFor, setTestimonialFor] = useState<ExamResultRow | null>(null);
  const [testimonials, setTestimonials] = useState<Record<number, Testimonial>>({});
  const [marketingOnly, setMarketingOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
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
    ...(showInactive ? { includeInactive: true } : {}),
    ...(exactDate ? { exactDate } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    // Server-side as well as client-side (see `visible`): the export takes these same
    // filters, so an XLSX of marketing-ready rows matches the screen exactly.
    ...(marketingOnly ? { marketingOnly: true } : {}),
  }), [examType, dateField, groupId, groupState, showInactive, exactDate, dateFrom, dateTo, search, marketingOnly]);

  const load = useCallback(async (f: ExamResultFilters) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAllExamResults(f));
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.status === 403
        ? t('exams.errors.noAccess')
        : t('exams.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // The grid is only fetched while it is on screen, and once per filter set: opening «Папки» first
  // (?view=folders) loads nothing here, and flipping between the views never refetches.
  const loadedFor = useRef<ExamResultFilters | null>(null);
  useEffect(() => {
    if (view !== 'students' || loadedFor.current === filters) return;
    const handle = setTimeout(() => { loadedFor.current = filters; load(filters); }, 300);
    return () => clearTimeout(handle);
  }, [filters, load, view]);

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
    if (preset === 'date_passed') return datePassedNoResult(r);
    if (preset === 'no_result') return isOutcome(r.triage_status);
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
    datePassed: rows.filter((r) => datePassedNoResult(r)).length,
    noResult: rows.filter((r) => isOutcome(r.triage_status)).length,
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

  // The grid's handlers must keep one identity for the life of the page, or its memoized rows all
  // re-render on every keystroke; they read the current filters and exam type through this ref.
  const latest = useRef({ filters, examType, t });
  latest.current = { filters, examType, t };
  const reload = useCallback(() => load(latest.current.filters), [load]);

  const reschedule = useCallback(async (row: ExamResultRow, newDate: string) => {
    if (!newDate) return;
    const { filters: f, examType: exam, t: tr } = latest.current;
    setRescheduling(row.student.student_id);
    setError(null);
    try {
      await updatePlannedDate({
        student_id: row.student.student_id,
        exam_type: exam,
        planned_test_date: newDate,
      });
      setNotice(tr('exams.notice.rescheduled'));
      await load(f);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail
        : tr('exams.errors.rescheduleFailed'));
    } finally {
      setRescheduling(null);
    }
  }, [load]);

  const rowActions: RowActions = useMemo(() => ({
    onHistory: setHistoryFor,
    onRecord: setRecording,
    onBreakdown: setBreakdownFor,
    onTestimonial: setTestimonialFor,
    onReschedule: reschedule,
    onChanged: reload,
    onError: setError,
  }), [reschedule, reload]);
  // A new filter set (or triage preset) starts the grid again from its first chunk.
  const resetKey = useMemo(() => ({ filters, preset }), [filters, preset]);

  const isSat = examType === 'sat';
  const pastDates = officialDates.filter((d) => d.is_past);

  if (view === 'folders') {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <ExamViewHeader view={view} onView={setView} />
        <ResultFoldersView canWrite={canWrite} />
        <DeepLinkedProof />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <ExamViewHeader view={view} onView={setView}>
        <Button size="sm" onClick={handleExport} disabled={exporting || visible.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {exporting ? t('exams.export.running') : t('exams.export.button')}
        </Button>
      </ExamViewHeader>

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
                 ['date_passed', t('exams.preset.datePassed'), counts.datePassed],
                 ['no_result', t('exams.preset.noResult'), counts.noResult],
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
            {/* Off by default: a deactivated account keeps its planned date and reads as an overdue twin of the live one. */}
            <label className="ml-2 inline-flex items-center gap-1.5 text-xs" title={t('exams.filters.showInactiveHint')}>
              <input type="checkbox" checked={showInactive}
                     onChange={(e) => setShowInactive(e.target.checked)} />
              {t('exams.filters.showInactive')}
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
                <NativeSelect id="er-cohort" value={exactDate} onChange={(e) => setExactDate(e.target.value)}
                        className="mt-1 block w-full">
                  <option value="">{t('exams.filters.anyDate')}</option>
                  {officialDates.map((d) => (
                    <option key={d.test_date} value={d.test_date}>
                      {d.is_past ? t('exams.filters.pastDate', { label: d.label }) : d.label}
                    </option>
                  ))}
                </NativeSelect>
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
              <NativeSelect id="er-group" value={groupId}
                      onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 block w-full">
                <option value="">{t('exams.filters.allMyGroups')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {groupOptionLabel(g, t('exams.groupState.tag'))}
                  </option>
                ))}
              </NativeSelect>
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
              setExactDate(''); setDateFrom(''); setDateTo(''); setGroupId(''); setGroupState(examResultsDefaultGroupState(user?.role)); setSearch(''); setPreset('all');
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
            <ExamStudentsTable rows={visible} examType={examType} canWrite={canWrite}
                               testimonials={testimonials} rescheduling={rescheduling}
                               resetKey={resetKey} {...rowActions} />
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

      {historyFor && (
        <AttemptsDialog row={historyFor} examType={examType}
                        onClose={() => setHistoryFor(null)} onError={setError} />
      )}

      {breakdownFor && (
        <AddSectionsDialog row={breakdownFor} onClose={() => setBreakdownFor(null)}
                           onSaved={() => { setNotice(t('exams.sections.saved')); load(filters); }} />
      )}

      <DeepLinkedProof />

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

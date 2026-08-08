import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronRight, Download, FileText, MessageSquareQuote, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { useAuth } from '../contexts/AuthContext';
import { RecordResultDialog } from '../components/exams/RecordResultDialog';
import { TestimonialDialog } from '../components/exams/TestimonialDialog';
import {
  exportExamResults,
  listTestimonials,
  getExamGroups,
  getExamResults,
  getSatOfficialDates,
  resultProofUrl,
  updatePlannedDate,
  type ExamGroupOption,
  type ExamResultFilters,
  type ExamResultRow,
  type SatOfficialDate,
  type Testimonial,
} from '../services/api/exams';

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
  pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  unscheduled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

export default function ExamResultsWorkbenchPage() {
  const { user } = useAuth();
  const isRu = ['curator', 'head_curator'].includes(user?.role || '');
  const t = (ru: string, en: string) => (isRu ? ru : en);
  const canWrite = WRITE_ROLES.has(user?.role || '');
  const canApprove = APPROVE_ROLES.has(user?.role || '');

  const [examType, setExamType] = useState<ExamType>('sat');
  const [dateField, setDateField] = useState<DateField>('planned');
  const [preset, setPreset] = useState<Preset>('all');
  const [exactDate, setExactDate] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [groupId, setGroupId] = useState<number | ''>('');
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
        const list = await getExamGroups({ program: examType });
        if (!cancelled) setGroups(list);
      } catch { /* group filter stays empty */ }
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
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 500,
  }), [examType, dateField, groupId, exactDate, dateFrom, dateTo, search]);

  const load = useCallback(async (f: ExamResultFilters) => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getExamResults(f));
    } catch (e: any) {
      setRows([]);
      setError(e?.response?.status === 403
        ? t('Нет доступа к этим результатам.', 'You do not have access to those results.')
        : t('Не удалось загрузить результаты.', 'Could not load exam results.'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRu]);

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
    // "Marketing-ready" is what the sales team may actually use: approved, consented
    // and not withdrawn. Everything else is invisible to them by construction.
    if (marketingOnly && !testimonials[r.student.student_id]?.is_marketing_ready) return false;
    if (preset === 'all') return true;
    if (preset === 'done') return r.triage_status === 'completed';
    if (preset === 'overdue') return r.triage_status === 'overdue';
    return r.triage_status === 'overdue' || r.triage_status === 'due';
  }), [rows, preset, marketingOnly, testimonials]);

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
      setError(t('Экспорт не удался.', 'Export failed.'));
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
      setNotice(t('Дата перенесена.', 'Planned date updated.'));
      await load(filters);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail
        : t('Не удалось перенести дату.', 'Could not reschedule.'));
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
          <h1 className="text-xl font-semibold">{t('Результаты экзаменов', 'Exam results')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('Отслеживание, внесение результатов и подтверждения — в одном месте.',
               'Track, record and evidence exam results in one place.')}
          </p>
        </div>
        <Button size="sm" onClick={handleExport} disabled={exporting || visible.length === 0}>
          <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {exporting ? t('Экспорт…', 'Exporting…') : t('Экспорт XLSX', 'Export XLSX')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24">{t('Экзамен', 'Exam')}</span>
            <div className="flex gap-1" role="group" aria-label={t('Тип экзамена', 'Exam type')}>
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
            <span className="text-xs font-medium text-muted-foreground w-24">{t('Показать', 'Show')}</span>
            <div className="flex flex-wrap gap-1" role="group" aria-label={t('Фильтр задач', 'Triage filter')}>
              {([['all', t('Все', 'All'), counts.all],
                 ['todo', t('Нужно спросить', 'To chase'), counts.todo],
                 ['overdue', t('Просрочено', 'Overdue'), counts.overdue],
                 ['done', t('Завершено', 'Completed'), counts.done]] as const).map(([key, label, n]) => (
                <Button key={key} size="sm" variant={preset === key ? 'default' : 'outline'}
                        aria-pressed={preset === key}
                        onClick={() => setPreset(key as Preset)}>
                  {label} <span className="ml-1 opacity-70">{n}</span>
                </Button>
              ))}
            </div>
            {canWrite && (
              <label className="ml-2 inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={marketingOnly}
                       onChange={(e) => setMarketingOnly(e.target.checked)} />
                {t('Готово для маркетинга', 'Marketing-ready only')}
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground w-24">{t('Дата по', 'Date basis')}</span>
            <div className="flex gap-1" role="group" aria-label={t('Какая дата', 'Which date to filter on')}>
              <Button size="sm" variant={dateField === 'planned' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'planned'} onClick={() => setDateField('planned')}>
                {t('Плановая', 'Planned')}
              </Button>
              <Button size="sm" variant={dateField === 'actual' ? 'default' : 'outline'}
                      aria-pressed={dateField === 'actual'} onClick={() => setDateField('actual')}>
                {t('Фактическая', 'Actual')}
              </Button>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {dateField === 'planned'
                ? t('Кто планирует сдавать', 'Who is scheduled to sit the exam')
                : t('Когда экзамен реально сдан', 'When the exam was actually taken')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {isSat && (
              <div>
                <label htmlFor="er-cohort" className="text-xs font-medium">
                  {t('Официальная дата', 'Official date (cohort)')}
                </label>
                <select id="er-cohort" value={exactDate} onChange={(e) => setExactDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">{t('Любая', 'Any date')}</option>
                  {officialDates.map((d) => (
                    <option key={d.test_date} value={d.test_date}>
                      {d.label}{d.is_past ? t(' (прошла)', ' (past)') : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="er-from" className="text-xs font-medium">{t('С', 'From')}</label>
              <Input id="er-from" type="date" value={dateFrom} className="mt-1"
                     onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="er-to" className="text-xs font-medium">{t('По', 'To')}</label>
              <Input id="er-to" type="date" value={dateTo} className="mt-1"
                     onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label htmlFor="er-group" className="text-xs font-medium">{t('Группа', 'Group')}</label>
              <select id="er-group" value={groupId}
                      onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="">{t('Все мои группы', 'All my groups')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.teacher_name ? `${g.name} — ${g.teacher_name}` : g.name}
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
                     placeholder={t('Поиск: ученик…', 'Search student name…')}
                     aria-label={t('Поиск по имени', 'Search by student name')} className="pl-8" />
            </div>
            <Button size="sm" variant="ghost" onClick={() => {
              setExactDate(''); setDateFrom(''); setDateTo(''); setGroupId(''); setSearch(''); setPreset('all');
            }}>{t('Сбросить', 'Reset')}</Button>
            <span className="text-xs text-muted-foreground">
              {loading ? t('Загрузка…', 'Loading…') : `${visible.length} / ${rows.length}`}
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
          {t('Нет учеников по этим фильтрам.', 'No students match these filters.')}
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
                    <TableHead className="sticky left-0 z-[3] bg-background border-r w-52">{t('Ученик', 'Student')}</TableHead>
                    <TableHead>{t('Группа', 'Group')}</TableHead>
                    <TableHead>{t('Телефон', 'Phone')}</TableHead>
                    <TableHead>Telegram</TableHead>
                    <TableHead>{t('Родитель', 'Parent')}</TableHead>
                    <TableHead>{t('Тел. родителя', 'Parent phone')}</TableHead>
                    <TableHead>{t('План', 'Planned')}</TableHead>
                    <TableHead>{t('Спросить', 'Ask on')}</TableHead>
                    <TableHead>{t('Сдан', 'Test date')}</TableHead>
                    {isSat && <><TableHead className="text-center">Verbal</TableHead><TableHead className="text-center">Math</TableHead></>}
                    <TableHead className="text-center">{isIelts ? 'Overall' : t('Итог', 'Total')}</TableHead>
                    <TableHead>{t('Статус', 'Status')}</TableHead>
                    <TableHead className="text-center">{t('Подтв.', 'Proof')}</TableHead>
                    {canWrite && <TableHead className="text-center">{t('Отзыв', 'Testimonial')}</TableHead>}
                    {canWrite && <TableHead className="text-right">{t('Действия', 'Actions')}</TableHead>}
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
                                      aria-label={t('История попыток', 'Attempt history')}
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
                          <TableCell className="text-muted-foreground">{dash(row.group_name)}</TableCell>
                          <TableCell>{dash(row.student.student_phone)}</TableCell>
                          <TableCell>{dash(row.student.telegram_tag)}</TableCell>
                          <TableCell>{dash(row.student.parent_full_name)}</TableCell>
                          <TableCell>{dash(row.student.parent_phone)}</TableCell>
                          <TableCell>{dash(row.planned_test_date)}</TableCell>
                          <TableCell>{dash(row.ask_result_on)}</TableCell>
                          <TableCell>{dash(r?.test_date)}</TableCell>
                          {isSat && <>
                            <TableCell className="text-center">{r?.verbal_score ?? '—'}</TableCell>
                            <TableCell className="text-center">{r?.math_score ?? '—'}</TableCell>
                          </>}
                          <TableCell className="text-center font-semibold">
                            {r ? Number(r.total_score) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={triageTone[row.triage_status ?? ''] ?? ''}>
                              {row.triage_status ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {r?.has_proof ? (
                              <a href={resultProofUrl(r.id)} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1 text-primary hover:underline"
                                 aria-label={t('Открыть подтверждение', 'Open proof')}>
                                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                {t('Открыть', 'View')}
                              </a>
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
                                    aria-label={t('Отзыв и фото', 'Testimonial and photo')}
                                  >
                                    <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
                                    {tst?.is_marketing_ready
                                      ? <span className="text-green-700 dark:text-green-400">
                                          {t('готов', 'ready')}
                                        </span>
                                      : tst
                                        ? <span className="text-muted-foreground">{tst.status}</span>
                                        : <span className="text-muted-foreground">{t('добавить', 'add')}</span>}
                                  </button>
                                );
                              })()}
                            </TableCell>
                          )}
                          {canWrite && (
                            <TableCell className="text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <label className="sr-only" htmlFor={`resch-${id}`}>
                                  {t('Перенести', 'Reschedule')}
                                </label>
                                <input id={`resch-${id}`} type="date"
                                       disabled={rescheduling === id}
                                       defaultValue={row.planned_test_date ?? ''}
                                       onChange={(e) => reschedule(row, e.target.value)}
                                       title={t('Перенести плановую дату', 'Reschedule planned date')}
                                       className="rounded border border-input bg-background px-1.5 py-1 text-[11px]" />
                                <Button size="sm" variant="secondary"
                                        onClick={() => setRecording(row)}>
                                  <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
                                  {t('Внести', 'Add')}
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
                              {t('Попытка', 'Attempt')} {a.test_date}
                            </TableCell>
                            <TableCell colSpan={7} />
                            <TableCell>{a.test_date}</TableCell>
                            {isSat && <>
                              <TableCell className="text-center">{a.verbal_score ?? '—'}</TableCell>
                              <TableCell className="text-center">{a.math_score ?? '—'}</TableCell>
                            </>}
                            <TableCell className="text-center font-medium">{Number(a.total_score)}</TableCell>
                            <TableCell><span className="text-muted-foreground">{a.status}</span></TableCell>
                            <TableCell className="text-center">
                              {a.has_proof ? (
                                <a href={resultProofUrl(a.id)} target="_blank" rel="noopener noreferrer"
                                   className="text-primary hover:underline">{t('Открыть', 'View')}</a>
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
          onSaved={loadTestimonials}
        />
      )}

      {recording && (
        <RecordResultDialog
          row={recording}
          examType={examType}
          officialDates={pastDates}
          onClose={() => setRecording(null)}
          onSaved={() => { setNotice(t('Результат сохранён.', 'Result saved.')); load(filters); }}
        />
      )}
    </div>
  );
}

import { memo, useEffect, useRef, useState } from 'react';
import { History, MessageSquareQuote, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { FinishedTag } from './GroupStateFilter';
import { InitialScoreCell, ScoreChange } from './InitialScoreCell';
import { MarketingChips } from './MarketingChips';
import { ResultProofCell } from './ResultProofCell';
import { OutcomeMenu } from './OutcomeMenu';
import { attemptsSummary } from './attemptsSummary';
import { useT } from '../../lib/i18n/react';
import type { ExamResultRow, Testimonial } from '../../services/api/exams';
import '@/lib/i18n/catalogs/exams';
import '@/lib/i18n/catalogs/teacherInsights';

type ExamType = 'sat' | 'ielts' | 'nuet';

/** Rows drawn at once. The grid holds up to ~2 400 students; drawing them all took ~2 s on every view switch. */
export const ROW_CHUNK = 100;

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

const triageTone: Record<string, string> = {
  overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  pending: 'bg-brand-subtle text-brand-subtle-foreground',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  unscheduled: 'bg-muted text-muted-foreground',
  // «Не хочет делиться» (owner, 2026-10-02): handled by the curator, not neglect — neutral, not red.
  declined: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  not_taking: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  unreachable: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

const TRIAGE_KEYS = ['overdue', 'due', 'pending', 'completed', 'unscheduled'];
export const isOutcome = (s: string | null | undefined) =>
  s === 'declined' || s === 'not_taking' || s === 'unreachable';

/** Everything a row needs besides its data. All handlers must be referentially stable, or memo() buys nothing. */
export interface RowActions {
  onHistory: (row: ExamResultRow) => void;
  onRecord: (row: ExamResultRow) => void;
  onBreakdown: (row: ExamResultRow) => void;
  onTestimonial: (row: ExamResultRow) => void;
  onReschedule: (row: ExamResultRow, newDate: string) => void;
  onChanged: () => void;
  onError: (message: string) => void;
}

interface RowProps extends RowActions {
  row: ExamResultRow;
  examType: ExamType;
  canWrite: boolean;
  testimonial: Testimonial | undefined;
  rescheduling: boolean;
}

const ExamStudentRow = memo(function ExamStudentRow({
  row, examType, canWrite, testimonial: tst, rescheduling,
  onHistory, onRecord, onBreakdown, onTestimonial, onReschedule, onChanged, onError,
}: RowProps) {
  const t = useT();
  const r = row.result;
  const id = row.student.student_id;
  const isSat = examType === 'sat';
  return (
    <TableRow>
      <TableCell className="p-1">
        {row.attempts.length > 1 && (
          <button onClick={() => onHistory(row)}
                  aria-haspopup="dialog"
                  aria-label={t('exams.row.attemptHistory')}
                  className="p-1 rounded hover:bg-accent">
            <History className="h-3.5 w-3.5" />
          </button>
        )}
      </TableCell>
      <TableCell className="sticky left-0 z-[2] bg-background border-r font-medium">
        {row.student.full_name}
        {row.student_is_active === false && (
          <span className="ml-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                title={t('exams.inactive.hint')}>
            {t('exams.inactive.tag')}
          </span>
        )}
        {row.attempts.length > 1 && (
          <button type="button" onClick={() => onHistory(row)}
                  className="ml-1 text-[10px] text-muted-foreground hover:underline">
            ×{row.attempts.length}
          </button>
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
        <TableCell className="text-center">
          {r && r.verbal_score == null && canWrite ? (
            <button type="button" onClick={() => onBreakdown(row)} title={t('exams.sections.addHint')}
                    className="rounded border border-amber-500 px-1 text-[10px] text-amber-700 hover:bg-amber-50 dark:text-amber-400">
              {t('exams.sections.add')}
            </button>
          ) : (r?.verbal_score ?? '—')}
        </TableCell>
        <TableCell className="text-center">{r?.math_score ?? '—'}</TableCell>
      </>}
      <TableCell className="text-center font-semibold">
        {r ? Number(r.total_score) : '—'}
        {r && <ScoreChange change={row.initial?.change} examType={examType} />}
        {row.attempts.length > 1 && (
          <button type="button" onClick={() => onHistory(row)} title={attemptsSummary(row.attempts)}
                  className="ml-1 rounded bg-muted px-1 text-[10px] font-normal text-muted-foreground hover:underline">
            +{row.attempts.length - 1}
          </button>
        )}
      </TableCell>
      <TableCell className="text-center">
        <MarketingChips row={row} />
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className={triageTone[row.triage_status ?? ''] ?? ''}
               title={row.outcome_note ?? (row.triage_status === 'declined' ? row.decline_note ?? undefined : undefined)}>
          {isOutcome(row.triage_status)
            ? t(`exams.outcome.${row.triage_status}`)
            : row.triage_status && TRIAGE_KEYS.includes(row.triage_status)
              ? t(`exams.triage.${row.triage_status}`)
              : row.triage_status ?? '—'}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {r ? (
          <ResultProofCell result={r} canWrite={canWrite} label={row.student.full_name}
                           onChanged={onChanged} onError={onError} />
        ) : '—'}
      </TableCell>
      {canWrite && (
        <TableCell className="text-center whitespace-nowrap">
          <button
            onClick={() => onTestimonial(row)}
            className="inline-flex items-center gap-1 hover:underline"
            aria-label={t('exams.row.testimonialAndPhoto')}
          >
            <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
            {tst?.is_marketing_ready
              ? <span className="text-green-700 dark:text-green-400">
                  {t('exams.row.testimonialReady')}
                </span>
              : tst
                ? <span className="text-muted-foreground">{t(`teacherInsights.testimonial.status.${tst.status}`)}</span>
                : <span className="text-muted-foreground">{t('exams.row.testimonialAdd')}</span>}
          </button>
        </TableCell>
      )}
      {canWrite && (
        <TableCell className="text-right whitespace-nowrap">
          <div className="inline-flex items-center gap-1">
            <label className="sr-only" htmlFor={`resch-${id}`}>
              {t('exams.row.reschedule')}
            </label>
            <input id={`resch-${id}`} type="date"
                   disabled={rescheduling}
                   defaultValue={row.planned_test_date ?? ''}
                   onChange={(e) => onReschedule(row, e.target.value)}
                   title={t('exams.row.reschedulePlanned')}
                   className="rounded border border-input bg-background px-1.5 py-1 text-[11px]" />
            <OutcomeMenu row={row} examType={examType}
                         onChanged={onChanged} onError={onError} />
            <Button size="sm" variant="secondary"
                    onClick={() => onRecord(row)}>
              <Plus className="mr-1 h-3 w-3" aria-hidden="true" />
              {t('exams.row.addResult')}
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
});


interface TableProps extends RowActions {
  rows: ExamResultRow[];
  examType: ExamType;
  canWrite: boolean;
  testimonials: Record<number, Testimonial>;
  rescheduling: number | null;
  /** Changes whenever the filters do: the list starts again from its first chunk. */
  resetKey: unknown;
}

/**
 * The student grid of /exam-results. It draws the first ROW_CHUNK rows and reveals more on
 * «Показать ещё» (or when the end of the list scrolls into view); rows are memoized, so a
 * dialog opening or a filter flag changing re-renders none of them. The caller keeps the
 * counts and the export on ALL filtered rows - only the drawing is chunked.
 */
export const ExamStudentsTable = memo(function ExamStudentsTable({ rows, examType, canWrite, testimonials, rescheduling, resetKey, ...actions }: TableProps) {
  const t = useT();
  const [limit, setLimit] = useState(ROW_CHUNK);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const isSat = examType === 'sat';
  const isIelts = examType === 'ielts';
  const shown = Math.min(limit, rows.length);
  const more = rows.length > shown;

  useEffect(() => { setLimit(ROW_CHUNK); }, [resetKey]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !more || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setLimit((n) => n + ROW_CHUNK);
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, shown]);

  return (
    <>
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
            {rows.slice(0, shown).map((row) => (
              <ExamStudentRow key={row.student.student_id} row={row} examType={examType} canWrite={canWrite}
                              testimonial={testimonials[row.student.student_id]}
                              rescheduling={rescheduling === row.student.student_id} {...actions} />
            ))}
          </TableBody>
        </Table>
      </div>
      {more && (
        <div ref={sentinel} className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <span className="text-xs text-muted-foreground">{t('exams.list.shown', { shown, total: rows.length })}</span>
          <Button size="sm" variant="outline" onClick={() => setLimit((n) => n + ROW_CHUNK)}>
            {t('exams.list.showMore')}
          </Button>
        </div>
      )}
    </>
  );
});

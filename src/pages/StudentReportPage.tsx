import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  getStudentReport,
  downloadStudentReportPdf,
  getSubmissionDetail,
  API_BASE_URL,
  type StudentReport,
  type ReportHomeworkItem,
  type SubmissionDetail,
  type WeeklySatTest,
  type WeeklyIeltsTest,
} from '../services/api';
import ParentReportCard from '../components/parentReports/ParentReportCard';
import { mondayOf } from '../lib/parentReportWeek';
import { fetchParentStudentFacts, type ParentStudentResponse } from '../services/api/reports';
import { backendBase, safeUploadUrl } from '../lib/mediaUrl';
import { lessonsLabel, type CheckpointSummary } from '../lib/completion';
import { ArrowLeft, ArrowRight, Check, Paperclip, X } from 'lucide-react';
import { formatDate, formatNumber, type MessageKey, type TFunction } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentReport';

/**
 * Полный отчёт об успеваемости студента для куратора / хэд-куратора /
 * хэд-тичера / админа. Все разделы раскрываются до деталей: домашние задания —
 * до сабмишена (фидбэк, файл, даты), еженедельные тесты — до фидбэка платформ,
 * квизы — до отдельных попыток. Доступ проверяется на сервере.
 */

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }) || '—';
};

// One decimal in the reader's notation: "72.5" / «72,5». Not a number (an average over no
// finished attempts) reads as no data.
const ONE_DECIMAL: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false };

const fmtBand = (v: number | null | undefined): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : formatNumber(v, ONE_DECIMAL);

const fmtPct = (v: number | null | undefined): string => {
  const band = fmtBand(v);
  return band === '—' ? band : `${band}%`;
};

// A submission file reference is untrusted (student-supplied); null when it isn't a
// safe upload URL (hostile scheme, foreign host, corrupted legacy row) — callers fall
// back to plain text rather than rendering a link. backendBase() strips a trailing
// slash, so the single-"/" guarantee doesn't depend on how VITE_BACKEND_URL is set.
const fileHref = (fileUrl: string): string | null => safeUploadUrl(fileUrl, backendBase(API_BASE_URL));

// `optIn`: left out of a PDF unless ticked — talk time, since the PDF is sometimes sent to
// parents (owner, 2026-09-11). Shown only when the report has that section at all.
const PDF_SECTIONS: { key: string; label: MessageKey; optIn?: boolean }[] = [
  { key: 'homework', label: 'studentReport.section.homework' },
  { key: 'weekly', label: 'studentReport.section.weeklySatNuet' },
  { key: 'ielts', label: 'studentReport.section.weeklyIelts' },
  { key: 'bluebook', label: 'studentReport.section.bluebook' },
  { key: 'quizzes', label: 'studentReport.section.quizzes' },
  { key: 'courses', label: 'studentReport.section.courses' },
  { key: 'attendance', label: 'studentReport.section.attendance' },
  { key: 'talk', label: 'studentReport.section.talkPdf', optIn: true },
  { key: 'activity', label: 'studentReport.section.activity' },
];

/** "5 min", "< 1 min" for a few seconds, "—" for none. */
const fmtTalk = (seconds: number | null | undefined, t: TFunction): string => {
  if (!seconds) return '—';
  const minutes = Math.round(seconds / 60);
  return minutes ? t('studentReport.minutes', { minutes }) : t('studentReport.underAMinute');
};

/** The checkpoints cell: "3 of 4 · average 72%", empty when nothing was ever opened. */
const fmtCheckpoints = (cp: CheckpointSummary | null | undefined, t: TFunction): string => {
  if (!cp || !cp.opened) return '';
  const counts = { taken: cp.taken, opened: cp.opened };
  return cp.average === null || cp.average === undefined
    ? t('studentReport.courses.checkpointsValue', counts)
    : t('studentReport.courses.checkpointsValueWithAverage', { ...counts, average: cp.average });
};

const ACTIVITY_REASONS: Record<string, MessageKey> = {
  course_quiz: 'studentReport.activity.reason.courseQuiz',
  homework: 'studentReport.activity.reason.homework',
  assignment: 'studentReport.activity.reason.assignment',
  daily_questions: 'studentReport.activity.reason.dailyQuestions',
};

const HW_STATUS: Record<ReportHomeworkItem['status'], { label: MessageKey; cls: string }> = {
  graded: { label: 'studentReport.homework.graded', cls: 'bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30' },
  submitted: { label: 'studentReport.homework.submitted', cls: 'bg-yellow-50 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30' },
  not_submitted: { label: 'studentReport.homework.notSubmitted', cls: 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-red-300 border-red-200 dark:border-red-500/30' },
};

// ─── Small building blocks ────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FeedbackText({ text }: { text: string }) {
  return (
    <div className="text-xs text-muted-foreground whitespace-pre-wrap bg-gray-50 dark:bg-muted border border-border rounded-lg p-3">
      {text}
    </div>
  );
}

function ExpandChevron({ open }: { open: boolean }) {
  return <span className="text-muted-foreground text-xs select-none">{open ? '▲' : '▼'}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentReportPage() {
  const t = useT();
  const locale = useLocale();
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [parentWeek] = useState(() => mondayOf(new Date()));
  const [parentData, setParentData] = useState<ParentStudentResponse | null>(null);
  const [parentLoading, setParentLoading] = useState(false);
  const [parentError, setParentError] = useState<MessageKey | null>(null);

  const openParentReport = async () => {
    if (!report) return;
    setParentOpen(true);
    // Сбрасываем перед запросом: иначе при повторном открытии карточка секунду показывает
    // данные прошлого открытия, как будто это свежие.
    setParentData(null);
    setParentError(null);
    setParentLoading(true);
    try {
      setParentData(await fetchParentStudentFacts(report.student.id, parentWeek));
    } catch {
      // Не сводим ошибку к пустой карточке: «отчёта ещё нет» и «мы не смогли его получить» —
      // разные вещи, и во втором случае куратор не должен генерировать поверх существующего.
      setParentError('studentReport.parentModal.loadFailed');
    } finally {
      setParentLoading(false);
    }
  };

  const [exportSections, setExportSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PDF_SECTIONS.map(s => [s.key, !s.optIn])),
  );
  const [exportFeedback, setExportFeedback] = useState(true);
  const [openHw, setOpenHw] = useState<number | null>(null);
  const [viewer, setViewer] = useState<{ loading: boolean; data: SubmissionDetail | null } | null>(null);
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getStudentReport(Number(studentId))
      .then((r) => { if (!cancelled) setReport(r); })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.response?.status;
        setError(status === 403 ? 'studentReport.error.forbidden' : 'studentReport.error.loadFailed');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    const chosen = pdfSections.filter(s => exportSections[s.key]).map(s => s.key);
    if (chosen.length === 0) return;
    setDownloading(true);
    try {
      await downloadStudentReportPdf(report.student.id, report.student.name, {
        // Always named: "everything" on the server leaves the opt-in sections out.
        sections: chosen,
        includeFeedback: exportFeedback,
      });
      setExportOpen(false);
    } catch {
      setError('studentReport.error.pdfFailed');
    } finally {
      setDownloading(false);
    }
  };

  const pdfSections = PDF_SECTIONS.filter(s => s.key !== 'talk' || report?.talk);

  const openSubmission = async (submissionId: number) => {
    setViewer({ loading: true, data: null });
    try {
      const data = await getSubmissionDetail(Number(studentId), submissionId);
      setViewer({ loading: false, data });
    } catch {
      setViewer(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-[1000px] mx-auto text-center">
        <p className="text-red-500">{t(error ?? 'studentReport.notFound')}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>{t('common.back')}</Button>
      </div>
    );
  }

  const { student, homework, quizzes, bluebook, exams, courses, attendance, activity, weekly_tests } = report;
  const avgQuizPct = quizzes.length
    ? quizzes.reduce((sum, c) => sum + (c.average_pct ?? 0), 0) / quizzes.filter(c => c.average_pct !== null).length
    : null;

  const weeklyTable = (weeks: WeeklySatTest[], keyPrefix: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground border-b border-border">
            <th className="py-2 pr-3 font-medium">{t('studentReport.week')}</th>
            <th className="py-2 pr-3 font-medium">Math</th>
            <th className="py-2 pr-3 font-medium">Verbal</th>
            <th className="py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => {
            const key = `${keyPrefix}-${i}`;
            const hasFeedback = Boolean(w.math?.feedback || w.verbal?.feedback);
            const side = (s: WeeklySatTest['math']) =>
              !s || s.correct === null ? '—' : `${s.correct}/${s.total}${s.pct != null ? ` — ${fmtPct(s.pct)}` : ''}`;
            return (
              <>
                <tr
                  key={key}
                  className={`border-b border-border/50 ${hasFeedback ? 'cursor-pointer hover:bg-muted/60' : ''}`}
                  onClick={() => hasFeedback && setOpenWeek(openWeek === key ? null : key)}
                >
                  <td className="py-2 pr-3 text-foreground">{w.week_label}</td>
                  <td className="py-2 pr-3">{side(w.math)}</td>
                  <td className="py-2 pr-3">{side(w.verbal)}</td>
                  <td className="py-2 text-right">{hasFeedback && <ExpandChevron open={openWeek === key} />}</td>
                </tr>
                {openWeek === key && hasFeedback && (
                  <tr key={`${key}-fb`}>
                    <td colSpan={4} className="py-2 space-y-2">
                      {w.math?.feedback && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">{t('studentReport.weekly.feedbackFor', { section: 'Math' })}</p>
                          <FeedbackText text={w.math.feedback} />
                        </div>
                      )}
                      {w.verbal?.feedback && (
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">{t('studentReport.weekly.feedbackFor', { section: 'Verbal' })}</p>
                          <FeedbackText text={w.verbal.feedback} />
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const ieltsFeedbackParts = (w: WeeklyIeltsTest): { label: string; text: string }[] => {
    const parts: { label: string; text: string }[] = [];
    const push = (label: string, value: WeeklyIeltsTest['feedback']['writing']) => {
      if (!value) return;
      if (typeof value === 'string') { parts.push({ label, text: value }); return; }
      const combined = Object.values(value).filter((v): v is string => Boolean(v)).join('\n\n');
      if (combined) parts.push({ label, text: combined });
    };
    push('Listening', w.feedback?.listening ?? null);
    push('Reading', w.feedback?.reading ?? null);
    push('Writing', w.feedback?.writing ?? null);
    push('Speaking', w.feedback?.speaking ?? null);
    return parts;
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('common.back')}
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 p-5 bg-card border border-border rounded-xl">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground">{t('studentReport.title', { name: student.name })}</h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {student.groups.map(g => (
              <Badge key={g.id} className="bg-muted text-muted-foreground border-border text-xs font-normal">
                {t('studentReport.groupSince', { group: g.name, date: fmtDate(g.joined_at) })}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" onClick={openParentReport}>{t('studentReport.parentText')}</Button>
        <Button onClick={() => setExportOpen(true)}>{t('studentReport.downloadPdf')}</Button>
      </div>

      {weekly_tests.errors.length > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 rounded-lg text-xs text-amber-700 dark:text-amber-300">
          {t('studentReport.platformErrors', { errors: weekly_tests.errors.join('; ') })}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
        {[
          { label: t('studentReport.section.attendance'), value: fmtPct(attendance.attendance_pct), sub: t('studentReport.stats.attendedOf', { attended: attendance.attended, total: attendance.marked_total }) },
          { label: t('studentReport.section.homework'), value: `${homework.graded}/${homework.assigned}`, sub: t('studentReport.stats.pointsOf', { earned: homework.earned_score, max: homework.max_score }) },
          { label: t('studentReport.stats.avgQuiz'), value: fmtPct(avgQuizPct), sub: t('studentReport.stats.attempts', { count: quizzes.reduce((s, c) => s + c.completed_attempts, 0) }) },
          { label: t('studentReport.stats.activityPoints'), value: String(activity.points_total), sub: t('studentReport.stats.dailyTasks', { count: activity.daily_questions_completed }) },
        ].map(s => (
          <div key={s.label} className="p-4 bg-card border border-border rounded-xl">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-xl font-semibold text-foreground mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Homework */}
      <Section
        title={t('studentReport.section.homework')}
        subtitle={t('studentReport.homework.summary', { assigned: homework.assigned, submitted: homework.submitted, graded: homework.graded })}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">{t('studentReport.homework.assignment')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.homework.due')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.homework.score')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.homework.status')}</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {homework.items.map(item => {
                const st = HW_STATUS[item.status];
                const open = openHw === item.id;
                const expandable = Boolean(item.submission);
                return (
                  <>
                    <tr
                      key={item.id}
                      className={`border-b border-border/50 ${expandable ? 'cursor-pointer hover:bg-muted/60' : ''}`}
                      onClick={() => expandable && setOpenHw(open ? null : item.id)}
                    >
                      <td className="py-2 pr-3 text-foreground">{item.title}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(item.due_date)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {t('studentReport.homework.scoreOf', { score: item.score ?? '—', max: item.max_score ?? '—' })}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge className={`${st.cls} text-xs font-normal`}>{t(st.label)}</Badge>
                        {item.submission?.is_late && (
                          <Badge className="ml-1 bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-200 dark:border-orange-500/30 text-xs font-normal">{t('studentReport.homework.late')}</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">{expandable && <ExpandChevron open={open} />}</td>
                    </tr>
                    {open && item.submission && (
                      <tr key={`${item.id}-detail`}>
                        <td colSpan={5} className="py-2">
                          <div className="bg-gray-50 dark:bg-muted border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
                            <p>{t('studentReport.homework.submittedAt')} <span className="text-foreground">{fmtDate(item.submitted_at)}</span>
                              {item.submission.graded_at && <> · {t('studentReport.homework.gradedAt')} <span className="text-foreground">{fmtDate(item.submission.graded_at)}</span></>}
                            </p>
                            {item.submission.feedback && (
                              <p className="whitespace-pre-wrap">{t('studentReport.homework.feedback')} <span className="text-foreground">{item.submission.feedback}</span></p>
                            )}
                            {item.submission.file_url && (() => {
                              const href = fileHref(item.submission.file_url);
                              return href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand hover:underline"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{item.submission.file_name || t('studentReport.homework.file')}
                                </a>
                              ) : (
                                <span className="text-muted-foreground"><Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{item.submission.file_name || t('studentReport.homework.file')}</span>
                              );
                            })()}
                            <button
                              type="button"
                              className="flex items-center gap-1 text-brand hover:underline"
                              onClick={e => { e.stopPropagation(); openSubmission(item.submission!.id); }}
                            >
                              {t('studentReport.homework.openSubmission')}
                              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Weekly tests: SAT / NUET */}
      {weekly_tests.sat.length > 0 && (
        <Section title={t('studentReport.weekly.satTitle')} subtitle={t('studentReport.weekly.satSubtitle')}>
          {weeklyTable(weekly_tests.sat, 'sat')}
        </Section>
      )}
      {weekly_tests.nuet.length > 0 && (
        <Section title={t('studentReport.weekly.nuetTitle')} subtitle={t('studentReport.weekly.nuetSubtitle')}>
          {weeklyTable(weekly_tests.nuet, 'nuet')}
        </Section>
      )}

      {/* Weekly IELTS */}
      {weekly_tests.ielts.length > 0 && (
        <Section title={t('studentReport.weekly.ieltsTitle')} subtitle={t('studentReport.weekly.ieltsSubtitle')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('studentReport.week')}</th>
                  <th className="py-2 pr-3 font-medium">Listening</th>
                  <th className="py-2 pr-3 font-medium">Reading</th>
                  <th className="py-2 pr-3 font-medium">Writing</th>
                  <th className="py-2 pr-3 font-medium">Speaking</th>
                  <th className="py-2 pr-3 font-medium">Overall</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {weekly_tests.ielts.map((w, i) => {
                  const key = `ielts-${i}`;
                  const parts = ieltsFeedbackParts(w);
                  const open = openWeek === key;
                  return (
                    <>
                      <tr
                        key={key}
                        className={`border-b border-border/50 ${parts.length ? 'cursor-pointer hover:bg-muted/60' : ''}`}
                        onClick={() => parts.length && setOpenWeek(open ? null : key)}
                      >
                        <td className="py-2 pr-3 text-foreground">{w.week_label}</td>
                        <td className="py-2 pr-3">{fmtBand(w.listening_band)}</td>
                        <td className="py-2 pr-3">{fmtBand(w.reading_band)}</td>
                        <td className="py-2 pr-3">{fmtBand(w.writing_band)}</td>
                        <td className="py-2 pr-3">{fmtBand(w.speaking_band)}</td>
                        <td className="py-2 pr-3 font-medium">{fmtBand(w.overall_band)}</td>
                        <td className="py-2 text-right">{parts.length > 0 && <ExpandChevron open={open} />}</td>
                      </tr>
                      {open && parts.length > 0 && (
                        <tr key={`${key}-fb`}>
                          <td colSpan={7} className="py-2 space-y-2">
                            {parts.map(p => (
                              <div key={p.label}>
                                <p className="text-xs font-medium text-foreground mb-1">{p.label}</p>
                                <FeedbackText text={p.text} />
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Bluebook + official exams */}
      <Section title={t('studentReport.section.bluebook')}>
        {bluebook.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('studentReport.bluebook.test')}</th>
                  <th className="py-2 pr-3 font-medium">{t('studentReport.date')}</th>
                  <th className="py-2 pr-3 font-medium">{t('studentReport.bluebook.total')}</th>
                  <th className="py-2 pr-3 font-medium">Verbal</th>
                  <th className="py-2 pr-3 font-medium">Math</th>
                </tr>
              </thead>
              <tbody>
                {bluebook.map(b => (
                  <tr key={`${b.test_number}-${b.taken_at}`} className="border-b border-border/50">
                    <td className="py-2 pr-3 text-foreground">Practice Test {b.test_number}</td>
                    <td className="py-2 pr-3">{b.taken_at ? fmtDate(b.taken_at) : t('studentReport.bluebook.entry')}</td>
                    <td className="py-2 pr-3 font-medium">{b.total}</td>
                    <td className="py-2 pr-3">{b.verbal}</td>
                    <td className="py-2 pr-3">{b.math}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('studentReport.bluebook.empty')}</p>
        )}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {exams.results.length > 0 ? exams.results.map(r => (
            <p key={`${r.exam_type}-${r.test_date}`}>
              {t('studentReport.exams.official', { exam: r.exam_type.toUpperCase() })} <span className="font-medium text-foreground">{r.total_score}</span> ({fmtDate(r.test_date)}, {r.status})
            </p>
          )) : <p>{t('studentReport.exams.none')}</p>}
          {exams.sat_planned_date && <p>{t('studentReport.exams.plannedDate', { exam: 'SAT' })} <span className="font-medium text-foreground">{fmtDate(exams.sat_planned_date)}</span></p>}
          {exams.ielts_planned_date && <p>{t('studentReport.exams.plannedDate', { exam: 'IELTS' })} <span className="font-medium text-foreground">{fmtDate(exams.ielts_planned_date)}</span></p>}
        </div>
      </Section>

      {/* Quizzes */}
      {quizzes.map(course => (
        <Section
          key={course.course_id}
          title={t('studentReport.quizzes.title', { course: course.course_title })}
          subtitle={t('studentReport.quizzes.summary', { total: course.total_attempts, completed: course.completed_attempts, average: fmtPct(course.average_pct) })}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">{t('studentReport.quizzes.section')}</th>
                  <th className="py-2 pr-3 font-medium">{t('studentReport.quizzes.attempts')}</th>
                  <th className="py-2 pr-3 font-medium">{t('studentReport.quizzes.average')}</th>
                  <th className="py-2 pr-3 font-medium">{t('studentReport.quizzes.best')}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {course.sections.map(section => {
                  const key = `${course.course_id}-${section.lesson_id}`;
                  const open = openQuiz === key;
                  return (
                    <>
                      <tr
                        key={key}
                        className="border-b border-border/50 cursor-pointer hover:bg-muted/60"
                        onClick={() => setOpenQuiz(open ? null : key)}
                      >
                        <td className="py-2 pr-3 text-foreground">{section.lesson_title}</td>
                        <td className="py-2 pr-3">{section.attempts}</td>
                        <td className="py-2 pr-3">{fmtPct(section.average_pct)}</td>
                        <td className="py-2 pr-3">{fmtPct(section.best_pct)}</td>
                        <td className="py-2 text-right"><ExpandChevron open={open} /></td>
                      </tr>
                      {open && (
                        <tr key={`${key}-detail`}>
                          <td colSpan={5} className="py-2">
                            <div className="bg-gray-50 dark:bg-muted border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                              {section.attempt_details.map((a, i) => (
                                <p key={i}>
                                  {fmtDate(a.completed_at)} — {a.correct}/{a.total_questions} ({fmtPct(a.pct)})
                                </p>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      ))}

      {/* Course progress */}
      <Section title={t('studentReport.section.courses')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.course')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.lessons')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.progress')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.checkpoints')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.studyTime')}</th>
                <th className="py-2 pr-3 font-medium">{t('studentReport.courses.lastActivity')}</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.course_id} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground">{c.course_title}</td>
                  <td className="py-2 pr-3">{lessonsLabel(c.lessons_done, c.lessons_total, locale) || '—'}</td>
                  <td className="py-2 pr-3 font-medium">{Math.trunc(c.completion_pct)}%</td>
                  <td className="py-2 pr-3">{fmtCheckpoints(c.checkpoints, t) || '—'}</td>
                  <td className="py-2 pr-3">{t('studentReport.hoursMinutes', { hours: Math.floor(c.time_spent_minutes / 60), minutes: c.time_spent_minutes % 60 })}</td>
                  <td className="py-2 pr-3">{fmtDate(c.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Attendance */}
      <Section
        title={t('studentReport.section.attendance')}
        subtitle={t(attendance.absent_excused ? 'studentReport.attendance.summaryWithExcused' : 'studentReport.attendance.summary', {
          marked: attendance.marked_total,
          present: fmtPct(attendance.attendance_pct),
          late: attendance.late,
          absent: attendance.absent,
          excused: attendance.absent_excused ?? 0,
        })}
      >
        {attendance.absences.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t('studentReport.attendance.absences')}</p>
            {attendance.absences.map((a, i) => (
              <p key={i}>
                {fmtDate(a.date)} — {a.title}
                {a.excused && (
                  <span
                    className="ml-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 align-middle"
                    title={a.excuse_note ? t('studentReport.attendance.excusedWithNote', { note: a.excuse_note }) : t('studentReport.attendance.excused')}
                  >
                    {t('studentReport.attendance.excusedBadge')}
                  </span>
                )}
              </p>
            ))}
          </div>
        )}
        {attendance.lates.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">{t('studentReport.attendance.lates')}</p>
            {attendance.lates.map((a, i) => <p key={i}>{fmtDate(a.date)} — {a.title}</p>)}
          </div>
        )}
        {attendance.marked_total === 0 && <p className="text-sm text-muted-foreground">{t('studentReport.attendance.empty')}</p>}
      </Section>

      {/* Talk time in Meet lessons */}
      {report.talk && (
        <Section
          title={t('studentReport.talk.title')}
          subtitle={[
            t('studentReport.talk.summary', {
              count: report.talk.totals.lessons,
              spoke: report.talk.totals.lessons_spoke,
              total: fmtTalk(report.talk.totals.total_seconds, t),
              avg: fmtTalk(report.talk.totals.avg_seconds, t),
            }),
            report.talk.totals.questions !== null && t('studentReport.talk.summaryQuestions', { count: report.talk.totals.questions }),
            report.talk.totals.answers != null && t('studentReport.talk.summaryAnswers', { count: report.talk.totals.answers }),
          ].filter(Boolean).join(' · ')}
        >
          {report.talk.lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('studentReport.talk.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-medium">{t('studentReport.date')}</th>
                    <th className="py-2 pr-3 font-medium">{t('studentReport.talk.lesson')}</th>
                    <th className="py-2 pr-3 font-medium">{t('studentReport.talk.spoke')}</th>
                    <th className="py-2 pr-3 font-medium">{t('studentReport.talk.share')}</th>
                    <th className="py-2 pr-3 font-medium" title={t('studentReport.talk.questionsHint')}>{t('studentReport.talk.questions')}</th>
                    <th className="py-2 pr-3 font-medium" title={t('studentReport.talk.answersHint')}>{t('studentReport.talk.answers')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.talk.lessons.map(lesson => (
                    <tr key={lesson.event_id} className="border-b border-border/50">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(lesson.start)}</td>
                      <td className="py-2 pr-3 text-foreground">{lesson.group_name ?? lesson.title}</td>
                      <td className="py-2 pr-3 tabular-nums">
                        {lesson.in_room ? fmtTalk(lesson.seconds, t) : <span className="text-muted-foreground">{t('studentReport.talk.absent')}</span>}
                      </td>
                      <td className="py-2 pr-3">
                        {lesson.in_room ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
                              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(lesson.share_of_students * 100)}%` }} />
                            </div>
                            <span className="tabular-nums text-xs text-muted-foreground">{fmtPct(lesson.share_of_students * 100)}</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{lesson.questions ?? '—'}</td>
                      <td className="py-2 pr-3 tabular-nums">{lesson.answers ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Activity */}
      <Section title={t('studentReport.section.activity')}>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>{t('studentReport.activity.dailyDone')} <span className="font-medium text-foreground">{activity.daily_questions_completed}</span></p>
          <p>{t('studentReport.activity.pointsTotal')} <span className="font-medium text-foreground">{activity.points_total}</span></p>
          <div className="text-xs text-muted-foreground mt-1">
            {Object.entries(activity.points_by_reason).sort((a, b) => b[1] - a[1]).map(([reason, pts]) => (
              <p key={reason}>{reason in ACTIVITY_REASONS ? t(ACTIVITY_REASONS[reason]) : reason}: {pts}</p>
            ))}
          </div>
        </div>
      </Section>

      <p className="text-xs text-muted-foreground/50 text-center pb-4">{t('studentReport.generatedAt', { date: fmtDate(report.generated_at) })}</p>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !downloading && setExportOpen(false)}>
          <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-base font-semibold text-foreground">{t('studentReport.export.title')}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t('studentReport.export.hint')}</p>
            </div>
            <div className="space-y-2">
              {pdfSections.map(section => (
                <label key={section.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportSections[section.key]}
                    onChange={e => setExportSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                    className="rounded border-border"
                  />
                  {t(section.label)}
                </label>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportFeedback}
                  onChange={e => setExportFeedback(e.target.checked)}
                  className="rounded border-border"
                />
                {t('studentReport.export.feedback')}
              </label>
              <p className="text-[11px] text-muted-foreground mt-1 ml-6">{t('studentReport.export.feedbackHint')}</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" disabled={downloading} onClick={() => setExportOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                disabled={downloading || pdfSections.every(s => !exportSections[s.key])}
                onClick={handleDownloadPdf}
              >
                {downloading ? t('studentReport.export.generating') : t('studentReport.downloadPdf')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Клик по фону здесь намеренно не закрывает окно, в отличие от диалога экспорта:
          там нечего терять, а тут в текстовых полях лежит то, что куратор набрал руками,
          и промах мимо панели стирал бы это молча. Закрытие — только кнопкой. */}
      {parentOpen && report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-semibold text-foreground">{t('studentReport.parentText')}</h3>
              <button
                type="button"
                className="text-muted-foreground text-sm"
                onClick={() => setParentOpen(false)}
              >
                {t('common.close')}
              </button>
            </div>
            <div className="p-4">
              {parentLoading && (
                <p className="text-sm text-muted-foreground">{t('studentReport.parentModal.loading')}</p>
              )}
              {parentError && <p className="text-sm text-red-600 dark:text-red-300">{t(parentError)}</p>}
              {!parentLoading && !parentError && (
                <ParentReportCard
                  studentId={report.student.id}
                  studentName={report.student.name}
                  week={parentWeek}
                  initial={parentData}
                  onSaved={setParentData}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {viewer && (
        <SubmissionViewer viewer={viewer} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}

// ─── Submission viewer ────────────────────────────────────────────────────────

function AnswerValue({ value }: { value: unknown }) {
  const t = useT();
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') {
    return value ? (
      <p className="flex items-center gap-1 text-sm text-foreground"><Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />{t('studentReport.answer.done')}</p>
    ) : (
      <p className="text-sm text-foreground">{t('studentReport.answer.notDone')}</p>
    );
  }
  if (typeof value === 'string') {
    if (/^(https?:\/\/|\/)/.test(value) && /\.(png|jpe?g|gif|webp|pdf|mp3|m4a|ogg|wav|webm|docx?|xlsx?)([?#]|$)/i.test(value)) {
      const href = fileHref(value);
      return href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline break-all">
          <Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{value.split('/').pop()}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground break-all"><Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{value.split('/').pop()}</span>
      );
    }
    return <p className="text-sm text-foreground whitespace-pre-wrap break-words">{value}</p>;
  }
  if (typeof value === 'number') return <p className="text-sm text-foreground">{String(value)}</p>;
  return (
    <pre className="text-xs text-muted-foreground bg-gray-50 dark:bg-muted border border-border rounded p-2 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

const ANSWER_FIELD_LABELS: Record<string, MessageKey> = {
  text_response: 'studentReport.answer.field.answer',
  text: 'studentReport.answer.field.answer',
  file_url: 'studentReport.answer.field.file',
  screenshot_url: 'studentReport.answer.field.screenshot',
  url: 'studentReport.answer.field.link',
  completed: 'studentReport.answer.field.status',
  verbal_score: 'studentReport.answer.field.verbal',
  math_score: 'studentReport.answer.field.math',
};

function TaskAnswer({ answer }: { answer: unknown }) {
  const t = useT();
  if (answer === null || answer === undefined) {
    return <p className="text-sm text-muted-foreground">{t('studentReport.answer.none')}</p>;
  }
  if (typeof answer !== 'object' || Array.isArray(answer)) {
    return <AnswerValue value={answer} />;
  }
  const entries = Object.entries(answer as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t('studentReport.answer.none')}</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{key in ANSWER_FIELD_LABELS ? t(ANSWER_FIELD_LABELS[key]) : key}</p>
          <AnswerValue value={value} />
        </div>
      ))}
    </div>
  );
}

function SubmissionViewer({ viewer, onClose }: {
  viewer: { loading: boolean; data: SubmissionDetail | null };
  onClose: () => void;
}) {
  const t = useT();
  const data = viewer.data;
  const answers = (data?.submission.answers ?? {}) as Record<string, unknown>;
  const tasks = data?.assignment.tasks ?? [];
  const matchedIds = new Set(tasks.map(t => t.id).filter(Boolean) as string[]);
  const unmatched = Object.entries(answers).filter(([key]) => !matchedIds.has(key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {data?.assignment.title ?? t('studentReport.viewer.title')}
            </h3>
            {data && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('studentReport.viewer.submitted', { date: fmtDate(data.submission.submitted_at) })}
                {data.submission.is_graded && <> · {t('studentReport.viewer.grade', { score: data.submission.score ?? '—', max: data.submission.max_score ?? '—' })}</>}
                {data.submission.is_late && <span className="text-orange-500"> · {t('studentReport.viewer.late')}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {viewer.loading && <p className="text-sm text-muted-foreground">{t('studentReport.viewer.loading')}</p>}

        {data && (
          <>
            {data.submission.file_url && (() => {
              const href = fileHref(data.submission.file_url);
              return href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-brand hover:underline"
                >
                  <Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{data.submission.file_name || t('studentReport.homework.file')}
                </a>
              ) : (
                <span className="inline-block text-sm text-muted-foreground"><Paperclip className="inline h-3.5 w-3.5 mr-1 align-[-2px]" aria-hidden="true" />{data.submission.file_name || t('studentReport.homework.file')}</span>
              );
            })()}

            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task, i) => (
                  <div key={task.id ?? i} className="border border-border rounded-lg p-3 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {i + 1}. {task.title || task.task_type || t('studentReport.viewer.task')}
                        {task.points != null && <span className="ml-1.5 text-xs text-muted-foreground font-normal">{t('studentReport.viewer.points', { count: task.points })}</span>}
                      </p>
                      {task.question && (
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-0.5 line-clamp-4">{task.question}</p>
                      )}
                    </div>
                    <TaskAnswer answer={task.id != null ? answers[task.id] : undefined} />
                  </div>
                ))}
              </div>
            ) : (
              <TaskAnswer answer={data.submission.answers} />
            )}

            {unmatched.length > 0 && tasks.length > 0 && (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <p className="text-xs text-muted-foreground">{t('studentReport.viewer.otherData')}</p>
                {unmatched.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{key}</p>
                    <AnswerValue value={value} />
                  </div>
                ))}
              </div>
            )}

            {data.submission.feedback && (
              <div className="bg-gray-50 dark:bg-muted border border-border rounded-lg p-3">
                <p className="text-xs font-medium text-foreground mb-1">{t('studentReport.viewer.feedback')}</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{data.submission.feedback}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

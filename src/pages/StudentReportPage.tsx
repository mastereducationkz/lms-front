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

/**
 * Полный отчёт об успеваемости студента для куратора / хэд-куратора /
 * хэд-тичера / админа. Все разделы раскрываются до деталей: домашние задания —
 * до сабмишена (фидбэк, файл, даты), еженедельные тесты — до фидбэка платформ,
 * квизы — до отдельных попыток. Доступ проверяется на сервере.
 */

// ─── Formatting helpers ───────────────────────────────────────────────────────

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtPct = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : `${v.toFixed(1).replace('.', ',')}%`;

const fmtBand = (v: number | null | undefined): string =>
  v === null || v === undefined ? '—' : v.toFixed(1).replace('.', ',');

const fileHref = (fileUrl: string): string =>
  fileUrl.startsWith('http') ? fileUrl : `${API_BASE_URL}${fileUrl}`;

const PDF_SECTIONS: { key: string; label: string }[] = [
  { key: 'homework', label: 'Домашние задания' },
  { key: 'weekly', label: 'Еженедельные SAT/NUET тесты' },
  { key: 'ielts', label: 'Еженедельные IELTS тесты' },
  { key: 'bluebook', label: 'Bluebook и официальные экзамены' },
  { key: 'quizzes', label: 'Квизы по курсам' },
  { key: 'courses', label: 'Прогресс в курсах' },
  { key: 'attendance', label: 'Посещаемость' },
  { key: 'activity', label: 'Дополнительная активность' },
];

const HW_STATUS: Record<ReportHomeworkItem['status'], { label: string; cls: string }> = {
  graded: { label: 'Проверено', cls: 'bg-green-50 text-green-700 border-green-200' },
  submitted: { label: 'На проверке', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  not_submitted: { label: 'Не сдано', cls: 'bg-red-50 text-red-600 border-red-200' },
};

// ─── Small building blocks ────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function FeedbackText({ text }: { text: string }) {
  return (
    <div className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
      {text}
    </div>
  );
}

function ExpandChevron({ open }: { open: boolean }) {
  return <span className="text-gray-400 text-xs select-none">{open ? '▲' : '▼'}</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSections, setExportSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PDF_SECTIONS.map(s => [s.key, true])),
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
        setError(status === 403 ? 'Нет доступа к отчёту этого студента' : 'Не удалось загрузить отчёт');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [studentId]);

  const handleDownloadPdf = async () => {
    if (!report) return;
    const chosen = PDF_SECTIONS.filter(s => exportSections[s.key]).map(s => s.key);
    if (chosen.length === 0) return;
    setDownloading(true);
    try {
      await downloadStudentReportPdf(report.student.id, report.student.name, {
        sections: chosen.length === PDF_SECTIONS.length ? undefined : chosen,
        includeFeedback: exportFeedback,
      });
      setExportOpen(false);
    } catch {
      setError('Не удалось скачать PDF');
    } finally {
      setDownloading(false);
    }
  };

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
      <div className="p-6 max-w-[1000px] mx-auto space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto text-center">
        <p className="text-red-500">{error ?? 'Отчёт не найден'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>Назад</Button>
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
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
            <th className="py-2 pr-3 font-medium">Неделя</th>
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
                  className={`border-b border-gray-50 ${hasFeedback ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                  onClick={() => hasFeedback && setOpenWeek(openWeek === key ? null : key)}
                >
                  <td className="py-2 pr-3 text-gray-900">{w.week_label}</td>
                  <td className="py-2 pr-3">{side(w.math)}</td>
                  <td className="py-2 pr-3">{side(w.verbal)}</td>
                  <td className="py-2 text-right">{hasFeedback && <ExpandChevron open={openWeek === key} />}</td>
                </tr>
                {openWeek === key && hasFeedback && (
                  <tr key={`${key}-fb`}>
                    <td colSpan={4} className="py-2 space-y-2">
                      {w.math?.feedback && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Фидбэк — Math</p>
                          <FeedbackText text={w.math.feedback} />
                        </div>
                      )}
                      {w.verbal?.feedback && (
                        <div>
                          <p className="text-xs font-medium text-gray-700 mb-1">Фидбэк — Verbal</p>
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
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-5">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
        ← Назад
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">Отчёт об успеваемости — {student.name}</h1>
          <p className="text-sm text-gray-400">{student.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {student.groups.map(g => (
              <Badge key={g.id} className="bg-gray-100 text-gray-600 border-gray-200 text-xs font-normal">
                {g.name} · с {fmtDate(g.joined_at)}
              </Badge>
            ))}
          </div>
        </div>
        <Button onClick={() => setExportOpen(true)}>Скачать PDF</Button>
      </div>

      {weekly_tests.errors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          Часть данных внешних платформ временно недоступна: {weekly_tests.errors.join('; ')}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Посещаемость', value: fmtPct(attendance.attendance_pct), sub: `${attendance.attended} из ${attendance.marked_total}` },
          { label: 'Домашние задания', value: `${homework.graded}/${homework.assigned}`, sub: `${homework.earned_score} из ${homework.max_score} баллов` },
          { label: 'Средний квиз', value: fmtPct(avgQuizPct), sub: `${quizzes.reduce((s, c) => s + c.completed_attempts, 0)} попыток` },
          { label: 'Баллы активности', value: String(activity.points_total), sub: `${activity.daily_questions_completed} ежедневных заданий` },
        ].map(s => (
          <div key={s.label} className="p-4 bg-white border border-gray-200 rounded-xl">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Homework */}
      <Section
        title="Домашние задания"
        subtitle={`Назначено ${homework.assigned} · Сдано ${homework.submitted} · Проверено ${homework.graded}. Нажмите на строку, чтобы раскрыть детали сабмишена.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">Задание</th>
                <th className="py-2 pr-3 font-medium">Срок</th>
                <th className="py-2 pr-3 font-medium">Балл</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
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
                      className={`border-b border-gray-50 ${expandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                      onClick={() => expandable && setOpenHw(open ? null : item.id)}
                    >
                      <td className="py-2 pr-3 text-gray-900">{item.title}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(item.due_date)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        {item.score !== null ? `${item.score} из ${item.max_score ?? '—'}` : `— из ${item.max_score ?? '—'}`}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge className={`${st.cls} text-xs font-normal`}>{st.label}</Badge>
                        {item.submission?.is_late && (
                          <Badge className="ml-1 bg-orange-50 text-orange-600 border-orange-200 text-xs font-normal">Позже срока</Badge>
                        )}
                      </td>
                      <td className="py-2 text-right">{expandable && <ExpandChevron open={open} />}</td>
                    </tr>
                    {open && item.submission && (
                      <tr key={`${item.id}-detail`}>
                        <td colSpan={5} className="py-2">
                          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
                            <p>Сдано: <span className="text-gray-900">{fmtDate(item.submitted_at)}</span>
                              {item.submission.graded_at && <> · Проверено: <span className="text-gray-900">{fmtDate(item.submission.graded_at)}</span></>}
                            </p>
                            {item.submission.feedback && (
                              <p className="whitespace-pre-wrap">Фидбэк: <span className="text-gray-900">{item.submission.feedback}</span></p>
                            )}
                            {item.submission.file_url && (
                              <a
                                href={fileHref(item.submission.file_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                📎 {item.submission.file_name || 'Файл сабмишена'}
                              </a>
                            )}
                            <button
                              type="button"
                              className="block text-blue-600 hover:underline"
                              onClick={e => { e.stopPropagation(); openSubmission(item.submission!.id); }}
                            >
                              Открыть содержимое сабмишена →
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
        <Section title="Еженедельные SAT Practice" subtitle="Данные платформы sat.mastereducation.kz. Нажмите на строку с фидбэком, чтобы раскрыть его.">
          {weeklyTable(weekly_tests.sat, 'sat')}
        </Section>
      )}
      {weekly_tests.nuet.length > 0 && (
        <Section title="Еженедельные NUET тесты" subtitle="Данные платформы nuet.mastereducation.kz">
          {weeklyTable(weekly_tests.nuet, 'nuet')}
        </Section>
      )}

      {/* Weekly IELTS */}
      {weekly_tests.ielts.length > 0 && (
        <Section title="Еженедельные IELTS тесты" subtitle="Данные платформы ielts.mastereducation.kz. Нажмите на строку, чтобы раскрыть фидбэк.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Неделя</th>
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
                        className={`border-b border-gray-50 ${parts.length ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        onClick={() => parts.length && setOpenWeek(open ? null : key)}
                      >
                        <td className="py-2 pr-3 text-gray-900">{w.week_label}</td>
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
                                <p className="text-xs font-medium text-gray-700 mb-1">{p.label}</p>
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
      <Section title="Bluebook и официальные экзамены">
        {bluebook.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Тест</th>
                  <th className="py-2 pr-3 font-medium">Дата</th>
                  <th className="py-2 pr-3 font-medium">Общий</th>
                  <th className="py-2 pr-3 font-medium">Verbal</th>
                  <th className="py-2 pr-3 font-medium">Math</th>
                </tr>
              </thead>
              <tbody>
                {bluebook.map(b => (
                  <tr key={`${b.test_number}-${b.taken_at}`} className="border-b border-gray-50">
                    <td className="py-2 pr-3 text-gray-900">Practice Test {b.test_number}</td>
                    <td className="py-2 pr-3">{b.taken_at ? fmtDate(b.taken_at) : 'входной'}</td>
                    <td className="py-2 pr-3 font-medium">{b.total}</td>
                    <td className="py-2 pr-3">{b.verbal}</td>
                    <td className="py-2 pr-3">{b.math}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Результатов Bluebook нет.</p>
        )}
        <div className="text-xs text-gray-500 space-y-0.5">
          {exams.results.length > 0 ? exams.results.map(r => (
            <p key={`${r.exam_type}-${r.test_date}`}>
              Официальный {r.exam_type.toUpperCase()}: <span className="font-medium text-gray-900">{r.total_score}</span> ({fmtDate(r.test_date)}, {r.status})
            </p>
          )) : <p>Официальные результаты экзаменов в LMS не зарегистрированы.</p>}
          {exams.sat_planned_date && <p>Запланированная дата SAT: <span className="font-medium text-gray-900">{fmtDate(exams.sat_planned_date)}</span></p>}
          {exams.ielts_planned_date && <p>Запланированная дата IELTS: <span className="font-medium text-gray-900">{fmtDate(exams.ielts_planned_date)}</span></p>}
        </div>
      </Section>

      {/* Quizzes */}
      {quizzes.map(course => (
        <Section
          key={course.course_id}
          title={`Квизы: ${course.course_title}`}
          subtitle={`Попыток ${course.total_attempts} · Завершено ${course.completed_attempts} · Средний результат ${fmtPct(course.average_pct)}. Нажмите на раздел, чтобы увидеть попытки.`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">Раздел</th>
                  <th className="py-2 pr-3 font-medium">Попыток</th>
                  <th className="py-2 pr-3 font-medium">Средний</th>
                  <th className="py-2 pr-3 font-medium">Лучший</th>
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
                        className="border-b border-gray-50 cursor-pointer hover:bg-gray-50"
                        onClick={() => setOpenQuiz(open ? null : key)}
                      >
                        <td className="py-2 pr-3 text-gray-900">{section.lesson_title}</td>
                        <td className="py-2 pr-3">{section.attempts}</td>
                        <td className="py-2 pr-3">{fmtPct(section.average_pct)}</td>
                        <td className="py-2 pr-3">{fmtPct(section.best_pct)}</td>
                        <td className="py-2 text-right"><ExpandChevron open={open} /></td>
                      </tr>
                      {open && (
                        <tr key={`${key}-detail`}>
                          <td colSpan={5} className="py-2">
                            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs text-gray-600 space-y-1">
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
      <Section title="Прогресс в курсах">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="py-2 pr-3 font-medium">Курс</th>
                <th className="py-2 pr-3 font-medium">Шаги</th>
                <th className="py-2 pr-3 font-medium">Прогресс</th>
                <th className="py-2 pr-3 font-medium">Учебное время</th>
                <th className="py-2 pr-3 font-medium">Последняя активность</th>
              </tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.course_id} className="border-b border-gray-50">
                  <td className="py-2 pr-3 text-gray-900">{c.course_title}</td>
                  <td className="py-2 pr-3">{c.completed_steps} из {c.total_steps}</td>
                  <td className="py-2 pr-3 font-medium">{fmtPct(c.completion_pct)}</td>
                  <td className="py-2 pr-3">{Math.floor(c.time_spent_minutes / 60)} ч {c.time_spent_minutes % 60} мин</td>
                  <td className="py-2 pr-3">{fmtDate(c.last_activity_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Attendance */}
      <Section
        title="Посещаемость"
        subtitle={`Занятий с отметкой ${attendance.marked_total} · Присутствие ${fmtPct(attendance.attendance_pct)} · Опозданий ${attendance.late} · Пропусков ${attendance.absent}`}
      >
        {attendance.absences.length > 0 && (
          <div className="text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Пропуски</p>
            {attendance.absences.map((a, i) => <p key={i}>{fmtDate(a.date)} — {a.title}</p>)}
          </div>
        )}
        {attendance.lates.length > 0 && (
          <div className="text-xs text-gray-600">
            <p className="font-medium text-gray-700 mb-1">Опоздания</p>
            {attendance.lates.map((a, i) => <p key={i}>{fmtDate(a.date)} — {a.title}</p>)}
          </div>
        )}
        {attendance.marked_total === 0 && <p className="text-sm text-gray-400">Данных о посещаемости нет.</p>}
      </Section>

      {/* Activity */}
      <Section title="Дополнительная активность">
        <div className="text-sm text-gray-600 space-y-1">
          <p>Выполнено ежедневных заданий: <span className="font-medium text-gray-900">{activity.daily_questions_completed}</span></p>
          <p>Всего баллов активности: <span className="font-medium text-gray-900">{activity.points_total}</span></p>
          <div className="text-xs text-gray-500 mt-1">
            {Object.entries(activity.points_by_reason).sort((a, b) => b[1] - a[1]).map(([reason, pts]) => (
              <p key={reason}>{{ course_quiz: 'Квизы в курсах', homework: 'Домашние задания', assignment: 'Задания', daily_questions: 'Ежедневные вопросы' }[reason] ?? reason}: {pts}</p>
            ))}
          </div>
        </div>
      </Section>

      <p className="text-xs text-gray-300 text-center pb-4">Отчёт сформирован {fmtDate(report.generated_at)}</p>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !downloading && setExportOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Экспорт отчёта в PDF</h3>
              <p className="text-xs text-gray-400 mt-0.5">Выберите разделы, которые войдут в документ.</p>
            </div>
            <div className="space-y-2">
              {PDF_SECTIONS.map(section => (
                <label key={section.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={exportSections[section.key]}
                    onChange={e => setExportSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  {section.label}
                </label>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={exportFeedback}
                  onChange={e => setExportFeedback(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Включить обратную связь по еженедельным тестам
              </label>
              <p className="text-[11px] text-gray-400 mt-1 ml-6">Подробные разборы заметно увеличивают объём документа.</p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" disabled={downloading} onClick={() => setExportOpen(false)}>
                Отмена
              </Button>
              <Button
                size="sm"
                disabled={downloading || PDF_SECTIONS.every(s => !exportSections[s.key])}
                onClick={handleDownloadPdf}
              >
                {downloading ? 'Формируем…' : 'Скачать PDF'}
              </Button>
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
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') {
    return <p className="text-sm text-gray-700">{value ? '✓ Выполнено' : '— Не выполнено'}</p>;
  }
  if (typeof value === 'string') {
    if (/^(https?:\/\/|\/)/.test(value) && /\.(png|jpe?g|gif|webp|pdf|mp3|m4a|ogg|wav|webm|docx?|xlsx?)([?#]|$)/i.test(value)) {
      return (
        <a href={fileHref(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">
          📎 {value.split('/').pop()}
        </a>
      );
    }
    return <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{value}</p>;
  }
  if (typeof value === 'number') return <p className="text-sm text-gray-800">{String(value)}</p>;
  return (
    <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded p-2 overflow-x-auto">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

const ANSWER_FIELD_LABELS: Record<string, string> = {
  text_response: 'Ответ',
  text: 'Ответ',
  file_url: 'Файл',
  screenshot_url: 'Скриншот',
  url: 'Ссылка',
  completed: 'Статус',
  verbal_score: 'Verbal',
  math_score: 'Math',
};

function TaskAnswer({ answer }: { answer: unknown }) {
  if (answer === null || answer === undefined) {
    return <p className="text-sm text-gray-400">Ответа нет</p>;
  }
  if (typeof answer !== 'object' || Array.isArray(answer)) {
    return <AnswerValue value={answer} />;
  }
  const entries = Object.entries(answer as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return <p className="text-sm text-gray-400">Ответа нет</p>;
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] uppercase tracking-wide text-gray-400">{ANSWER_FIELD_LABELS[key] ?? key}</p>
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
  const data = viewer.data;
  const answers = (data?.submission.answers ?? {}) as Record<string, unknown>;
  const tasks = data?.assignment.tasks ?? [];
  const matchedIds = new Set(tasks.map(t => t.id).filter(Boolean) as string[]);
  const unmatched = Object.entries(answers).filter(([key]) => !matchedIds.has(key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {data?.assignment.title ?? 'Сабмишен'}
            </h3>
            {data && (
              <p className="text-xs text-gray-400 mt-0.5">
                Сдано {fmtDate(data.submission.submitted_at)}
                {data.submission.is_graded && <> · Оценка: {data.submission.score ?? '—'} из {data.submission.max_score ?? '—'}</>}
                {data.submission.is_late && <span className="text-orange-500"> · позже срока</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">✕</button>
        </div>

        {viewer.loading && <p className="text-sm text-gray-400">Загружаем…</p>}

        {data && (
          <>
            {data.submission.file_url && (
              <a
                href={fileHref(data.submission.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-blue-600 hover:underline"
              >
                📎 {data.submission.file_name || 'Файл сабмишена'}
              </a>
            )}

            {tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.map((task, i) => (
                  <div key={task.id ?? i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {i + 1}. {task.title || task.task_type || 'Задание'}
                        {task.points != null && <span className="ml-1.5 text-xs text-gray-400 font-normal">({task.points} б.)</span>}
                      </p>
                      {task.question && (
                        <p className="text-xs text-gray-500 whitespace-pre-wrap mt-0.5 line-clamp-4">{task.question}</p>
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
              <div className="border border-gray-100 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400">Прочие данные сабмишена</p>
                {unmatched.map(([key, value]) => (
                  <div key={key}>
                    <p className="text-[11px] uppercase tracking-wide text-gray-400">{key}</p>
                    <AnswerValue value={value} />
                  </div>
                ))}
              </div>
            )}

            {data.submission.feedback && (
              <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-1">Фидбэк</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.submission.feedback}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

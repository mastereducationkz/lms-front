import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  getStudentReport,
  downloadStudentReportPdf,
  API_BASE_URL,
  type StudentReport,
  type ReportHomeworkItem,
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
  const [openHw, setOpenHw] = useState<number | null>(null);
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
    setDownloading(true);
    try {
      await downloadStudentReportPdf(report.student.id, report.student.name);
    } catch {
      setError('Не удалось скачать PDF');
    } finally {
      setDownloading(false);
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
        <Button onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? 'Формируем…' : 'Скачать PDF'}
        </Button>
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
    </div>
  );
}

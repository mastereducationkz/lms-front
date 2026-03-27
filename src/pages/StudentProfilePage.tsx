import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  event_id: number;
  event_title: string;
  event_date: string;
  status: string;
  activity_score: number | null;
}

interface HomeworkRecord {
  submission_id: number;
  assignment_id: number;
  assignment_title: string;
  score: number | null;
  max_score: number;
  is_graded: boolean;
  is_late: boolean;
  feedback: string | null;
  submitted_at: string | null;
  graded_at: string | null;
}

interface LmsLesson {
  lesson_id: number;
  lesson_title: string | null;
  status: string;
  completion_percentage: number;
  last_accessed: string | null;
}

interface LmsCourse {
  course_id: number;
  course_name: string | null;
  status: string;
  completion_percentage: number;
  total_lessons: number;
  completed_lessons: number;
  avg_completion: number;
  last_accessed: string | null;
  lessons: LmsLesson[];
}

interface StudentProfile {
  student: {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    created_at: string | null;
    last_activity_date: string | null;
    daily_streak: number;
    assignment_zero_completed: boolean;
  };
  groups: Array<{ id: number; name: string }>;
  assignment_zero: Record<string, any> | null;
  attendance: {
    total: number;
    attended: number;
    rate: number | null;
    records: AttendanceRecord[];
  };
  homework: {
    submitted: number;
    avg_score: number | null;
    records: HomeworkRecord[];
  };
  lms_progress: {
    overall: number | null;
    courses: LmsCourse[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function attendanceStatusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    attended: { label: 'Был', cls: 'bg-green-100 text-green-700' },
    late: { label: 'Опоздал', cls: 'bg-yellow-100 text-yellow-700' },
    missed: { label: 'Пропустил', cls: 'bg-red-100 text-red-600' },
    absent: { label: 'Отсутствовал', cls: 'bg-gray-100 text-gray-500' },
    registered: { label: 'Зарегистрирован', cls: 'bg-blue-100 text-blue-600' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function scoreColor(score: number | null, max: number) {
  if (score === null) return 'text-gray-400';
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return 'text-green-700';
  if (pct >= 0.5) return 'text-yellow-700';
  return 'text-red-600';
}

function lmsStatusDot(status: string) {
  if (status === 'completed') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
  if (status === 'in_progress') return <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />;
}

function ScoreBar({ value, pct }: { value: number; pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-blue-500' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-sm text-gray-600">{pct}%</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'homework' | 'lms'>('overview');
  const [expandedCourse, setExpandedCourse] = useState<number | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    apiClient.getStudentProfile(Number(studentId))
      .then(data => { setProfile(data); setLoading(false); })
      .catch(e => { setError(e?.response?.data?.detail ?? 'Ошибка загрузки'); setLoading(false); });
  }, [studentId]);

  if (loading) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 max-w-[1000px] mx-auto text-center">
        <p className="text-red-500">{error ?? 'Студент не найден'}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    );
  }

  const { student, groups, assignment_zero: az, attendance, homework, lms_progress } = profile;

  const tabs = [
    { id: 'overview', label: 'Обзор' },
    { id: 'attendance', label: `Посещаемость (${attendance.attended}/${attendance.total})` },
    { id: 'homework', label: `Домашние задания (${homework.submitted})` },
    { id: 'lms', label: 'LMS прогресс' },
  ] as const;

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-gray-400 hover:text-gray-700 transition-colors flex items-center gap-1">
        ← Назад к журналу
      </button>

      {/* Student card */}
      <div className="flex items-start gap-4 p-5 bg-white border border-gray-200 rounded-xl">
        {student.avatar_url ? (
          <img src={student.avatar_url} className="w-14 h-14 rounded-full object-cover" alt="" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-xl font-semibold text-gray-500">
            {student.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">{student.name}</h1>
          <p className="text-sm text-gray-400">{student.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {groups.map(g => (
              <Badge key={g.id} className="bg-gray-100 text-gray-600 border-gray-200 text-xs font-normal">{g.name}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs text-gray-400">
          <span>Стрик: <span className="font-medium text-gray-700">{student.daily_streak} дн.</span></span>
          <span>Последняя активность: <span className="font-medium text-gray-700">{formatDate(student.last_activity_date)}</span></span>
          <span>Зарегистрирован: <span className="font-medium text-gray-700">{formatDate(student.created_at)}</span></span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Посещаемость',
            value: attendance.rate !== null ? `${attendance.rate}%` : '—',
            sub: `${attendance.attended} из ${attendance.total}`,
            color: attendance.rate !== null && attendance.rate >= 80 ? 'text-green-700' : attendance.rate !== null && attendance.rate >= 60 ? 'text-yellow-700' : 'text-red-600',
          },
          {
            label: 'LMS прогресс',
            value: lms_progress.overall !== null ? `${lms_progress.overall}%` : '—',
            sub: `${lms_progress.courses.length} курс(а)`,
            color: 'text-blue-700',
          },
          {
            label: 'Домашних работ',
            value: String(homework.submitted),
            sub: homework.avg_score !== null ? `Ср. балл: ${homework.avg_score}` : 'Нет оценок',
            color: 'text-gray-800',
          },
          {
            label: 'Assignment Zero',
            value: student.assignment_zero_completed ? 'Сдано' : az ? 'Черновик' : 'Не начато',
            sub: az ? (az.sat_target_date ? `SAT: ${az.sat_target_date}` : az.ielts_target_date ? `IELTS: ${az.ielts_target_date}` : '') : '',
            color: student.assignment_zero_completed ? 'text-green-700' : az ? 'text-yellow-700' : 'text-gray-400',
          },
        ].map(stat => (
          <div key={stat.label} className="p-4 bg-white border border-gray-200 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
            <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {!az ? (
            <div className="p-8 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
              Assignment Zero не заполнено
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Personal info */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Личные данные</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    ['Полное имя', az.full_name],
                    ['Телефон', az.phone_number],
                    ['Тел. родителя', az.parent_phone_number],
                    ['Telegram', az.telegram_id],
                    ['Email', az.email],
                    ['College Board account', az.college_board_email],
                    ['College Board password', az.college_board_password],
                    ['Дата рождения', az.birthday_date],
                    ['Город', az.city],
                    ['Тип школы', az.school_type],
                    ['Группа', az.group_name],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex gap-2">
                      <dt className="text-gray-400 w-32 shrink-0">{label}</dt>
                      <dd className="text-gray-800 font-medium break-all">{value as string}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* SAT / IELTS */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {az.sat_target_date ? 'SAT информация' : 'IELTS информация'}
                </h3>
                {az.sat_target_date ? (
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Дата экзамена', az.sat_target_date],
                      ['Сдавал раньше', az.has_passed_sat_before ? 'Да' : 'Нет'],
                      ['Предыдущий балл', az.previous_sat_score],
                      ['Последний практик', az.recent_practice_test_score],
                      ['Bluebook Test 5', az.bluebook_practice_test_5_score],
                    ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                      <div key={label as string} className="flex gap-2">
                        <dt className="text-gray-400 w-36 shrink-0">{label}</dt>
                        <dd className="text-gray-800 font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : az.ielts_target_date ? (
                  <dl className="space-y-2 text-sm">
                    {[
                      ['Дата экзамена', az.ielts_target_date],
                      ['Сдавал раньше', az.has_passed_ielts_before ? 'Да' : 'Нет'],
                      ['Предыдущий балл', az.previous_ielts_score],
                      ['Цель', az.ielts_target_score],
                    ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                      <div key={label as string} className="flex gap-2">
                        <dt className="text-gray-400 w-36 shrink-0">{label}</dt>
                        <dd className="text-gray-800 font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-gray-400">Нет данных</p>
                )}

                {/* Self-assessment scores */}
                {az.sat_target_date && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Самооценка (1–5)</h4>
                    <div className="space-y-1">
                      {[
                        ['Пунктуация', az.grammar_punctuation],
                        ['Noun Clauses', az.grammar_noun_clauses],
                        ['Relative Clauses', az.grammar_relative_clauses],
                        ['Формы глаголов', az.grammar_verb_forms],
                        ['Word in Context', az.reading_word_in_context],
                        ['Структура текста', az.reading_text_structure],
                        ['Central Ideas', az.reading_central_ideas],
                      ].filter(([, v]) => v !== null && v !== undefined).map(([label, value]) => (
                        <div key={label as string} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-sm ${n <= Number(value) ? 'bg-blue-500' : 'bg-gray-100'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-gray-500">{value}/5</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Attendance */}
      {activeTab === 'attendance' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {attendance.records.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Нет записей посещаемости</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Урок / событие</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Дата</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Активность</th>
                </tr>
              </thead>
              <tbody>
                {attendance.records.map(r => (
                  <tr key={r.event_id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-800">{r.event_title}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(r.event_date)}</td>
                    <td className="px-4 py-3">{attendanceStatusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.activity_score !== null ? `${r.activity_score}/10` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Homework */}
      {activeTab === 'homework' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {homework.records.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Нет сданных домашних заданий</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Задание</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Балл</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Сдано</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Статус</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Обратная связь</th>
                </tr>
              </thead>
              <tbody>
                {homework.records.map(r => (
                  <tr key={r.submission_id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-800 font-medium">{r.assignment_title}</td>
                    <td className="px-4 py-3">
                      {r.is_graded && r.score !== null ? (
                        <span className={`font-medium ${scoreColor(r.score, r.max_score)}`}>
                          {r.score}/{r.max_score}
                        </span>
                      ) : (
                        <span className="text-gray-400">Не проверено</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDate(r.submitted_at)}
                      {r.is_late && <span className="ml-1 text-xs text-red-500">(опоздание)</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_graded
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Проверено</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">Ожидание</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{r.feedback ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: LMS */}
      {activeTab === 'lms' && (
        <div className="space-y-3">
          {lms_progress.courses.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 bg-white border border-gray-200 rounded-xl">
              Нет данных о прогрессе
            </div>
          ) : (
            lms_progress.courses.map(course => (
              <div key={course.course_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                  onClick={() => course.lessons.length > 0 && setExpandedCourse(expandedCourse === course.course_id ? null : course.course_id)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900 text-left">{course.course_name ?? `Курс ${course.course_id}`}</p>
                      <p className="text-xs text-gray-400 text-left">
                        {course.total_lessons > 0
                          ? `${course.completed_lessons}/${course.total_lessons} уроков завершено`
                          : `Статус: ${course.status === 'completed' ? 'Завершён' : course.status === 'in_progress' ? 'В процессе' : 'Не начат'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBar value={course.avg_completion} pct={course.avg_completion} />
                    {course.lessons.length > 0 && (
                      <span className="text-gray-400 text-xs">{expandedCourse === course.course_id ? '▲' : '▼'}</span>
                    )}
                  </div>
                </button>

                {expandedCourse === course.course_id && course.lessons.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Урок</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Статус</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Прогресс</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">Последний доступ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.lessons.map(l => (
                          <tr key={l.lesson_id} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-800 flex items-center gap-2">
                              {lmsStatusDot(l.status)}
                              {l.lesson_title ?? `Урок ${l.lesson_id}`}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs font-medium ${l.status === 'completed' ? 'text-green-600' : l.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'}`}>
                                {l.status === 'completed' ? 'Завершён' : l.status === 'in_progress' ? 'В процессе' : 'Не начат'}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${l.status === 'completed' ? 'bg-green-500' : 'bg-blue-400'}`}
                                    style={{ width: `${l.completion_percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500">{l.completion_percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(l.last_accessed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

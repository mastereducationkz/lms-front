import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { CollegeBoardPasswordReveal } from '../components/CollegeBoardPasswordReveal';
import { collegeBoardPasswordDisplay } from '../lib/assignmentZeroCollegeBoard';
import { checkpointLabel, lessonsLabel, type CheckpointSummary } from '../lib/completion';
import UserAvatar from '@/components/mascot/UserAvatar';
import StudentAchievementsSection from '@/components/achievements/StudentAchievementsSection';
import { formatDate as formatDay, type TFunction } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentCard';

// Older backends may not send `can_reveal_college_board_password` yet; on this
// page (reachable by curators generally, not just admins) treat that as "no".
const CAN_REVEAL_DEFAULT = false;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  event_id: number;
  event_title: string;
  event_topic: string | null;
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
  lessons_done?: number;
  lessons_total?: number;
  checkpoints?: CheckpointSummary | null;
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
    mascot?: string | null;
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
    lessons_done?: number;
    lessons_total?: number;
    checkpoints?: CheckpointSummary | null;
    courses: LmsCourse[];
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return formatDay(iso, { day: '2-digit', month: 'short', year: 'numeric' });
}

function attendanceStatusBadge(status: string, t: TFunction) {
  const map: Record<string, { label: string; cls: string }> = {
    attended: { label: t('studentCard.attendance.attended'), cls: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300' },
    late: { label: t('studentCard.attendance.late'), cls: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300' },
    missed: { label: t('studentCard.attendance.missed'), cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300' },
    absent: { label: t('studentCard.attendance.absent'), cls: 'bg-muted text-muted-foreground' },
    registered: { label: t('studentCard.attendance.registered'), cls: 'bg-brand-subtle text-brand' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function scoreColor(score: number | null, max: number) {
  if (score === null) return 'text-muted-foreground';
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.8) return 'text-green-700 dark:text-green-300';
  if (pct >= 0.5) return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-300';
}

function lmsStatusLabel(status: string, t: TFunction) {
  if (status === 'completed') return t('studentCard.lms.completed');
  if (status === 'in_progress') return t('studentCard.lms.inProgress');
  return t('studentCard.lms.notStarted');
}

function lmsStatusDot(status: string) {
  if (status === 'completed') return <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />;
  if (status === 'in_progress') return <span className="w-2 h-2 rounded-full bg-brand inline-block" />;
  return <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />;
}

function ScoreBar({ value, pct }: { value: number; pct: number }) {
  const color = pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-brand-solid' : 'bg-muted-foreground/30';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-sm text-muted-foreground">{pct}%</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StudentProfilePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();
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
      .catch(e => { setError(e?.response?.data?.detail ?? t('studentCard.profile.loadError')); setLoading(false); });
  }, [studentId, t]);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-[1000px] mx-auto text-center">
        <p className="text-red-500">{error ?? t('studentCard.profile.notFound')}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>{t('common.back')}</Button>
      </div>
    );
  }

  const { student, groups, assignment_zero: az, attendance, homework, lms_progress } = profile;

  const tabs = [
    { id: 'overview', label: t('studentCard.tabs.overview') },
    { id: 'attendance', label: t('studentCard.tabs.attendance', { attended: attendance.attended, total: attendance.total }) },
    { id: 'homework', label: t('studentCard.tabs.homework', { count: homework.submitted }) },
    { id: 'lms', label: t('studentCard.tabs.lms') },
  ] as const;

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('studentCard.profile.backToJournal')}
      </button>

      {/* Student card */}
      <div className="flex items-start gap-4 p-5 bg-card border border-border rounded-xl">
        <UserAvatar userId={student.id} name={student.name} avatarUrl={student.avatar_url} mascot={student.mascot} isStudent size={56} />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground">{student.name}</h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {groups.map(g => (
              <Badge key={g.id} className="bg-muted text-muted-foreground border-border text-xs font-normal">{g.name}</Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-right text-xs text-muted-foreground">
          <Button size="sm" className="mb-1" onClick={() => navigate(`/curator/students/${student.id}/report`)}>
            {t('studentCard.profile.report')}
          </Button>
          <span>{t('studentCard.profile.streak')} <span className="font-medium text-foreground">{t('studentCard.profile.streakDays', { count: student.daily_streak })}</span></span>
          <span>{t('studentCard.profile.lastActive')} <span className="font-medium text-foreground">{formatDate(student.last_activity_date)}</span></span>
          <span>{t('studentCard.profile.joined')} <span className="font-medium text-foreground">{formatDate(student.created_at)}</span></span>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 @xl:grid-cols-4 gap-3">
        {[
          {
            label: t('studentCard.stats.attendance'),
            value: attendance.rate !== null ? `${attendance.rate}%` : '—',
            sub: t('studentCard.stats.attendedOf', { attended: attendance.attended, total: attendance.total }),
            color: attendance.rate !== null && attendance.rate >= 80 ? 'text-green-700 dark:text-green-300' : attendance.rate !== null && attendance.rate >= 60 ? 'text-yellow-700 dark:text-yellow-300' : 'text-red-600 dark:text-red-300',
          },
          {
            label: t('studentCard.tabs.lms'),
            value: lms_progress.overall !== null ? `${lms_progress.overall}%` : '—',
            sub: [
              lessonsLabel(lms_progress.lessons_done, lms_progress.lessons_total, locale) || t('studentCard.stats.courses', { count: lms_progress.courses.length }),
              checkpointLabel(lms_progress.checkpoints, locale),
            ].filter(Boolean).join(' · '),
            color: 'text-brand-subtle-foreground',
          },
          {
            label: t('studentCard.stats.homework'),
            value: String(homework.submitted),
            sub: homework.avg_score !== null ? t('studentCard.stats.averageScore', { score: homework.avg_score }) : t('studentCard.stats.noGrades'),
            color: 'text-foreground',
          },
          {
            label: 'Assignment Zero',
            value: student.assignment_zero_completed ? t('studentCard.az.submitted') : az ? t('studentCard.az.draft') : t('studentCard.az.notStarted'),
            sub: az ? (az.sat_target_date ? `SAT: ${az.sat_target_date}` : az.ielts_target_date ? `IELTS: ${az.ielts_target_date}` : '') : '',
            color: student.assignment_zero_completed ? 'text-green-700 dark:text-green-300' : az ? 'text-yellow-700 dark:text-yellow-300' : 'text-muted-foreground',
          },
        ].map(stat => (
          <div key={stat.label} className="p-4 bg-card border border-border rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
            <p className={`text-xl font-semibold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Kasatik Achievements: badges, streak and Stars of the Week (hides itself if unavailable) */}
      <StudentAchievementsSection studentId={student.id} />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
              {t('studentCard.overview.azEmpty')}
            </div>
          ) : (
            <div className="grid @2xl:grid-cols-2 gap-4">
              {/* Personal info */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">{t('studentCard.overview.personal')}</h3>
                <dl className="space-y-2 text-sm">
                  {[
                    [t('studentCard.overview.fullName'), az.full_name],
                    [t('studentCard.overview.phone'), az.phone_number],
                    [t('studentCard.overview.parentPhone'), az.parent_phone_number],
                    ['Telegram', az.telegram_id],
                    ['Email', az.email],
                    ['College Board account', az.college_board_email],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex gap-2">
                      <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
                      <dd className="text-foreground font-medium break-all">{value as string}</dd>
                    </div>
                  ))}
                  {/* This dl otherwise omits rows for falsy fields, so a stored-but-
                      unrevealable password gets the same treatment: no row at all,
                      rather than a label sitting over an empty value. */}
                  {collegeBoardPasswordDisplay(
                    !!az.has_college_board_password,
                    az.can_reveal_college_board_password,
                    CAN_REVEAL_DEFAULT,
                  ) !== 'hidden_no_access' && (
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground w-32 shrink-0">College Board password</dt>
                      <dd className="text-foreground font-medium break-all">
                        <CollegeBoardPasswordReveal
                          userId={student.id}
                          hasPassword={!!az.has_college_board_password}
                          canReveal={az.can_reveal_college_board_password}
                          defaultCanReveal={CAN_REVEAL_DEFAULT}
                        />
                      </dd>
                    </div>
                  )}
                  {[
                    [t('studentCard.overview.birthday'), az.birthday_date],
                    [t('studentCard.overview.city'), az.city],
                    [t('studentCard.overview.schoolType'), az.school_type],
                    [t('studentCard.overview.group'), az.group_name],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex gap-2">
                      <dt className="text-muted-foreground w-32 shrink-0">{label}</dt>
                      <dd className="text-foreground font-medium break-all">{value as string}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* SAT / IELTS */}
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {az.sat_target_date ? t('studentCard.overview.satTitle') : t('studentCard.overview.ieltsTitle')}
                </h3>
                {az.sat_target_date ? (
                  <dl className="space-y-2 text-sm">
                    {[
                      [t('studentCard.overview.examDate'), az.sat_target_date],
                      [t('studentCard.overview.takenBefore'), az.has_passed_sat_before ? t('common.yes') : t('common.no')],
                      [t('studentCard.overview.previousScore'), az.previous_sat_score],
                      [t('studentCard.overview.latestPractice'), az.recent_practice_test_score],
                      ['Bluebook Test 5', az.bluebook_practice_test_5_score],
                    ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                      <div key={label as string} className="flex gap-2">
                        <dt className="text-muted-foreground w-36 shrink-0">{label}</dt>
                        <dd className="text-foreground font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : az.ielts_target_date ? (
                  <dl className="space-y-2 text-sm">
                    {[
                      [t('studentCard.overview.examDate'), az.ielts_target_date],
                      [t('studentCard.overview.takenBefore'), az.has_passed_ielts_before ? t('common.yes') : t('common.no')],
                      [t('studentCard.overview.previousScore'), az.previous_ielts_score],
                      [t('studentCard.overview.targetScore'), az.ielts_target_score],
                    ].filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value]) => (
                      <div key={label as string} className="flex gap-2">
                        <dt className="text-muted-foreground w-36 shrink-0">{label}</dt>
                        <dd className="text-foreground font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('studentCard.overview.noData')}</p>
                )}

                {/* Self-assessment scores */}
                {az.sat_target_date && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t('studentCard.overview.selfAssessment')}</h4>
                    <div className="space-y-1">
                      {[
                        [t('studentCard.overview.punctuation'), az.grammar_punctuation],
                        ['Noun Clauses', az.grammar_noun_clauses],
                        ['Relative Clauses', az.grammar_relative_clauses],
                        [t('studentCard.overview.verbForms'), az.grammar_verb_forms],
                        ['Word in Context', az.reading_word_in_context],
                        [t('studentCard.overview.textStructure'), az.reading_text_structure],
                        ['Central Ideas', az.reading_central_ideas],
                      ].filter(([, v]) => v !== null && v !== undefined).map(([label, value]) => (
                        <div key={label as string} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(n => (
                              <div key={n} className={`w-3 h-3 rounded-sm ${n <= Number(value) ? 'bg-brand-solid' : 'bg-muted'}`} />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{value}/5</span>
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
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {attendance.records.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('studentCard.attendance.empty')}</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-muted border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.attendance.event')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.attendance.date')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.attendance.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.attendance.activity')}</th>
                </tr>
              </thead>
              <tbody>
                {attendance.records.map(r => (
                  <tr key={r.event_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{r.event_topic ? `${r.event_title} — ${r.event_topic}` : r.event_title}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(r.event_date)}</td>
                    <td className="px-4 py-3">{attendanceStatusBadge(r.status, t)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.activity_score !== null ? `${r.activity_score}/10` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* Tab: Homework */}
      {activeTab === 'homework' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {homework.records.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('studentCard.homework.empty')}</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-muted border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.homework.assignment')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.homework.score')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.homework.submitted')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.homework.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">{t('studentCard.homework.feedback')}</th>
                </tr>
              </thead>
              <tbody>
                {homework.records.map(r => (
                  <tr key={r.submission_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground font-medium">{r.assignment_title}</td>
                    <td className="px-4 py-3">
                      {r.is_graded && r.score !== null ? (
                        <span className={`font-medium ${scoreColor(r.score, r.max_score)}`}>
                          {r.score}/{r.max_score}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('studentCard.homework.notGraded')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(r.submitted_at)}
                      {r.is_late && <span className="ml-1 text-xs text-red-500">{t('studentCard.homework.late')}</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_graded
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 font-medium">{t('studentCard.homework.graded')}</span>
                        : <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 font-medium">{t('studentCard.homework.pending')}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{r.feedback ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}

      {/* Tab: LMS */}
      {activeTab === 'lms' && (
        <div className="space-y-3">
          {lms_progress.courses.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
              {t('studentCard.lms.empty')}
            </div>
          ) : (
            lms_progress.courses.map(course => (
              <div key={course.course_id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/60 transition-colors"
                  onClick={() => course.lessons.length > 0 && setExpandedCourse(expandedCourse === course.course_id ? null : course.course_id)}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground text-left">{course.course_name ?? t('studentCard.lms.course', { id: course.course_id })}</p>
                      <p className="text-xs text-muted-foreground text-left">
                        {course.total_lessons > 0
                          ? lessonsLabel(course.lessons_done ?? course.completed_lessons, course.lessons_total ?? course.total_lessons, locale)
                          : t('studentCard.lms.statusLine', { status: lmsStatusLabel(course.status, t) })}
                      </p>
                      {checkpointLabel(course.checkpoints, locale) && (
                        <p className="text-xs text-muted-foreground text-left">{checkpointLabel(course.checkpoints, locale)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ScoreBar value={course.avg_completion} pct={course.avg_completion} />
                    {course.lessons.length > 0 && (
                      <span className="text-muted-foreground text-xs">{expandedCourse === course.course_id ? '▲' : '▼'}</span>
                    )}
                  </div>
                </button>

                {expandedCourse === course.course_id && course.lessons.length > 0 && (
                  <div className="border-t border-border">
                    <div className="overflow-x-auto"><table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-muted">
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('studentCard.lms.lesson')}</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('studentCard.lms.status')}</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('studentCard.lms.progress')}</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('studentCard.lms.lastOpened')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {course.lessons.map(l => (
                          <tr key={l.lesson_id} className="border-t border-border">
                            <td className="px-4 py-2 text-foreground flex items-center gap-2">
                              {lmsStatusDot(l.status)}
                              {l.lesson_title ?? t('studentCard.lms.lessonFallback', { id: l.lesson_id })}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`text-xs font-medium ${l.status === 'completed' ? 'text-green-600 dark:text-green-300' : l.status === 'in_progress' ? 'text-brand' : 'text-muted-foreground'}`}>
                                {lmsStatusLabel(l.status, t)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${l.status === 'completed' ? 'bg-green-500' : 'bg-brand'}`}
                                    style={{ width: `${l.completion_percentage}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{l.completion_percentage}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground text-xs">{formatDate(l.last_accessed)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
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

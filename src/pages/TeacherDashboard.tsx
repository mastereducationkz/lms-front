import { Fragment, useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { sanitizeHtml } from '../lib/safeHtml';
import { Link, useNavigate } from 'react-router-dom';
import { WebinarPayCard, type WebinarPay } from '../components/teacher/WebinarPayCard';
import { lessonPath } from '../lib/lessonLinks';
import apiClient from '../services/api';
import type { TeacherTodayHomework } from '../services/api';
import { toast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatDateTime, formatNumber } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import type { MessageKey } from '../lib/i18n';
import { 
  BookOpen, 
  Users, 
  ClipboardCheck, 
  TrendingUp, 
  Clock,
  CheckCircle,
  Eye,
  Filter,
  Trash2,
  FileText,
  Unlock,
  Activity,
  Target,
  Wallet,
  Copy,
  Trophy,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import MultiTaskSubmission from '../components/assignments/MultiTaskSubmission';
import { SubmissionFileDownloadLink } from '../components/assignments/SubmissionFileDownloadLink';
import { AudioPlayer, isAudioUrl } from '../components/AudioPlayer';
import { safeUploadUrl } from '../lib/mediaUrl';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { WeeklyAwardsHub } from '../components/gamification/WeeklyAwardsHub';
import TodayLessons from '../components/dashboard/TodayLessons';
import InstallAppCard from '../components/pwa/InstallAppCard';
import { CompletionMeta } from '../components/progress/CompletionMeta';
import type { CheckpointSummary } from '../lib/completion';
import '@/lib/i18n/catalogs/teacher';
import '@/lib/i18n/catalogs/teacherDesk';

interface TeacherStats {
  total_courses: number;
  total_students: number;
  active_students: number;
  avg_student_progress: number;
  pending_submissions: number;
  recent_enrollments: number;
  avg_completion_rate: number;
  avg_student_score: number;
  total_submissions: number;
  graded_submissions: number;
  grading_progress: number;
  missing_attendance_reminders?: MissingAttendanceReminder[];
}

interface MissingAttendanceReminder {
  event_id: number;
  title: string;
  group_name: string;
  group_id?: number | null;
  event_date: string;
  expected_students: number;
  recorded_students: number;
}

interface StudentProgress {
  student_id: number;
  student_name: string;
  student_email: string;
  student_avatar: string | null;
  group_name?: string | null;
  group_id?: number | null;
  /** The student's group here is archived (only present with "Archived groups" on). */
  group_is_archived?: boolean;
  /** The student's account is deactivated (only present with "Deactivated students" on). */
  is_inactive?: boolean;
  course_id: number;
  course_title: string;
  current_lesson_id: number | null;
  current_lesson_title: string;
  lesson_progress: number;
  overall_progress: number;
  completed_modules?: number;
  total_modules?: number;
  lessons_done?: number;
  lessons_total?: number;
  checkpoints?: CheckpointSummary | null;
  last_activity: string | null;
}

interface Submission {
  id: number;
  assignment_id: number;
  user_id: number; // student_id
  assignment_title?: string;
  course_title?: string;
  student_name?: string;
  student_email?: string;
  submitted_at: string;
  score?: number;
  max_score?: number;
  is_graded: boolean;
  file_url?: string;
  submitted_file_name?: string;
  answers?: any;
  feedback?: string;
}

interface AutoGradePreviewItem {
  submission_id: number;
  assignment_id: number;
  assignment_title: string;
  student_name: string;
  student_email: string;
  submitted_at: string;
  target_score: number;
}

interface SalaryBreakdownGroup {
  group_id: number
  group_name: string
  lesson_count: number
  amount_tenge: number
  lesson_dates: string[]
  program_start: string | null
  program_end: string | null
}

interface SalaryBreakdownResult {
  period_start: string
  period_end: string
  lesson_rate: number
  individual_rate?: number
  rate_source?: 'crm' | 'override' | 'default'
  level?: string | null
  group_band?: string | null
  reference_rates?: {
    webinar_hourly: number
    office_hours_hourly: number
    trial_hourly: number
  }
  total_lessons: number
  total_amount_tenge: number
  /**
   * The discipline register's deduction for the same days. Kept beside the pay, never inside
   * it: `total_amount_tenge` is what the lessons were worth and does not move because of a
   * fine a head teacher may waive tomorrow. `net_amount_tenge` is what is paid.
   */
  fines_tenge?: number
  fines_late_minutes?: number
  fines_early_minutes?: number
  fines_made_up_minutes?: number
  fines_misses?: number
  /** Findings nobody has priced yet — a missed lesson waits for a head teacher. */
  fines_unpriced?: number
  /** False while the half-month is open: the figure can still move. */
  fines_final?: boolean
  net_amount_tenge?: number
  /** Webinars and office hours: paid lines (inside `total_amount_tenge`) and unpaid ones with why. */
  webinars?: WebinarPay
  groups: SalaryBreakdownGroup[]
  message_text: string
  contacts: {
    telegram: string
    phone: string
    telegram_username_link?: string
    tel_link?: string
  }
}

/** Question types as the API names them → their label. */
const QUESTION_TYPE_LABELS: Record<string, MessageKey> = {
  single_choice: 'teacherDesk.questionType.singleChoice',
  multiple_choice: 'teacherDesk.questionType.multipleChoice',
  short_answer: 'teacherDesk.questionType.shortAnswer',
  fill_blank: 'teacherDesk.questionType.fillBlank',
  text_completion: 'teacherDesk.questionType.textCompletion',
  long_text: 'teacherDesk.questionType.longText',
  media_question: 'teacherDesk.questionType.mediaQuestion',
  media_open_question: 'teacherDesk.questionType.mediaOpenQuestion',
  matching: 'teacherDesk.questionType.matching',
  image_content: 'teacherDesk.questionType.imageContent',
};

/** A translated sentence whose {placeholders} are JSX (a bold word inside the sentence). */
function withParts(template: string, parts: Record<string, ReactNode>): ReactNode[] {
  return template.split(/\{(\w+)\}/).map((piece, i) => (i % 2 ? <Fragment key={i}>{parts[piece]}</Fragment> : piece));
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [ungradedQuizAttempts, setUngradedQuizAttempts] = useState<any[]>([]);
  const [gradedQuizAttempts, setGradedQuizAttempts] = useState<any[]>([]);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [todayHw, setTodayHw] = useState<TeacherTodayHomework | null>(null);
  const [hwSortDir, setHwSortDir] = useState<'desc' | 'asc'>('desc'); // Last assigned: newest first by default
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('pending');
  const [activeGroup, setActiveGroup] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  // Finished cohorts stay reachable: archived groups and deactivated students are
  // opt-in, mirroring the curator journal.
  const [showArchivedGroups, setShowArchivedGroups] = useState(false);
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const studentsQueryKey = useRef('0|0');
  
  // Quiz grading modal state
  const [selectedQuizAttempt, setSelectedQuizAttempt] = useState<any>(null);
  const [isQuizGradeModalOpen, setIsQuizGradeModalOpen] = useState(false);
  const [quizGradeScore, setQuizGradeScore] = useState<number | string>(0);
  const [quizGradeFeedback, setQuizGradeFeedback] = useState<string>('');
  const [isQuizDataLoaded, setIsQuizDataLoaded] = useState(false);

  // Assignment grading modal state
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [gradingScore, setGradingScore] = useState<number | string>('');
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [currentAssignment, setCurrentAssignment] = useState<any>(null);
  const [isAssignmentDataLoaded, setIsAssignmentDataLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoGrading, setIsAutoGrading] = useState(false);
  const [isAutoGradeDialogOpen, setIsAutoGradeDialogOpen] = useState(false);
  const [isAutoGradePreviewLoading, setIsAutoGradePreviewLoading] = useState(false);
  const [autoGradePreview, setAutoGradePreview] = useState<AutoGradePreviewItem[]>([]);
  
  // Weekly Awards Hub state
  const [isWeeklyAwardsOpen, setIsWeeklyAwardsOpen] = useState(false);
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [salaryMonth, setSalaryMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [salaryInterval, setSalaryInterval] = useState<'first_half' | 'second_half' | 'custom'>('second_half');
  const [salaryPeriodStart, setSalaryPeriodStart] = useState<string>('');
  const [salaryPeriodEnd, setSalaryPeriodEnd] = useState<string>('');
  // Empty means "use my rate from the CRM". Typing a number overrides it, which is what
  // recalculating an old period at the rate that applied back then needs.
  const [salaryRate, setSalaryRate] = useState<number | ''>('');
  const [salaryResult, setSalaryResult] = useState<SalaryBreakdownResult | null>(null);
  const [isSalaryLoading, setIsSalaryLoading] = useState(false);

  useEffect(() => {
    if (selectedQuizAttempt) {
      console.log('Selected Quiz Attempt:', selectedQuizAttempt);
      console.log('Quiz Answers:', selectedQuizAttempt.quiz_answers);
      console.log('Quiz Media:', {
        type: selectedQuizAttempt.quiz_media_type,
        url: selectedQuizAttempt.quiz_media_url
      });
    }
  }, [selectedQuizAttempt]);
  // Student progress pagination
  const [studentPage, setStudentPage] = useState(1);
  const studentsPerPage = 10;

  useEffect(() => {
    loadTeacherData();
  }, []);

  const refreshSubmissionsOnly = async () => {
    try {
      const pendingData = await apiClient.getPendingSubmissionsMeta(100, 0);
      const pending = pendingData.pending_submissions || [];
      setPendingSubmissions(pending);
      setStats(prev => prev ? { ...prev, pending_submissions: pendingData.total_pending_count || pending.length } : null);

      const recent = await apiClient.getRecentSubmissions(20);
      setRecentSubmissions(recent);
    } catch (submissionError) {
      console.warn('Failed to refresh submissions:', submissionError);
    }
  };

  const getAssignmentMaxScore = () => currentAssignment?.max_score || selectedSubmission?.max_score || 100;

  const clampAssignmentScore = (value: number, maxScore = getAssignmentMaxScore()) =>
    Math.max(0, Math.min(value, maxScore));

  const clampQuizScore = (value: number) => Math.max(0, Math.min(100, value));

  const handleAssignmentQuickScore = (action: 'max' | 'clear' | 'plus10' | 'minus10') => {
    const maxScore = getAssignmentMaxScore();
    if (action === 'max') {
      setGradingScore(maxScore);
      return;
    }
    if (action === 'clear') {
      setGradingScore('');
      return;
    }
    const current = gradingScore === '' ? 0 : Number(gradingScore);
    const step = Math.max(1, Math.round(maxScore * 0.1));
    const next = action === 'plus10' ? current + step : current - step;
    setGradingScore(clampAssignmentScore(next, maxScore));
  };

  const handleQuizQuickScore = (action: 'max' | 'clear' | 'plus10' | 'minus10') => {
    if (action === 'max') {
      setQuizGradeScore(100);
      return;
    }
    if (action === 'clear') {
      setQuizGradeScore('');
      return;
    }
    const current = quizGradeScore === '' ? 0 : Number(quizGradeScore);
    const next = action === 'plus10' ? current + 10 : current - 10;
    setQuizGradeScore(clampQuizScore(next));
  };

  const applyAssignmentGradeLocally = (submissionId: number, score: number, feedback: string) => {
    const maxScore = getAssignmentMaxScore();
    const wasPending = pendingSubmissions.some(submission => submission.id === submissionId);
    const baseSubmission = selectedSubmission?.id === submissionId
      ? selectedSubmission
      : pendingSubmissions.find(submission => submission.id === submissionId)
        || recentSubmissions.find(submission => submission.id === submissionId);

    if (!baseSubmission) return;

    const gradedSubmission: Submission = {
      ...baseSubmission,
      score,
      max_score: maxScore,
      is_graded: true,
      feedback,
    };

    setPendingSubmissions(prev => prev.filter(submission => submission.id !== submissionId));
    setRecentSubmissions(prev => {
      const withoutCurrent = prev.filter(submission => submission.id !== submissionId);
      return [gradedSubmission, ...withoutCurrent].slice(0, 20);
    });

    if (wasPending) {
      setStats(prev => {
        if (!prev) return prev;
        const gradedSubmissions = prev.graded_submissions + 1;
        const pendingSubmissionsCount = Math.max(0, prev.pending_submissions - 1);
        return {
          ...prev,
          pending_submissions: pendingSubmissionsCount,
          graded_submissions: gradedSubmissions,
          grading_progress: prev.total_submissions > 0
            ? Math.round((gradedSubmissions / prev.total_submissions) * 100)
            : prev.grading_progress,
        };
      });
    }
  };

  const applyQuizGradeLocally = (attemptId: number, score: number, feedback: string) => {
    const sourceAttempt = ungradedQuizAttempts.find(attempt => attempt.id === attemptId)
      || gradedQuizAttempts.find(attempt => attempt.id === attemptId)
      || (selectedQuizAttempt?.quiz_attempt_id === attemptId ? selectedQuizAttempt : null);

    if (!sourceAttempt) return;

    const gradedAttempt = {
      ...sourceAttempt,
      is_graded: true,
      score,
      score_percentage: score,
      feedback,
    };

    setUngradedQuizAttempts(prev => prev.filter(attempt => attempt.id !== attemptId));
    setGradedQuizAttempts(prev => {
      const withoutCurrent = prev.filter(attempt => attempt.id !== attemptId);
      return [gradedAttempt, ...withoutCurrent].slice(0, 20);
    });
  };

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fire all dashboard requests in PARALLEL (they are independent). Running
      // them sequentially made the page wait for the sum of every call; in
      // parallel the wait is just the slowest single call.
      const [
        dashboardRes,
        pendingRes,
        recentRes,
        studentsRes,
        ungradedRes,
        gradedRes,
        todayRes,
      ] = await Promise.allSettled([
        apiClient.getDashboardStats(),
        apiClient.getPendingSubmissionsMeta(100, 0),
        apiClient.getRecentSubmissions(20),
        apiClient.getTeacherStudentsProgress({
          includeArchived: showArchivedGroups,
          includeInactive: showInactiveStudents,
        }),
        apiClient.getUngradedQuizAttempts(),
        apiClient.getGradedQuizAttempts(),
        apiClient.getTeacherTodayHomework(),
      ]);

      setTodayHw(todayRes.status === 'fulfilled' ? (todayRes.value as TeacherTodayHomework) : null);

      const statsAny = (dashboardRes.status === 'fulfilled' ? (dashboardRes.value as any)?.stats : {}) || {};
      const pendingData = pendingRes.status === 'fulfilled' ? pendingRes.value : { pending_submissions: [], total_pending_count: 0 };
      const pending = pendingData.pending_submissions || [];

      const teacherStats: TeacherStats = {
        total_courses: statsAny.total_courses ?? 0,
        total_students: statsAny.total_students ?? 0,
        active_students: statsAny.active_students ?? 0,
        avg_student_progress: statsAny.avg_student_progress ?? 0,
        pending_submissions: pendingData.total_pending_count || pending.length,
        recent_enrollments: statsAny.recent_enrollments ?? 0,
        avg_completion_rate: statsAny.avg_completion_rate ?? 0,
        avg_student_score: statsAny.avg_student_score ?? 0,
        total_submissions: statsAny.total_submissions ?? 0,
        graded_submissions: statsAny.graded_submissions ?? 0,
        grading_progress: statsAny.grading_progress ?? 0,
        missing_attendance_reminders: statsAny.missing_attendance_reminders ?? []
      };

      setStats(teacherStats);
      setPendingSubmissions(pending);
      setRecentSubmissions(recentRes.status === 'fulfilled' ? recentRes.value : []);
      setStudentsProgress(studentsRes.status === 'fulfilled' ? studentsRes.value : []);
      setUngradedQuizAttempts(ungradedRes.status === 'fulfilled' ? ungradedRes.value : []);
      setGradedQuizAttempts(gradedRes.status === 'fulfilled' ? gradedRes.value : []);

      [dashboardRes, pendingRes, recentRes, studentsRes, ungradedRes, gradedRes]
        .filter((r) => r.status === 'rejected')
        .forEach((r) => console.warn('Dashboard load: a request failed:', (r as PromiseRejectedResult).reason));

    } catch (err) {
      setError(t('teacherDesk.dashboard.loadFailed'));
      console.error('Teacher dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!salaryMonth || salaryInterval === 'custom') return;
    const [yearRaw, monthRaw] = salaryMonth.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!year || !month) return;

    const monthStr = String(month).padStart(2, '0');
    const endDay = new Date(year, month, 0).getDate();

    if (salaryInterval === 'first_half') {
      setSalaryPeriodStart(`${year}-${monthStr}-01`);
      setSalaryPeriodEnd(`${year}-${monthStr}-15`);
      return;
    }

    setSalaryPeriodStart(`${year}-${monthStr}-16`);
    setSalaryPeriodEnd(`${year}-${monthStr}-${String(endDay).padStart(2, '0')}`);
  }, [salaryMonth, salaryInterval]);

  const handleGenerateSalaryBreakdown = async () => {
    if (!salaryPeriodStart || !salaryPeriodEnd) {
      toast(t('teacher.payslip.selectPeriod'), 'error');
      return;
    }
    setIsSalaryLoading(true);
    try {
      const res = await apiClient.getTeacherSalaryBreakdown({
        period_start: salaryPeriodStart,
        period_end: salaryPeriodEnd,
        lesson_rate: salaryRate === '' ? undefined : salaryRate,
      });
      setSalaryResult(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('teacherDesk.dashboard.salaryFailed');
      toast(msg, 'error');
    } finally {
      setIsSalaryLoading(false);
    }
  };

  const handleCopySalaryMessage = async () => {
    if (!salaryResult?.message_text) return;
    try {
      await navigator.clipboard.writeText(salaryResult.message_text);
      toast(t('teacher.payslip.copied'), 'success');
    } catch {
      toast(t('teacher.payslip.copyFailed'), 'error');
    }
  };

  const handleOpenTelegramWithText = () => {
    if (!salaryResult?.contacts?.telegram) return;
    const username = salaryResult.contacts.telegram.replace('@', '').trim();
    if (!username) return;
    const hasText = Boolean(salaryResult.message_text?.trim());
    const deepLink = hasText
      ? `tg://resolve?domain=${username}&text=${encodeURIComponent(salaryResult.message_text)}`
      : `tg://resolve?domain=${username}`;
    window.open(deepLink, '_blank');
  };

  const handleGradeSubmission = async (submission: any) => {
    setIsGradingModalOpen(true);
    setSelectedSubmission(submission); // Set basic info immediately
    setIsAssignmentDataLoaded(false); // Reset flag when opening new assignment
    
    // Load draft if exists, otherwise use existing data or defaults
    const draftKey = getAssignmentAutoSaveKey(submission.id);
    const savedDraft = localStorage.getItem(draftKey);
    
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setGradingScore(parsed.score ?? '');
        setGradingFeedback(parsed.feedback || '');
      } catch (e) {
        setGradingScore(submission.score ?? '');
        setGradingFeedback(submission.feedback || '');
      }
    } else {
      setGradingScore(submission.score ?? '');
      setGradingFeedback(submission.feedback || '');
    }

    try {
      // Fetch full assignment details (for max score, content, etc.)
      const assignmentData = await apiClient.getAssignment(String(submission.assignment_id));
      setCurrentAssignment(assignmentData);

      // If it's a multi-task assignment, we need to fetch the submission with full answers
      if (assignmentData.assignment_type === 'multi_task') {
        const fullSubmissionData = await apiClient.getSubmission(
          String(submission.assignment_id),
          String(submission.id)
        );
        // Merge with existing data to ensure all fields are present
        setSelectedSubmission(prev => ({ ...prev, ...fullSubmissionData }));
      }
      
      // Set flag after data is loaded
      setTimeout(() => setIsAssignmentDataLoaded(true), 100);
    } catch (error) {
      console.error('Failed to load assignment/submission details:', error);
      toast(t('teacherDesk.dashboard.loadDetailsFailed'), 'error');
      handleCloseGradingModal(); // Close modal if data fails to load
    }
  };

  const handleSubmitGrade = async () => {
    if (!selectedSubmission || !currentAssignment) return;

    // Validation
    if (gradingScore === '' || gradingScore === null || gradingScore === undefined) {
      toast(t('teacherDesk.dashboard.enterGradeScore'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.gradeSubmission(
        String(selectedSubmission.assignment_id), 
        String(selectedSubmission.id), 
        Number(gradingScore), 
        gradingFeedback
      );
      
      // Clear draft on success
      const draftKey = getAssignmentAutoSaveKey(selectedSubmission.id);
      localStorage.removeItem(draftKey);
      
      applyAssignmentGradeLocally(selectedSubmission.id, Number(gradingScore), gradingFeedback);
      toast(t('teacherDesk.dashboard.submissionGraded'), 'success');
      handleCloseGradingModal();
    } catch (error) {
      toast(t('teacherDesk.dashboard.gradeFailed'), 'error');
      console.error('Grading error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowResubmission = async (submissionId: number) => {
    try {
      await apiClient.allowResubmission(String(submissionId));
      toast(t('teacherDesk.dashboard.resubmissionAllowed'), 'info');
      await refreshSubmissionsOnly();
    } catch (error) {
      toast(t('teacherDesk.dashboard.resubmissionFailed'), 'error');
      console.error('Resubmission error:', error);
    }
  };

  const handleOpenAutoGradeDialog = async () => {
    setIsAutoGradeDialogOpen(true);
    setIsAutoGradePreviewLoading(true);

    try {
      const preview = await apiClient.getAutoGradeUnitHomeworkPreview();
      setAutoGradePreview(preview?.items || []);
    } catch (error) {
      toast(t('teacherDesk.autoGrade.previewFailed'), 'error');
      console.error('Auto-grade preview error:', error);
    } finally {
      setIsAutoGradePreviewLoading(false);
    }
  };

  const handleAutoGradeUnitHomework = async () => {
    if (autoGradePreview.length === 0) {
      toast(t('teacherDesk.autoGrade.noneEligible'), 'info');
      return;
    }

    setIsAutoGrading(true);
    try {
      const result = await apiClient.autoGradeUnitHomework();

      if ((result?.graded_count || 0) > 0) {
        toast(t('teacherDesk.autoGrade.done', { count: result.graded_count }), 'success');
      } else {
        toast(t('teacherDesk.autoGrade.noneEligible'), 'info');
      }

      setIsAutoGradeDialogOpen(false);
      setAutoGradePreview([]);
      await refreshSubmissionsOnly();
    } catch (error) {
      toast(t('teacherDesk.autoGrade.failed'), 'error');
      console.error('Auto-grade homework error:', error);
    } finally {
      setIsAutoGrading(false);
    }
  };

  // Quiz grading handlers
  // Auto-save key generator for quiz
  const getAutoSaveKey = (attemptId: number) => `quiz_grading_draft_${attemptId}`;
  
  // Auto-save key generator for assignment
  const getAssignmentAutoSaveKey = (submissionId: number) => `assignment_grading_draft_${submissionId}`;

  const handleGradeQuizClick = (attempt: any) => {
    console.log('handleGradeQuizClick called with attempt:', attempt);
    console.log('attempt.is_graded:', attempt.is_graded);
    console.log('attempt.score:', attempt.score);
    console.log('attempt.score_percentage:', attempt.score_percentage);
    console.log('attempt.feedback:', attempt.feedback);
    
    setSelectedQuizAttempt(attempt);
    setIsQuizDataLoaded(false); // Reset flag when opening new quiz
    
    // For already graded quizzes, always load from attempt data, not from draft
    if (attempt.is_graded) {
      // Use nullish coalescing to avoid 0 being treated as false/empty
      // Check both 'score' (from unified list) and 'score_percentage' (from API)
      const existingScore = attempt.score ?? attempt.score_percentage ?? '';
      console.log('Setting quiz score to:', existingScore);
      setQuizGradeScore(existingScore);
      setQuizGradeFeedback(attempt.feedback || '');
    } else {
      // For ungraded quizzes, check for draft first
      const draftKey = getAutoSaveKey(attempt.quiz_attempt_id);
      const savedDraft = localStorage.getItem(draftKey);
      
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setQuizGradeScore(parsed.score ?? '');
          setQuizGradeFeedback(parsed.feedback || '');
          toast(t('teacherDesk.dashboard.draftRestored'), 'info');
        } catch (e) {
          setQuizGradeScore('');
          setQuizGradeFeedback('');
        }
      } else {
        // No draft and not graded yet - start fresh
        setQuizGradeScore('');
        setQuizGradeFeedback('');
      }
    }
    
    setIsQuizGradeModalOpen(true);
    // Set flag after a short delay to allow state to settle
    setTimeout(() => setIsQuizDataLoaded(true), 100);
  };

  // Auto-save effect for quiz grading
  useEffect(() => {
    if (isQuizGradeModalOpen && selectedQuizAttempt && isQuizDataLoaded) {
      const draftKey = getAutoSaveKey(selectedQuizAttempt.quiz_attempt_id);
      const draftData = {
        score: quizGradeScore,
        feedback: quizGradeFeedback,
        timestamp: Date.now()
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  }, [quizGradeScore, quizGradeFeedback, isQuizGradeModalOpen, selectedQuizAttempt, isQuizDataLoaded]);

  // Auto-save effect for assignment grading
  useEffect(() => {
    if (isGradingModalOpen && selectedSubmission && isAssignmentDataLoaded) {
      const draftKey = getAssignmentAutoSaveKey(selectedSubmission.id);
      const draftData = {
        score: gradingScore,
        feedback: gradingFeedback,
        timestamp: Date.now()
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    }
  }, [gradingScore, gradingFeedback, isGradingModalOpen, selectedSubmission, isAssignmentDataLoaded]);

  const handleSubmitQuizGrade = async () => {
    if (!selectedQuizAttempt) return;
    
    // Validation
    if (quizGradeScore === '' || quizGradeScore === null || quizGradeScore === undefined) {
      toast(t('teacherDesk.dashboard.enterScore'), 'error');
      return;
    }

    try {
      await apiClient.gradeQuizAttempt(selectedQuizAttempt.quiz_attempt_id, {
        score_percentage: Number(quizGradeScore),
        correct_answers: selectedQuizAttempt.long_text_answers?.length || 1,
        feedback: quizGradeFeedback
      });
      
      // Clear draft on success
      const draftKey = getAutoSaveKey(selectedQuizAttempt.quiz_attempt_id);
      localStorage.removeItem(draftKey);
      
      applyQuizGradeLocally(selectedQuizAttempt.quiz_attempt_id, Number(quizGradeScore), quizGradeFeedback);
      handleCloseQuizGradeModal();
      toast(t('teacherDesk.dashboard.quizGraded'), 'success');
    } catch (error) {
      toast(t('teacherDesk.dashboard.quizGradeFailed'), 'error');
      console.error('Quiz grading error:', error);
    }
  };

  const handleDeleteQuizAttempt = async (attemptId: number) => {
    if (!confirm(t('teacherDesk.dashboard.deleteAttemptConfirm'))) return;
    try {
      await apiClient.deleteQuizAttempt(attemptId);
      toast(t('teacherDesk.dashboard.attemptDeleted'), 'info');
      setUngradedQuizAttempts(prev => prev.filter(attempt => attempt.id !== attemptId));
      setGradedQuizAttempts(prev => prev.filter(attempt => attempt.id !== attemptId));
    } catch (error) {
      toast(t('teacherDesk.dashboard.attemptDeleteFailed'), 'error');
      console.error('Delete quiz attempt error:', error);
    }
  };

  // Close modal handlers with state reset
  const handleCloseQuizGradeModal = () => {
    setIsQuizGradeModalOpen(false);
    setIsQuizDataLoaded(false);
  };

  const handleCloseGradingModal = () => {
    setIsGradingModalOpen(false);
    setIsAssignmentDataLoaded(false);
  };

  // Merge and filter submissions (including quiz attempts)
  const unifiedSubmissions = useMemo(() => {
    // Start with all pending assignment submissions
    const all: any[] = [...pendingSubmissions.map(s => ({ ...s, type: 'assignment' }))];
    
    // Add recent submissions that are NOT in the pending list (i.e., graded ones)
    const pendingIds = new Set(pendingSubmissions.map(s => s.id));
    recentSubmissions.forEach(sub => {
      if (!pendingIds.has(sub.id)) {
        all.push({ ...sub, type: 'assignment' });
      }
    });

    // Add ungraded quiz attempts
    ungradedQuizAttempts.forEach(attempt => {
      all.push({
        id: `quiz-${attempt.id}`,
        quiz_attempt_id: attempt.id,
        type: 'quiz',
        student_name: attempt.user_name,
        student_email: attempt.user_email,
        assignment_title: attempt.quiz_title || t('teacherDesk.dashboard.typeQuiz'),
        course_title: attempt.course_title,
        lesson_title: attempt.lesson_title,
        submitted_at: attempt.created_at,
        is_graded: false,
        score: null,
        quiz_answers: attempt.quiz_answers,
        quiz_media_type: attempt.quiz_media_type,
        quiz_media_url: attempt.quiz_media_url,
        long_text_answers: attempt.long_text_answers // Keep for backward compat if needed, though quiz_answers is preferred
      });
    });

    // Add graded quiz attempts
    gradedQuizAttempts.forEach(attempt => {
      all.push({
        id: `quiz-${attempt.id}`,
        quiz_attempt_id: attempt.id,
        type: 'quiz',
        student_name: attempt.user_name,
        student_email: attempt.user_email,
        assignment_title: attempt.quiz_title || t('teacherDesk.dashboard.typeQuiz'),
        course_title: attempt.course_title,
        lesson_title: attempt.lesson_title,
        submitted_at: attempt.created_at,
        is_graded: true,
        score: attempt.score_percentage,
        feedback: attempt.feedback,
        quiz_answers: attempt.quiz_answers,
        quiz_media_type: attempt.quiz_media_type,
        quiz_media_url: attempt.quiz_media_url,
        long_text_answers: attempt.long_text_answers
      });
    });

    // Sort by date desc
    return all.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
  }, [pendingSubmissions, recentSubmissions, ungradedQuizAttempts, gradedQuizAttempts, t]);

  const filteredSubmissions = useMemo(() => {
    if (activeTab === 'pending') {
      return unifiedSubmissions.filter(s => !s.is_graded);
    }
    if (activeTab === 'graded') {
      return unifiedSubmissions.filter(s => s.is_graded);
    }
    return unifiedSubmissions;
  }, [unifiedSubmissions, activeTab]);

  // Re-query the student list when an archived/deactivated switch flips. The key
  // guard skips the initial render (the dashboard load already fetched defaults)
  // and survives StrictMode's double effect.
  useEffect(() => {
    const key = `${Number(showArchivedGroups)}|${Number(showInactiveStudents)}`;
    if (key === studentsQueryKey.current) return;
    studentsQueryKey.current = key;
    let cancelled = false;
    setStudentsLoading(true);
    apiClient.getTeacherStudentsProgress({
      includeArchived: showArchivedGroups,
      includeInactive: showInactiveStudents,
    })
      .then((rows) => { if (!cancelled) setStudentsProgress(rows); })
      .finally(() => { if (!cancelled) setStudentsLoading(false); });
    return () => { cancelled = true; };
  }, [showArchivedGroups, showInactiveStudents]);

  // Group filtering — current groups first, archived ones after.
  const uniqueGroups = useMemo(() => {
    const groups = new Map<string, boolean>();
    studentsProgress.forEach(s => {
      if (!s.group_name) return;
      // A name counts as archived only if every row under it is archived.
      const archived = Boolean(s.group_is_archived);
      groups.set(s.group_name, groups.has(s.group_name) ? groups.get(s.group_name)! && archived : archived);
    });
    return Array.from(groups, ([name, archived]) => ({ name, archived }))
      .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name));
  }, [studentsProgress]);

  // Turning "Archived groups" off can remove the selected group from the list.
  useEffect(() => {
    if (activeGroup !== 'all' && !uniqueGroups.some(g => g.name === activeGroup)) {
      setActiveGroup('all');
    }
  }, [uniqueGroups, activeGroup]);

  const filteredStudents = useMemo(() => {
    let list = activeGroup === 'all'
      ? studentsProgress
      : studentsProgress.filter(s => s.group_name === activeGroup);
    const needle = studentSearch.trim().toLowerCase();
    if (needle) {
      list = list.filter(s =>
        (s.student_name || '').toLowerCase().includes(needle)
        || (s.student_email || '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [studentsProgress, activeGroup, studentSearch]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setStudentPage(1);
  }, [activeGroup, studentSearch]);

  // Calculate paginated students
  const totalStudentPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * studentsPerPage;
    return filteredStudents.slice(start, start + studentsPerPage);
  }, [filteredStudents, studentPage]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-secondary rounded w-48"></div>
          <div className="grid grid-cols-1 @3xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-secondary rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 dark:bg-secondary rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-400">
          <h3 className="font-bold">{t('teacherDesk.dashboard.loadError')}</h3>
          <p>{error}</p>
          <Button onClick={loadTeacherData} variant="outline" className="mt-2 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20">
            {t('teacherDesk.retry')}
          </Button>
        </div>
      </div>
    );
  }

  // Attendance-required rolled up per group (one row per group, not per lesson).
  const attendanceGroups = (() => {
    const map = new Map<number, { group_id: number; group_name: string; count: number; oldest: string; oldestEventId: number | null }>();
    for (const r of stats?.missing_attendance_reminders ?? []) {
      const key = r.group_id ?? -1;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (r.event_date && new Date(r.event_date) < new Date(existing.oldest)) {
          existing.oldest = r.event_date;
          existing.oldestEventId = r.event_id ?? null;
        }
      } else {
        map.set(key, { group_id: r.group_id ?? -1, group_name: r.group_name || '—', count: 1, oldest: r.event_date, oldestEventId: r.event_id ?? null });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col @lg:flex-row @lg:items-center @lg:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('teacherDesk.dashboard.title')}</h1>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <Button
              onClick={() => navigate('/admin/courses')}
              className="bg-brand-solid hover:bg-brand-solid-hover text-white"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              {t('teacherDesk.dashboard.manageCourses')}
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'curator') && (
            <>
              {(user?.role === 'teacher' || user?.role === 'admin') && (
                <Button
                  onClick={() => setIsSalaryDialogOpen(true)}
                  variant="outline"
                  className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  {t('teacherDesk.dashboard.salaryBreakdown')}
                </Button>
              )}
              <Button
                onClick={() => setIsWeeklyAwardsOpen(true)}
                variant="outline"
                className="border-border text-foreground hover:bg-muted dark:hover:bg-secondary"
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                {t('teacherDesk.awards.button')}
              </Button>
              <Button
                onClick={() => navigate('/manual-unlocks')}
                variant="outline"
                className="border-brand-border  text-brand-subtle-foreground  hover:bg-brand-subtle"
              >
                <Unlock className="w-4 h-4 mr-2" />
                {t('teacherDesk.dashboard.manualUnlocks')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* The teacher's day first: each of today's lessons, what it still needs, and «Join» (2026-09-28). */}
      <TodayLessons role={user?.role} workspaceEmail={(user as { workspace_email?: string | null } | null)?.workspace_email} />

      {/* «Install Master LMS» as one quiet line, when it's due (components/pwa). */}
      {user?.role === 'teacher' && <InstallAppCard variant="teacher" />}

      {/* Key Stats - Student Dynamics */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-4 gap-4">
        {/* Pending Reviews - Action Required */}
        <Card className="shadow-sm border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{t('teacherDesk.dashboard.pendingReviews')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats?.pending_submissions || 0}</span>
              {(stats?.total_submissions ?? 0) > 0 && (
                <span className="text-sm text-muted-foreground">
                  / {stats?.total_submissions}
                </span>
              )}
            </div>
            {(stats?.pending_submissions ?? 0) > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">{t('teacherDesk.dashboard.requiresAttention')}</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Rate */}
        <Card className="shadow-sm border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{t('teacherDesk.dashboard.activeThisWeek')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats?.active_students || 0}</span>
              <span className="text-sm text-muted-foreground">
                / {stats?.total_students || 0}
              </span>
            </div>
            {(stats?.total_students ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground  mt-2">
                {t('teacherDesk.dashboard.engagement', { percent: Math.round(((stats?.active_students || 0) / (stats?.total_students || 1)) * 100) })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card className="shadow-sm border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{t('teacherDesk.avgScore')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats?.avg_student_score || 0}</span>
              <span className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.pointsShort')}</span>
            </div>
            <p className="text-xs text-muted-foreground  mt-2">
              {t('teacherDesk.dashboard.fromGraded', { count: stats?.graded_submissions || 0 })}
            </p>
          </CardContent>
        </Card>

        {/* Overall Progress */}
        <Card className="shadow-sm border border-border">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{t('teacherDesk.avgProgress')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{stats?.avg_student_progress || 0}%</span>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-muted  rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${stats?.avg_student_progress || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's homework coverage — same Card/table style as the widgets below */}
      {todayHw && todayHw.total_groups > 0 && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="px-6 py-4 border-b border-border bg-card rounded-t-xl">
            <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('teacherDesk.dashboard.todayHomework')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.todayHomeworkHint')}</p>
              </div>
              <span className="text-sm text-muted-foreground">
                {t('teacherDesk.dashboard.assignedCount', { assigned: todayHw.assigned_count, total: todayHw.total_groups })}
                {todayHw.missing_count > 0 && (
                  <span className="text-rose-600 dark:text-rose-400"> · {t('teacherDesk.dashboard.missingCount', { count: todayHw.missing_count })}</span>
                )}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/80 dark:bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.group')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.homework')}</th>
                    <th
                      className="text-left px-6 py-3 font-semibold cursor-pointer select-none hover:text-foreground"
                      onClick={() => setHwSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                      title={t('teacherDesk.dashboard.sortByLastAssigned')}
                      aria-sort={hwSortDir === 'desc' ? 'descending' : 'ascending'}
                    >
                      <span className="inline-flex items-center gap-1">
                        {t('teacherDesk.dashboard.lastAssigned')}
                        {hwSortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...todayHw.groups]
                    .sort((a, b) => {
                      const ta = a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : null;
                      const tb = b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : null;
                      if (ta === null && tb === null) return 0;
                      if (ta === null) return 1; // groups never assigned always sink to the bottom
                      if (tb === null) return -1;
                      return hwSortDir === 'desc' ? tb - ta : ta - tb;
                    })
                    .map((g) => (
                    <tr
                      key={g.group_id}
                      onClick={() => navigate(`/homework/new/group/${g.group_id}`)}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted dark:hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-foreground whitespace-nowrap">{g.group_name}</td>
                      <td className="px-6 py-3">
                        {g.has_homework_today ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{g.assignments.map((a) => a.title).join(', ')}</span>
                        ) : (
                          <span className="text-rose-500 dark:text-rose-400">{t('teacherDesk.dashboard.notAssignedToday')}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground  whitespace-nowrap">
                        {g.last_assigned_at
                          ? formatDateTime(new Date(g.last_assigned_at))
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Required — table, under Today's Homework */}
      {stats?.missing_attendance_reminders && stats.missing_attendance_reminders.length > 0 && (
        <Card className="shadow-sm border border-border">
          <CardHeader className="px-6 py-4 border-b border-border bg-card rounded-t-xl">
            <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('teacherDesk.dashboard.attendanceRequired')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.attendanceRequiredHint')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-rose-600 dark:text-rose-400">
                  {t('common.groups', { count: attendanceGroups.length })} · {t('common.lessons', { count: stats.missing_attendance_reminders.length })}
                </span>
                <Button onClick={() => navigate('/attendance')} size="sm" variant="outline" className="text-xs h-7">
                  {t('teacherDesk.dashboard.goToAttendance')}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/80 dark:bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.group')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.dashboard.lessonsMissing')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.dashboard.oldest')}</th>
                    <th className="text-right px-6 py-3 font-semibold">{t('teacherDesk.dashboard.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceGroups.map((g) => (
                    <tr
                      key={g.group_id}
                      // One lesson missing: its own page, at the register (2026-09-28); several: the journal.
                      onClick={() => navigate(g.count === 1 && g.oldestEventId
                        ? lessonPath(g.oldestEventId, 'register')
                        : g.group_id > 0 ? `/attendance?group=${g.group_id}${g.oldest ? `&date=${g.oldest.slice(0, 10)}` : ''}` : '/attendance')}
                      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted dark:hover:bg-secondary/40 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-foreground">{g.group_name}</td>
                      <td className="px-6 py-3 text-rose-600 dark:text-rose-400 font-semibold">{g.count}</td>
                      <td className="px-6 py-3 text-muted-foreground  whitespace-nowrap">
                        {g.oldest && g.oldestEventId ? (
                          <Link to={lessonPath(g.oldestEventId, 'register')} onClick={(e) => e.stopPropagation()} className="hover:text-primary hover:underline" title={t('teacherDesk.dashboard.openLesson')}>
                            {formatDate(new Date(g.oldest))}
                          </Link>
                        ) : g.oldest ? formatDate(new Date(g.oldest)) : '—'}
                      </td>
                      <td className="px-6 py-3 text-right text-rose-600 dark:text-rose-400 font-medium">{t('teacherDesk.dashboard.mark')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unified Submissions Table */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="px-6 py-4 border-b border-border bg-card rounded-t-xl">
          <div className="flex flex-col @lg:flex-row @lg:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <div>
                <CardTitle className="text-lg font-bold text-foreground">{t('teacherDesk.dashboard.submissions')}</CardTitle>
                <p className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.submissionsHint')}</p>
              </div>
            </div>

            <div className="flex w-full @lg:w-auto flex-col @lg:flex-row @lg:items-center gap-2">
              <Button
                onClick={handleOpenAutoGradeDialog}
                disabled={isAutoGrading}
                variant="outline"
                className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                {isAutoGrading ? t('teacherDesk.dashboard.autoGrading') : t('teacherDesk.dashboard.autoGradeButton')}
              </Button>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full @lg:w-auto">
                <TabsList className="grid w-full grid-cols-3 @lg:w-[300px]">
                  <TabsTrigger value="pending">{t('teacherDesk.dashboard.tabPending')}</TabsTrigger>
                  <TabsTrigger value="graded">{t('teacherDesk.dashboard.tabGraded')}</TabsTrigger>
                  <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center bg-muted/50 dark:bg-secondary/50">
              <CheckCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">{t('teacherDesk.dashboard.noSubmissions')}</h3>
              <p className="text-muted-foreground">
                {activeTab === 'pending' 
                  ? t('teacherDesk.dashboard.allCaughtUp')
                  : t('teacherDesk.dashboard.noFilterMatch')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/80 dark:bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.student')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.type')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.title')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.status')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.submitted')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.score')}</th>
                    <th className="text-right px-6 py-3 font-semibold">{t('teacherDesk.col.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-muted/80 dark:hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-muted  flex items-center justify-center mr-3 text-muted-foreground  font-medium text-xs">
                            {submission.student_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-foreground">{submission.student_name || t('teacherDesk.dashboard.unknownStudent')}</div>
                            <div className="text-xs text-muted-foreground">{submission.student_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant="outline"
                          className={submission.type === 'quiz' 
                            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" 
                            : "bg-brand-surface  text-brand-subtle-foreground  border-brand-border"}
                        >
                          {submission.type === 'quiz' ? t('teacherDesk.dashboard.typeQuiz') : t('teacherDesk.dashboard.typeHomework')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{submission.assignment_title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant={submission.is_graded ? "outline" : "default"}
                          className={submission.is_graded 
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20" 
                            : "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800/30 border-transparent"}
                        >
                          {submission.is_graded ? t('teacherDesk.dashboard.statusGraded') : t('teacherDesk.dashboard.statusNeedsGrading')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1.5 text-muted-foreground" />
                          {formatDateTime(new Date(submission.submitted_at))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {submission.is_graded ? (
                          submission.type === 'quiz' ? (
                            <span className={
                              (submission.score || 0) >= 80 
                                ? "text-green-600 dark:text-green-400" 
                                : (submission.score || 0) >= 50 
                                  ? "text-yellow-600 dark:text-yellow-400" 
                                  : "text-red-600 dark:text-red-400"
                            }>
                              {Math.round(submission.score || 0)}%
                            </span>
                          ) : (
                            <span className={
                              (submission.score || 0) >= (submission.max_score || 100) * 0.8 
                                ? "text-green-600 dark:text-green-400" 
                                : (submission.score || 0) >= (submission.max_score || 100) * 0.5 
                                  ? "text-yellow-600 dark:text-yellow-400" 
                                  : "text-red-600 dark:text-red-400"
                            }>
                              {submission.score} / {submission.max_score}
                            </span>
                          )
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {submission.type === 'quiz' ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600/70 dark:hover:bg-purple-600/85"
                                onClick={() => handleGradeQuizClick(submission)}
                              >
                                <ClipboardCheck className="w-4 h-4 mr-1" />
                                {t('teacherDesk.grading.grade')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
                                onClick={() => handleDeleteQuizAttempt(submission.quiz_attempt_id)}
                                title={t('teacherDesk.dashboard.allowResubmission')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant={submission.is_graded ? "ghost" : "default"}
                                className={submission.is_graded ? "text-brand  hover:text-brand  hover:bg-brand-subtle" : "bg-brand-solid hover:bg-brand-solid-hover"}
                                onClick={() => handleGradeSubmission(submission)}
                              >
                                {submission.is_graded ? <Eye className="w-4 h-4 mr-1" /> : <ClipboardCheck className="w-4 h-4 mr-1" />}
                                {submission.is_graded ? t('teacherDesk.grading.view') : t('teacherDesk.grading.grade')}
                              </Button>
                              {!submission.is_graded && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground  hover:text-foreground"
                                  onClick={() => handleAllowResubmission(submission.id)}
                                >
                                  {t('teacherDesk.dashboard.resubmit')}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Progress Table */}
      <Card className="shadow-sm border border-border">
        <CardHeader className="px-6 py-4 border-b border-border bg-card rounded-t-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="text-lg font-bold text-foreground">{t('teacherDesk.dashboard.studentProgress')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('teacherDesk.dashboard.studentProgressHint')}</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={t('teacherDesk.dashboard.searchStudent')}
                className="w-full @lg:w-56 min-w-0 px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none focus:border-brand"
              />
            {uniqueGroups.length > 0 && (
              <div className="flex min-w-0 flex-1 @lg:flex-none items-center gap-2">
                <Filter className="w-4 h-4 shrink-0 text-muted-foreground" />
                <Select value={activeGroup} onValueChange={setActiveGroup}>
                  <SelectTrigger className="w-full @lg:w-[200px] bg-card border-border">
                    <SelectValue placeholder={t('teacherDesk.dashboard.allStudents')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('teacherDesk.dashboard.allStudents')}</SelectItem>
                    {uniqueGroups.map(group => (
                      <SelectItem key={group.name} value={group.name}>
                        {group.archived ? t('teacherDesk.dashboard.archivedGroupName', { name: group.name }) : group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground  whitespace-nowrap cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchivedGroups}
                  onChange={(e) => setShowArchivedGroups(e.target.checked)}
                  className="rounded border-border"
                />
                {t('teacherDesk.dashboard.archivedGroups')}
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground  whitespace-nowrap cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInactiveStudents}
                  onChange={(e) => setShowInactiveStudents(e.target.checked)}
                  className="rounded border-border"
                />
                {t('teacherDesk.dashboard.deactivatedStudents')}
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className={`p-0 transition-opacity ${studentsLoading ? 'opacity-50 pointer-events-none' : ''}`}>
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-muted/50 dark:bg-secondary/50">
              <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-1">{t('teacherDesk.dashboard.noStudents')}</h3>
              <p className="text-muted-foreground">
                {showArchivedGroups
                  ? t('teacherDesk.dashboard.adjustFilter')
                  : t('teacherDesk.dashboard.adjustFilterOrArchived')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/80 dark:bg-secondary/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.student')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.group')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.course')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.dashboard.currentUnit')}</th>
                    <th className="text-left px-6 py-3 font-semibold" title={t('teacherDesk.dashboard.progressTitle')}>{t('teacherDesk.col.progress')}</th>
                    <th className="text-left px-6 py-3 font-semibold">{t('teacherDesk.col.lastActivity')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedStudents.map((student, index) => (
                    <tr
                      key={`${student.student_id}-${student.course_id}-${index}`}
                      className="hover:bg-muted/80 dark:hover:bg-secondary/30 transition-colors cursor-pointer"
                      title={t('teacherDesk.openStudentAnalytics')}
                      onClick={() => navigate(
                        `/analytics/student/${student.student_id}${student.course_id ? `?course_id=${student.course_id}` : ''}`
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {student.student_avatar ? (
                            <img 
                              src={student.student_avatar} 
                              alt={student.student_name}
                              className="w-8 h-8 rounded-full mr-3 object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mr-3 text-purple-600 dark:text-purple-400 font-medium text-xs">
                              {student.student_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-foreground">
                              {student.student_name}
                              {student.is_inactive && (
                                <span className="ml-1.5 text-[10px] font-normal text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-1 py-px align-middle">
                                  {t('teacherDesk.dashboard.deactivated')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">{student.student_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {student.group_name ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="bg-muted dark:bg-secondary inline-flex items-center whitespace-nowrap">
                              {student.group_name.split("-")[0]}
                            </Badge>
                            {student.group_is_archived && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border whitespace-nowrap">
                                {t('teacherDesk.archived')}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{student.course_title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-foreground truncate max-w-[150px]" title={student.current_lesson_title}>
                            {student.current_lesson_title}
                          </div>
                          {student.current_lesson_id && (
                            <div className="flex items-center space-x-2">
                              <Progress value={student.lesson_progress} className="w-16 h-2" />
                              <span className="text-xs text-muted-foreground">
                                {student.lesson_progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center max-w-[180px]">
                          <div className="flex-1 mr-3">
                            <Progress value={student.overall_progress} className="h-2.5 w-24" />
                          </div>
                          <div className="text-sm font-medium text-foreground  whitespace-nowrap">
                            <span>{student.overall_progress}%</span>
                          </div>
                        </div>
                        <CompletionMeta
                          className="mt-1"
                          lessonsDone={student.lessons_done ?? student.completed_modules}
                          lessonsTotal={student.lessons_total ?? student.total_modules}
                          checkpoints={student.checkpoints}
                        />
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {student.last_activity 
                          ? formatDate(new Date(student.last_activity), { month: 'short', day: 'numeric' })
                          : <span className="text-muted-foreground">{t('teacherDesk.never')}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination Controls */}
          {filteredStudents.length > studentsPerPage && (
            <div className="flex flex-col gap-3 px-4 py-4 @lg:flex-row @lg:items-center @lg:justify-between @lg:px-6 border-t border-border bg-muted dark:bg-secondary rounded-b-xl">
              <div className="text-sm text-muted-foreground">
                {t('teacherDesk.dashboard.showing', { from: ((studentPage - 1) * studentsPerPage) + 1, to: Math.min(studentPage * studentsPerPage, filteredStudents.length), total: filteredStudents.length })}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                  disabled={studentPage === 1}
                >
                  {t('teacherDesk.dashboard.previous')}
                </Button>
                <span className="text-sm text-muted-foreground  px-2">
                  {t('teacherDesk.dashboard.page', { page: studentPage, pages: totalStudentPages })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                  disabled={studentPage >= totalStudentPages}
                >
                  {t('teacherDesk.dashboard.next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz Grading Modal */}
      <Dialog open={isQuizGradeModalOpen} onOpenChange={(open) => !open && handleCloseQuizGradeModal()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('teacherDesk.dashboard.gradeQuiz')}</DialogTitle>
          </DialogHeader>
          
          {selectedQuizAttempt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted dark:bg-secondary p-4 rounded-lg">
                <div>
                  <span className="font-semibold text-muted-foreground">{t('teacherDesk.grading.studentLabel')}</span>
                  <p className="text-foreground">{selectedQuizAttempt.student_name}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">{t('teacherDesk.grading.quizLabel')}</span>
                  <p className="text-foreground">{selectedQuizAttempt.assignment_title}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">{t('teacherDesk.dashboard.lessonLabel')}</span>
                  <p className="text-foreground">{selectedQuizAttempt.lesson_title}</p>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">{t('teacherDesk.dashboard.courseLabel')}</span>
                  <p className="text-foreground">{selectedQuizAttempt.course_title}</p>
                </div>
              </div>

              {/* Quiz Reference Material */}
              {selectedQuizAttempt.quiz_media_url && (
                <div className="mb-6 bg-muted dark:bg-secondary p-4 rounded-lg border border-border">
                  <h4 className="font-semibold mb-3 text-foreground flex items-center">
                    <BookOpen className="w-4 h-4 mr-2" />
                    {t('teacherDesk.dashboard.referenceMaterial')}
                  </h4>
                  
                  {selectedQuizAttempt.quiz_media_type === 'pdf' ? (
                    <div className="aspect-[16/9] w-full">
                       <iframe 
                         src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + selectedQuizAttempt.quiz_media_url} 
                         className="w-full h-full rounded border border-border bg-card"
                         title={t('teacherDesk.dashboard.referencePdf')}
                       />
                       <div className="mt-2 text-right">
                         <a 
                           href={selectedQuizAttempt.quiz_media_url} 
                           target="_blank" 
                           rel="noreferrer"
                           className="text-sm text-brand  hover:underline"
                         >
                           {t('teacherDesk.dashboard.openPdf')}
                         </a>
                       </div>
                    </div>
                  ) : selectedQuizAttempt.quiz_media_type === 'image' ? (
                    <div className="flex justify-center">
                      <img 
                        src={selectedQuizAttempt.quiz_media_url} 
                        alt={t('teacherDesk.dashboard.referenceAlt')} 
                        className="max-h-96 rounded shadow-sm object-contain"
                      />
                    </div>
                  ) : (
                    // Default/Text fallback
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedQuizAttempt.quiz_media_url) }}
                    />
                  )}
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3 text-foreground">{t('teacherDesk.dashboard.quizAnswers')}</h3>
                {selectedQuizAttempt.quiz_answers?.length > 0 ? (
                  <div className="space-y-6">
                    {selectedQuizAttempt.quiz_answers.map((item: any, idx: number) => (
                      <div key={idx} className={`border rounded-lg overflow-hidden ${
                        item.question_type !== 'long_text' 
                          ? (item.is_correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800')
                          : 'border-border'
                      }`}>
                        {/* Header with Type and Status */}
                        <div className="p-3 bg-muted dark:bg-secondary border-b border-border flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground">{t('teacherDesk.grading.questionNumber', { number: idx + 1 })}</span>
                          <div className="flex gap-2">
                             <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-secondary text-foreground">
                               {QUESTION_TYPE_LABELS[item.question_type] ? t(QUESTION_TYPE_LABELS[item.question_type]) : item.question_type?.replace('_', ' ') || t('teacherDesk.questionType.question')}
                             </span>
                             {item.question_type !== 'long_text' && (
                               <span className={`text-xs px-2 py-1 rounded font-medium ${
                                 item.is_correct ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                               }`}>
                                 {item.is_correct ? t('teacherDesk.dashboard.correct') : t('teacherDesk.dashboard.incorrect')}
                               </span>
                             )}
                          </div>
                        </div>

                        {/* Passage (if exists) */}
                        {item.content_text && (
                          <div className="p-4 border-b border-border">
                            <p className="text-[14px] font-semibold text-foreground  mb-1">{t('teacherDesk.dashboard.passage')}</p>
                            <div 
                              className="text-foreground  prose prose-sm max-w-none text-[14px]"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.content_text) }}
                            />
                          </div>
                        )}
                        
                        {/* Question Text */}
                        <div className="p-4 bg-card border-b border-border">
                          <p className="text-foreground font-medium">{item.question_text}</p>
                        </div>

                        {/* Answer Section */}
                        <div className="p-4 bg-muted dark:bg-secondary">
                          <div className="grid gap-4">
                            <div>
                               <p className="text-[12px] font-semibold text-brand  mb-1">{t('teacherDesk.dashboard.studentAnswer', { name: selectedQuizAttempt?.student_name ?? '' })}</p>
                               <div className={`text-foreground  whitespace-pre-wrap p-3 rounded border ${
                                 item.question_type === 'long_text' 
                                   ? 'bg-brand-surface  border-brand-border' 
                                   : (item.is_correct ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800')
                               }`}>
                                 {item.student_answer || <span className="text-muted-foreground italic">{t('teacherDesk.grading.noAnswer')}</span>}
                               </div>
                            </div>
                            
                            {/* Correct Answer Display (if incorrect and not long_text) */}
                            {item.question_type !== 'long_text' && !item.is_correct && (
                               <div>
                                  <p className="text-[12px] font-semibold text-green-600 dark:text-green-400 uppercase mb-1">{t('teacherDesk.dashboard.correctAnswer')}</p>
                                  <div className="text-foreground p-3 rounded border border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                                    {item.correct_answer || t('teacherDesk.notAvailable')}
                                  </div>
                               </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('teacherDesk.dashboard.noAnswers')}</p>
                )}
              </div>

              <div className="grid gap-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="quizScore">{t('teacherDesk.grading.scoreRange')}</Label>
                  <Input
                    id="quizScore"
                    type="number"
                    min="0"
                    max="100"
                    value={quizGradeScore}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') setQuizGradeScore('');
                      else setQuizGradeScore(clampQuizScore(Number(val)));
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuizQuickScore('max')}>
                      100%
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuizQuickScore('plus10')}>
                      +10%
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuizQuickScore('minus10')}>
                      −10%
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleQuizQuickScore('clear')}>
                      {t('teacherDesk.grading.clear')}
                    </Button>
                  </div>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="quizFeedback">{t('teacherDesk.grading.feedback')}</Label>
                  <Textarea
                    id="quizFeedback"
                    placeholder={t('teacherDesk.grading.feedbackPlaceholder')}
                    value={quizGradeFeedback}
                    onChange={(e) => setQuizGradeFeedback(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseQuizGradeModal}>{t('common.cancel')}</Button>
            <Button className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-600/70 dark:hover:bg-purple-600/85" onClick={handleSubmitQuizGrade}>{t('teacherDesk.grading.submitGrade')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Grading Modal */}
      <Dialog open={isGradingModalOpen} onOpenChange={(open) => !open && handleCloseGradingModal()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {/* Header */}
          <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
            <div>
              <DialogTitle className="text-lg font-semibold leading-tight">
                {currentAssignment?.title || t('teacherDesk.grading.gradeSubmission')}
              </DialogTitle>
              {selectedSubmission && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedSubmission.student_name || selectedSubmission.user_name || t('teacherDesk.studentFallback')}
                  {selectedSubmission.submitted_at && (
                    <span className="ml-2 text-xs">
                      · {formatDateTime(new Date(selectedSubmission.submitted_at))}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left side - Submission Content (scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 border-r border-border">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('teacherDesk.dashboard.studentWork')}</h3>

              {currentAssignment?.assignment_type === 'multi_task' && selectedSubmission ? (
                <MultiTaskSubmission
                  assignment={currentAssignment}
                  initialAnswers={selectedSubmission.answers}
                  readOnly={true}
                  onSubmit={() => {}}
                  studentId={String(selectedSubmission.user_id)}
                />
              ) : (
                <div className="space-y-3">
                  {selectedSubmission?.file_url && (
                    <div className="flex items-center p-3 bg-muted/40 rounded-lg border border-border">
                      <FileText className="w-5 h-5 text-brand  mr-3 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{selectedSubmission.submitted_file_name || t('teacherDesk.grading.attachedFile')}</div>
                      </div>
                      <SubmissionFileDownloadLink
                        fileUrl={selectedSubmission.file_url}
                        className="text-brand  hover:underline text-sm font-medium flex items-center shrink-0 ml-3"
                      />
                    </div>
                  )}

                  {selectedSubmission?.file_url && isAudioUrl(selectedSubmission.file_url || selectedSubmission.submitted_file_name) && (() => {
                    const audioHref = safeUploadUrl(selectedSubmission.file_url);
                    return audioHref && (
                      <AudioPlayer
                        src={audioHref}
                        className="mt-2"
                      />
                    );
                  })()}

                  {selectedSubmission?.answers?.text && (
                    <div className="bg-muted/40 p-4 rounded-lg border border-border whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedSubmission.answers.text}
                    </div>
                  )}

                  {!selectedSubmission?.file_url && !selectedSubmission?.answers?.text && currentAssignment?.assignment_type !== 'multi_task' && (
                    <div className="text-muted-foreground italic text-sm">{t('teacherDesk.dashboard.noContent')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Grading Panel */}
            <div className="w-64 shrink-0 flex flex-col border-l border-border">
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* Score */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">{t('teacherDesk.grading.score')}</Label>
                    <span className="text-xs text-muted-foreground">/ {currentAssignment?.max_score ?? 100}</span>
                  </div>

                  {/* Score input with stepper */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleAssignmentQuickScore('minus10')}
                      className="h-9 w-9 shrink-0 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center text-base leading-none select-none"
                      aria-label={t('teacherDesk.dashboard.decrease')}
                    >
                      −
                    </button>
                    <Input
                      id="gradeScore"
                      type="number"
                      min="0"
                      max={currentAssignment?.max_score || 100}
                      value={gradingScore}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          setGradingScore('')
                        } else {
                          setGradingScore(clampAssignmentScore(Number(val)))
                        }
                      }}
                      placeholder="—"
                      className="text-center font-semibold text-base h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAssignmentQuickScore('plus10')}
                      className="h-9 w-9 shrink-0 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center text-base leading-none select-none"
                      aria-label={t('teacherDesk.dashboard.increase')}
                    >
                      +
                    </button>
                  </div>

                  {/* Subtle progress + percentage */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground/30 rounded-full transition-all duration-150"
                        style={{ width: gradingScore === '' ? '0%' : `${Math.min(100, (Number(gradingScore) / (currentAssignment?.max_score || 100)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                      {gradingScore === '' ? '—' : `${Math.round((Number(gradingScore) / (currentAssignment?.max_score || 100)) * 100)}%`}
                    </span>
                  </div>

                  {/* Quick shortcuts */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAssignmentQuickScore('max')}
                      className="flex-1 h-7 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      100%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAssignmentQuickScore('clear')}
                      className="flex-1 h-7 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      {t('teacherDesk.grading.clear')}
                    </button>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Feedback */}
                <div className="space-y-2">
                  <Label htmlFor="gradeFeedback" className="text-sm font-medium text-foreground">{t('teacherDesk.grading.feedback')}</Label>
                  <Textarea
                    id="gradeFeedback"
                    value={gradingFeedback}
                    onChange={(e) => setGradingFeedback(e.target.value)}
                    placeholder={t('teacherDesk.dashboard.writeFeedback')}
                    className="resize-none text-sm min-h-[140px]"
                    rows={6}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-border space-y-1.5 shrink-0">
                <Button className="w-full h-9" onClick={handleSubmitGrade} disabled={isSubmitting}>
                  {isSubmitting ? t('teacherDesk.grading.saving') : t('teacherDesk.grading.saveGrade')}
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground hover:text-foreground" onClick={handleCloseGradingModal}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('teacher.payslip.title')}</DialogTitle>
            <DialogDescription>
              {t('teacher.payslip.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="salary-month">{t('teacher.payslip.month')}</Label>
              <Input id="salary-month" type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-interval">{t('teacher.payslip.interval')}</Label>
              <Select
                value={salaryInterval}
                onValueChange={(v: 'first_half' | 'second_half' | 'custom') => setSalaryInterval(v)}
              >
                <SelectTrigger id="salary-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_half">1 - 15</SelectItem>
                  <SelectItem value="second_half">{t('teacher.payslip.secondHalf')}</SelectItem>
                  <SelectItem value="custom">{t('teacher.payslip.customPeriod')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-period-start">{t('teacher.payslip.startDate')}</Label>
              <Input
                id="salary-period-start"
                type="date"
                value={salaryPeriodStart}
                onChange={(e) => setSalaryPeriodStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="salary-period-end">{t('teacher.payslip.endDate')}</Label>
              <Input
                id="salary-period-end"
                type="date"
                value={salaryPeriodEnd}
                onChange={(e) => setSalaryPeriodEnd(e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="salary-rate">{t('teacher.payslip.lessonRate')}</Label>
              <Input
                id="salary-rate"
                type="number"
                min={0}
                placeholder={t('teacher.payslip.ratePlaceholder')}
                value={salaryRate}
                onChange={(e) => {
                  const raw = e.target.value;
                  setSalaryRate(raw === '' ? '' : Number(raw) || 0);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {salaryResult?.rate_source === 'crm' ? (
                  <>
                    {t(salaryResult.individual_rate ? 'teacher.payslip.crmRateWithIndividual' : 'teacher.payslip.crmRate', {
                      level: salaryResult.level
                        ? ` (${salaryResult.level}${salaryResult.group_band ? `, ${salaryResult.group_band}` : ''})`
                        : '',
                      group: salaryResult.lesson_rate,
                      individual: salaryResult.individual_rate ?? '',
                    })}
                  </>
                ) : salaryResult?.rate_source === 'override' ? (
                  <>{t('teacher.payslip.rateOverride')}</>
                ) : (
                  <>{t('teacher.payslip.rateEmptyHint')}</>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateSalaryBreakdown} disabled={isSalaryLoading}>
              {isSalaryLoading ? t('teacher.payslip.generating') : t('teacher.payslip.generate')}
            </Button>
            <Button variant="outline" onClick={handleCopySalaryMessage} disabled={!salaryResult?.message_text}>
              <Copy className="w-4 h-4 mr-2" />
              {t('teacher.payslip.copyText')}
            </Button>
          </div>

          {salaryResult && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {t('teacher.payslip.lessons')} <span className="font-semibold">{salaryResult.total_lessons}</span> ·{' '}
                {(salaryResult.fines_tenge ?? 0) > 0 ? t('teacher.payslip.accrued') : t('teacher.payslip.total')}{' '}
                <span className="font-semibold">{t('teacher.payslip.amount', { amount: formatNumber(salaryResult.total_amount_tenge) })}</span>
              </div>
              <WebinarPayCard webinars={salaryResult.webinars} />
              {/* The deduction is its own line under the pay, never folded into it. A teacher
                  who sees only a smaller number has to ask somebody what happened, and this
                  card exists so that they do not have to. */}
              {(salaryResult.fines_tenge ?? 0) > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
                  <div className="text-amber-900 dark:text-amber-300">
                    {t('teacher.payslip.finesWithheld')}{' '}
                    <span className="font-semibold">−{t('teacher.payslip.amount', { amount: formatNumber(salaryResult.fines_tenge ?? 0) })}</span>
                    {salaryResult.fines_final === false && (
                      <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                        {t('teacher.payslip.finesNotFinal')}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-amber-800 dark:text-amber-400">
                    {[
                      salaryResult.fines_late_minutes
                        ? salaryResult.fines_made_up_minutes
                          ? t('teacher.payslip.finesLateMadeUp', {
                              minutes: salaryResult.fines_late_minutes,
                              madeUp: salaryResult.fines_made_up_minutes,
                            })
                          : t('teacher.payslip.finesLate', { minutes: salaryResult.fines_late_minutes })
                        : null,
                      salaryResult.fines_early_minutes
                        ? t('teacher.payslip.finesEarly', { minutes: salaryResult.fines_early_minutes })
                        : null,
                      salaryResult.fines_misses ? t('teacher.payslip.finesMisses', { count: salaryResult.fines_misses }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('teacher.payslip.finesByHeadTeacher')}
                    {' · '}{t('teacher.payslip.finesRate')}
                  </div>
                  <div className="mt-2 font-semibold text-foreground">
                    {t('teacher.payslip.netPay', { amount: formatNumber(salaryResult.net_amount_tenge ?? salaryResult.total_amount_tenge) })}
                  </div>
                </div>
              )}
              {/* A miss nobody has priced is not a zero — say it is still being decided. */}
              {(salaryResult.fines_unpriced ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('teacher.payslip.finesUnpriced', { count: salaryResult.fines_unpriced ?? 0 })}
                </p>
              )}
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm space-y-1">
                <div>
                  {t('teacher.payslip.individualRate', { rate: salaryResult.individual_rate ?? '' })}
                  {salaryResult.group_band ? ` (${salaryResult.group_band})` : ''}
                </div>
                <div>
                  {t('teacher.payslip.groupRate', { rate: salaryResult.lesson_rate })}
                  {salaryResult.group_band ? ` (${salaryResult.group_band})` : ''}
                </div>
                {salaryResult.reference_rates && (
                  <>
                    <div>
                      {t('teacher.payslip.referenceRates', {
                        webinar: salaryResult.reference_rates.webinar_hourly,
                        officeHours: salaryResult.reference_rates.office_hours_hourly,
                        trial: salaryResult.reference_rates.trial_hourly,
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('teacher.payslip.referenceNote')}
                    </p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleOpenTelegramWithText}>
                  {t('teacher.payslip.openTelegram')}
                </Button>
              </div>
              <Textarea value={salaryResult.message_text} readOnly rows={18} className="font-mono text-xs" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Weekly Awards Hub */}
      <WeeklyAwardsHub 
        isOpen={isWeeklyAwardsOpen}
        onClose={() => setIsWeeklyAwardsOpen(false)}
      />

      <Dialog
        open={isAutoGradeDialogOpen}
        onOpenChange={(open) => {
          setIsAutoGradeDialogOpen(open);
          if (!open) {
            setAutoGradePreview([]);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('teacherDesk.autoGrade.title')}</DialogTitle>
            <DialogDescription>
              {t('teacherDesk.autoGrade.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              {withParts(t('teacherDesk.autoGrade.skipped'), {
                audio: <b>{t('teacherDesk.autoGrade.audio')}</b>,
                files: <b>{t('teacherDesk.autoGrade.files')}</b>,
              })}
            </div>

            {isAutoGradePreviewLoading ? (
              <div className="text-sm text-muted-foreground">{t('teacherDesk.autoGrade.loading')}</div>
            ) : autoGradePreview.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {t('teacherDesk.autoGrade.empty')}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  {t('teacherDesk.autoGrade.eligible', { count: autoGradePreview.length })}
                </p>
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-muted dark:bg-secondary/50 border-b border-border">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">{t('teacherDesk.col.homework')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('teacherDesk.col.student')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('teacherDesk.col.submitted')}</th>
                          <th className="text-left px-3 py-2 font-medium">{t('teacherDesk.col.score')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {autoGradePreview.map((item) => (
                          <tr key={item.submission_id}>
                            <td className="px-3 py-2 text-foreground">{item.assignment_title}</td>
                            <td className="px-3 py-2 text-foreground">{item.student_name}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDateTime(new Date(item.submitted_at))}
                            </td>
                            <td className="px-3 py-2 text-emerald-700 dark:text-emerald-400 font-medium">
                              {item.target_score}/{item.target_score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAutoGradeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleAutoGradeUnitHomework}
              disabled={isAutoGradePreviewLoading || isAutoGrading || autoGradePreview.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isAutoGrading ? t('teacherDesk.dashboard.autoGrading') : t('teacherDesk.autoGrade.confirm', { count: autoGradePreview.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

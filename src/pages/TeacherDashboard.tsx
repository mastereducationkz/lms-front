import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import { toast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
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
  Download,
  FileText,
  Unlock,
  Activity,
  Target
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
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { WeeklyAwardsHub } from '../components/gamification/WeeklyAwardsHub';

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
  course_id: number;
  course_title: string;
  current_lesson_id: number | null;
  current_lesson_title: string;
  lesson_progress: number;
  overall_progress: number;
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

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [ungradedQuizAttempts, setUngradedQuizAttempts] = useState<any[]>([]);
  const [gradedQuizAttempts, setGradedQuizAttempts] = useState<any[]>([]);
  const [studentsProgress, setStudentsProgress] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState('pending');
  const [activeGroup, setActiveGroup] = useState('all');
  
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
  
  // Weekly Awards Hub state
  const [isWeeklyAwardsOpen, setIsWeeklyAwardsOpen] = useState(false);
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

  const loadTeacherData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load teacher dashboard stats
      const dashboardData = await apiClient.getDashboardStats();
      const statsAny = (dashboardData as any)?.stats || {};
      
      const teacherStats: TeacherStats = {
        total_courses: statsAny.total_courses ?? 0,
        total_students: statsAny.total_students ?? 0,
        active_students: statsAny.active_students ?? 0,
        avg_student_progress: statsAny.avg_student_progress ?? 0,
        pending_submissions: 0,
        recent_enrollments: statsAny.recent_enrollments ?? 0,
        avg_completion_rate: statsAny.avg_completion_rate ?? 0,
        avg_student_score: statsAny.avg_student_score ?? 0,
        total_submissions: statsAny.total_submissions ?? 0,
        graded_submissions: statsAny.graded_submissions ?? 0,
        grading_progress: statsAny.grading_progress ?? 0,
        missing_attendance_reminders: statsAny.missing_attendance_reminders ?? []
      };

      setStats(teacherStats);

      // Load pending submissions
      try {
        const pending = await apiClient.getPendingSubmissions();
        setPendingSubmissions(pending);
        setStats(prev => prev ? { ...prev, pending_submissions: pending.length } : null);
      } catch (submissionError) {
        console.warn('Failed to load submissions:', submissionError);
        setPendingSubmissions([]);
      }

      // Load recent submissions (fetch more to build history)
      try {
        const recent = await apiClient.getRecentSubmissions(20);
        setRecentSubmissions(recent);
      } catch (recentError) {
        console.warn('Failed to load recent submissions:', recentError);
        setRecentSubmissions([]);
      }

      // Load students progress
      try {
        const studentsData = await apiClient.getTeacherStudentsProgress();
        setStudentsProgress(studentsData);
      } catch (progressError) {
        console.warn('Failed to load students progress:', progressError);
        setStudentsProgress([]);
      }

      // Load ungraded quiz attempts
      try {
        const quizAttempts = await apiClient.getUngradedQuizAttempts();
        setUngradedQuizAttempts(quizAttempts);
      } catch (quizError) {
        console.warn('Failed to load ungraded quiz attempts:', quizError);
        setUngradedQuizAttempts([]);
      }

      // Load graded quiz attempts
      try {
        const gradedAttempts = await apiClient.getGradedQuizAttempts();
        setGradedQuizAttempts(gradedAttempts);
      } catch (gradedError) {
        console.warn('Failed to load graded quiz attempts:', gradedError);
        setGradedQuizAttempts([]);
      }

    } catch (err) {
      setError('Failed to load teacher dashboard data');
      console.error('Teacher dashboard error:', err);
    } finally {
      setLoading(false);
    }
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
      toast('Failed to load details for grading', 'error');
      handleCloseGradingModal(); // Close modal if data fails to load
    }
  };

  const handleSubmitGrade = async () => {
    if (!selectedSubmission || !currentAssignment) return;

    // Validation
    if (gradingScore === '' || gradingScore === null || gradingScore === undefined) {
      toast('Please enter a grade score', 'error');
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
      
      toast('Submission graded successfully', 'success');
      handleCloseGradingModal();
      loadTeacherData(); // Refresh list
    } catch (error) {
      toast('Failed to grade submission', 'error');
      console.error('Grading error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAllowResubmission = async (submissionId: number) => {
    try {
      await apiClient.allowResubmission(String(submissionId));
      toast('Resubmission allowed', 'info');
      loadTeacherData();
    } catch (error) {
      toast('Failed to allow resubmission', 'error');
      console.error('Resubmission error:', error);
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
          toast('Restored draft from local storage', 'info');
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
      toast('Please enter a score', 'error');
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
      
      handleCloseQuizGradeModal();
      toast('Quiz graded successfully', 'success');
      loadTeacherData();
    } catch (error) {
      toast('Failed to grade quiz', 'error');
      console.error('Quiz grading error:', error);
    }
  };

  const handleDeleteQuizAttempt = async (attemptId: number) => {
    if (!confirm('Are you sure? The student will be able to resubmit.')) return;
    try {
      await apiClient.deleteQuizAttempt(attemptId);
      toast('Quiz attempt deleted', 'info');
      loadTeacherData();
    } catch (error) {
      toast('Failed to delete quiz attempt', 'error');
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
        assignment_title: attempt.quiz_title || 'Quiz',
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
        assignment_title: attempt.quiz_title || 'Quiz',
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
  }, [pendingSubmissions, recentSubmissions, ungradedQuizAttempts, gradedQuizAttempts]);

  const filteredSubmissions = useMemo(() => {
    if (activeTab === 'pending') {
      return unifiedSubmissions.filter(s => !s.is_graded);
    }
    if (activeTab === 'graded') {
      return unifiedSubmissions.filter(s => s.is_graded);
    }
    return unifiedSubmissions;
  }, [unifiedSubmissions, activeTab]);

  // Group filtering
  const uniqueGroups = useMemo(() => {
    const groups = new Set<string>();
    studentsProgress.forEach(s => {
      if (s.group_name) groups.add(s.group_name);
    });
    return Array.from(groups).sort();
  }, [studentsProgress]);

  const filteredStudents = useMemo(() => {
    if (activeGroup === 'all') return studentsProgress;
    return studentsProgress.filter(s => s.group_name === activeGroup);
  }, [studentsProgress, activeGroup]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setStudentPage(1);
  }, [activeGroup]);

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
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-400">
          <h3 className="font-bold">Error loading dashboard</h3>
          <p>{error}</p>
          <Button onClick={loadTeacherData} variant="outline" className="mt-2 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/20">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-foreground">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'admin' && (
            <Button
              onClick={() => navigate('/teacher/courses')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Manage Courses
            </Button>
          )}
          {(user?.role === 'admin' || user?.role === 'teacher' || user?.role === 'curator') && (
            <>
              <Button
                onClick={() => setIsWeeklyAwardsOpen(true)}
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-secondary"
              >
                🏆 Weekly Awards
              </Button>
              <Button
                onClick={() => navigate('/manual-unlocks')}
                variant="outline"
                className="border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                <Unlock className="w-4 h-4 mr-2" />
                Manual Unlocks
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Missing Attendance Reminders */}
      {stats?.missing_attendance_reminders && stats.missing_attendance_reminders.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium text-yellow-900 dark:text-yellow-400">
              Attendance Required ({stats.missing_attendance_reminders.length})
            </h3>
            <Button
              onClick={() => navigate('/attendance')}
              size="sm"
              variant="outline"
              className="text-xs h-6 px-2 border-yellow-300 dark:border-yellow-600 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
            >
              Go to Attendance
            </Button>
          </div>
          <div className="space-y-1.5">
            {stats.missing_attendance_reminders.slice(0, 3).map((reminder) => (
              <div key={reminder.event_id} className="flex items-center justify-between text-xs py-1.5 border-b border-yellow-100 dark:border-yellow-800 last:border-0">
                <div className="flex-1 min-w-0 mr-3">
                  <p className="text-yellow-900 dark:text-yellow-400 truncate font-medium">{reminder.title}</p>
                  <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                    {reminder.group_name} • {new Date(reminder.event_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] text-yellow-700 dark:text-yellow-400">
                    {reminder.recorded_students}/{reminder.expected_students}
                  </span>
                  <Button
                    onClick={() => {
                      if (reminder.group_id) {
                        navigate(`/attendance?group=${reminder.group_id}`);
                      } else {
                        navigate('/attendance');
                      }
                    }}
                    size="sm"
                    variant="ghost"
                    className="text-[11px] h-6 px-2 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                  >
                    Mark
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Stats - Student Dynamics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Reviews - Action Required */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Pending Reviews</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats?.pending_submissions || 0}</span>
              {(stats?.total_submissions ?? 0) > 0 && (
                <span className="text-sm text-gray-400 dark:text-gray-500">
                  / {stats?.total_submissions}
                </span>
              )}
            </div>
            {(stats?.pending_submissions ?? 0) > 0 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">Requires attention</p>
            )}
          </CardContent>
        </Card>

        {/* Activity Rate */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Active This Week</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats?.active_students || 0}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                / {stats?.total_students || 0}
              </span>
            </div>
            {(stats?.total_students ?? 0) > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {Math.round(((stats?.active_students || 0) / (stats?.total_students || 1)) * 100)}% engagement
              </p>
            )}
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats?.avg_student_score || 0}</span>
              <span className="text-sm text-gray-400 dark:text-gray-500">pts</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              From {stats?.graded_submissions || 0} graded
            </p>
          </CardContent>
        </Card>

        {/* Overall Progress */}
        <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Progress</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900 dark:text-foreground">{stats?.avg_student_progress || 0}%</span>
            </div>
            <div className="mt-2">
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${stats?.avg_student_progress || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Unified Submissions Table */}
      <Card className="shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <div>
                <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">Submissions</CardTitle>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage student assignments and grading</p>
              </div>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="grid w-full grid-cols-3 sm:w-[300px]">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="graded">Graded</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center bg-gray-50/50 dark:bg-secondary/50">
              <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-1">No submissions found</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {activeTab === 'pending' 
                  ? "You're all caught up! No pending reviews." 
                  : "No submissions match the current filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-secondary/50 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">Student</th>
                    <th className="text-left px-6 py-3 font-semibold">Type</th>
                    <th className="text-left px-6 py-3 font-semibold">Title</th>
                    <th className="text-left px-6 py-3 font-semibold">Status</th>
                    <th className="text-left px-6 py-3 font-semibold">Submitted</th>
                    <th className="text-left px-6 py-3 font-semibold">Score</th>
                    <th className="text-right px-6 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredSubmissions.map((submission) => (
                    <tr key={submission.id} className="hover:bg-gray-50/80 dark:hover:bg-secondary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mr-3 text-gray-600 dark:text-gray-300 font-medium text-xs">
                            {submission.student_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-foreground">{submission.student_name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{submission.student_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant="outline"
                          className={submission.type === 'quiz' 
                            ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800" 
                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"}
                        >
                          {submission.type === 'quiz' ? 'Quiz' : 'Homework'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-foreground">{submission.assignment_title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge 
                          variant={submission.is_graded ? "outline" : "default"}
                          className={submission.is_graded 
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/20" 
                            : "bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-800/30 border-transparent"}
                        >
                          {submission.is_graded ? 'Graded' : 'Needs Grading'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1.5 text-gray-400 dark:text-gray-500" />
                          {new Date(submission.submitted_at).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
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
                          <span className="text-gray-400 dark:text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {submission.type === 'quiz' ? (
                            <>
                              <Button
                                size="sm"
                                className="bg-purple-600 hover:bg-purple-700"
                                onClick={() => handleGradeQuizClick(submission)}
                              >
                                <ClipboardCheck className="w-4 h-4 mr-1" />
                                Grade
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                onClick={() => handleDeleteQuizAttempt(submission.quiz_attempt_id)}
                                title="Allow Resubmission"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant={submission.is_graded ? "ghost" : "default"}
                                className={submission.is_graded ? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20" : "bg-blue-600 hover:bg-blue-700"}
                                onClick={() => handleGradeSubmission(submission)}
                              >
                                {submission.is_graded ? <Eye className="w-4 h-4 mr-1" /> : <ClipboardCheck className="w-4 h-4 mr-1" />}
                                {submission.is_graded ? 'View' : 'Grade'}
                              </Button>
                              {!submission.is_graded && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                  onClick={() => handleAllowResubmission(submission.id)}
                                >
                                  Resubmit
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
      <Card className="shadow-sm">
        <CardHeader className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold text-gray-900 dark:text-foreground">Student Progress</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">Overview of all students across your courses</p>
            </div>
            
            {uniqueGroups.length > 0 && (
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <Select value={activeGroup} onValueChange={setActiveGroup}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Students</SelectItem>
                    {uniqueGroups.map(group => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center bg-gray-50/50 dark:bg-secondary/50">
              <Users className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-1">No students found</h3>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting the group filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50/80 dark:bg-secondary/50 text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700">
                  <tr>
                    <th className="text-left px-6 py-3 font-semibold">Student</th>
                    <th className="text-left px-6 py-3 font-semibold">Group</th>
                    <th className="text-left px-6 py-3 font-semibold">Course</th>
                    <th className="text-left px-6 py-3 font-semibold">Current Lesson</th>
                    <th className="text-left px-6 py-3 font-semibold">Progress</th>
                    <th className="text-left px-6 py-3 font-semibold">Last Activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginatedStudents.map((student, index) => (
                    <tr key={`${student.student_id}-${student.course_id}-${index}`} className="hover:bg-gray-50/80 dark:hover:bg-secondary/30 transition-colors">
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
                            <div className="font-medium text-gray-900 dark:text-foreground">{student.student_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{student.student_email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {student.group_name ? (
                          <Badge variant="outline" className="bg-gray-50 dark:bg-secondary inline-flex items-center whitespace-nowrap">
                            {student.group_name.split("-")[1]}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-foreground">{student.course_title}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="text-sm font-medium truncate max-w-[150px]" title={student.current_lesson_title}>
                            {student.current_lesson_title}
                          </div>
                          {student.current_lesson_id && (
                            <div className="flex items-center space-x-2">
                              <Progress value={student.lesson_progress} className="w-16 h-2" />
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {student.lesson_progress}%
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center max-w-[160px]">
                          <div className="flex-1 mr-3">
                            <Progress value={student.overall_progress} className="h-2.5 w-24" />
                          </div>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 w-8">
                            {student.overall_progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                        {student.last_activity 
                          ? new Date(student.last_activity).toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric'
                          })
                          : <span className="text-gray-400 dark:text-gray-500">Never</span>
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-secondary rounded-b-xl">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Showing {((studentPage - 1) * studentsPerPage) + 1} to {Math.min(studentPage * studentsPerPage, filteredStudents.length)} of {filteredStudents.length} students
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                  disabled={studentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
                  Page {studentPage} of {totalStudentPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                  disabled={studentPage >= totalStudentPages}
                >
                  Next
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
            <DialogTitle>Grade Quiz Submission</DialogTitle>
          </DialogHeader>
          
          {selectedQuizAttempt && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-secondary p-4 rounded-lg">
                <div>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Student:</span>
                  <p className="text-gray-900 dark:text-foreground">{selectedQuizAttempt.student_name}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Quiz:</span>
                  <p className="text-gray-900 dark:text-foreground">{selectedQuizAttempt.assignment_title}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Lesson:</span>
                  <p className="text-gray-900 dark:text-foreground">{selectedQuizAttempt.lesson_title}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">Course:</span>
                  <p className="text-gray-900 dark:text-foreground">{selectedQuizAttempt.course_title}</p>
                </div>
              </div>

              {/* Quiz Reference Material */}
              {selectedQuizAttempt.quiz_media_url && (
                <div className="mb-6 bg-gray-50 dark:bg-secondary p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold mb-3 text-gray-900 dark:text-foreground flex items-center">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Reference Material
                  </h4>
                  
                  {selectedQuizAttempt.quiz_media_type === 'pdf' ? (
                    <div className="aspect-[16/9] w-full">
                       <iframe 
                         src={(import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000') + selectedQuizAttempt.quiz_media_url} 
                         className="w-full h-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-card"
                         title="Reference PDF"
                       />
                       <div className="mt-2 text-right">
                         <a 
                           href={selectedQuizAttempt.quiz_media_url} 
                           target="_blank" 
                           rel="noreferrer"
                           className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                         >
                           Open PDF in new tab
                         </a>
                       </div>
                    </div>
                  ) : selectedQuizAttempt.quiz_media_type === 'image' ? (
                    <div className="flex justify-center">
                      <img 
                        src={selectedQuizAttempt.quiz_media_url} 
                        alt="Reference" 
                        className="max-h-96 rounded shadow-sm object-contain"
                      />
                    </div>
                  ) : (
                    // Default/Text fallback
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
                      dangerouslySetInnerHTML={{ __html: selectedQuizAttempt.quiz_media_url }}
                    />
                  )}
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-foreground">Quiz Answers</h3>
                {selectedQuizAttempt.quiz_answers?.length > 0 ? (
                  <div className="space-y-6">
                    {selectedQuizAttempt.quiz_answers.map((item: any, idx: number) => (
                      <div key={idx} className={`border rounded-lg overflow-hidden ${
                        item.question_type !== 'long_text' 
                          ? (item.is_correct ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800')
                          : 'border-gray-200 dark:border-gray-700'
                      }`}>
                        {/* Header with Type and Status */}
                        <div className="p-3 bg-gray-50 dark:bg-secondary border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Question {idx + 1}</span>
                          <div className="flex gap-2">
                             <span className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 capitalize">
                               {item.question_type?.replace('_', ' ') || 'Question'}
                             </span>
                             {item.question_type !== 'long_text' && (
                               <span className={`text-xs px-2 py-1 rounded font-medium ${
                                 item.is_correct ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                               }`}>
                                 {item.is_correct ? 'Correct' : 'Incorrect'}
                               </span>
                             )}
                          </div>
                        </div>

                        {/* Passage (if exists) */}
                        {item.content_text && (
                          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                            <p className="text-[14px] font-semibold text-black-600 dark:text-gray-200 bold mb-1">Passage</p>
                            <div 
                              className="text-gray-800 dark:text-gray-200 prose prose-sm max-w-none text-[14px]"
                              dangerouslySetInnerHTML={{ __html: item.content_text }}
                            />
                          </div>
                        )}
                        
                        {/* Question Text */}
                        <div className="p-4 bg-white dark:bg-card border-b border-gray-200 dark:border-gray-700">
                          <p className="text-gray-900 dark:text-foreground font-medium">{item.question_text}</p>
                        </div>

                        {/* Answer Section */}
                        <div className="p-4 bg-gray-50 dark:bg-secondary">
                          <div className="grid gap-4">
                            <div>
                               <p className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 mb-1">{selectedQuizAttempt?.student_name}'s Answer</p>
                               <div className={`text-gray-800 dark:text-gray-200 whitespace-pre-wrap p-3 rounded border ${
                                 item.question_type === 'long_text' 
                                   ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' 
                                   : (item.is_correct ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800')
                               }`}>
                                 {item.student_answer || <span className="text-gray-400 dark:text-gray-500 italic">No answer provided</span>}
                               </div>
                            </div>
                            
                            {/* Correct Answer Display (if incorrect and not long_text) */}
                            {item.question_type !== 'long_text' && !item.is_correct && (
                               <div>
                                  <p className="text-[12px] font-semibold text-green-600 dark:text-green-400 uppercase mb-1">Correct Answer</p>
                                  <div className="text-gray-800 dark:text-gray-200 p-3 rounded border border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                                    {item.correct_answer || 'N/A'}
                                  </div>
                               </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No answers found</p>
                )}
              </div>

              <div className="grid gap-4 border-t pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="quizScore">Score (0-100)</Label>
                  <Input
                    id="quizScore"
                    type="number"
                    min="0"
                    max="100"
                    value={quizGradeScore}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') setQuizGradeScore('');
                      else setQuizGradeScore(Number(val));
                    }}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="quizFeedback">Feedback</Label>
                  <Textarea
                    id="quizFeedback"
                    placeholder="Enter feedback for the student..."
                    value={quizGradeFeedback}
                    onChange={(e) => setQuizGradeFeedback(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseQuizGradeModal}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSubmitQuizGrade}>Submit Grade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assignment Grading Modal */}
      <Dialog open={isGradingModalOpen} onOpenChange={(open) => !open && handleCloseGradingModal()}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade Submission</DialogTitle>
            <DialogDescription>
              Review the student's work and provide a score and feedback.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 my-4">
            {/* Left side - Submission Content View (2/3 width) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-foreground mb-4 flex items-center">
                  <FileText className="w-4 h-4 mr-2" />
                  Student's Work
                </h3>
                
                {currentAssignment?.assignment_type === 'multi_task' && selectedSubmission ? (
                  <MultiTaskSubmission 
                    assignment={currentAssignment} 
                    initialAnswers={selectedSubmission.answers} 
                    readOnly={true}
                    onSubmit={() => {}}
                    studentId={String(selectedSubmission.user_id)}
                  />
                ) : (
                  <div className="space-y-4">
                    {selectedSubmission?.file_url && (
                      <div className="flex items-center p-3 bg-white dark:bg-card rounded border border-gray-200 dark:border-gray-700">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                        <div className="flex-1">
                          <div className="font-medium">{selectedSubmission.submitted_file_name || 'Attached File'}</div>
                        </div>
                        <a 
                           href={(selectedSubmission.file_url.startsWith('http') ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000')) + selectedSubmission.file_url}
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium flex items-center"
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </a>
                      </div>
                    )}
                    
                    {selectedSubmission?.answers?.text && (
                      <div className="bg-white dark:bg-card p-4 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
                        {selectedSubmission.answers.text}
                      </div>
                    )}
                    
                    {!selectedSubmission?.file_url && !selectedSubmission?.answers?.text && currentAssignment?.assignment_type !== 'multi_task' && (
                      <div className="text-gray-500 dark:text-gray-400 italic">No content to display.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Grading Controls (1/3 width) */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-card p-4 border border-gray-200 dark:border-gray-700 rounded-lg sticky top-4">
                <h3 className="font-semibold text-gray-900 dark:text-foreground mb-4">Grading</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gradeScore">Score (Max: {currentAssignment?.max_score})</Label>
                    <Input
                      id="gradeScore"
                      type="number"
                      min="0"
                      max={currentAssignment?.max_score || 100}
                      value={gradingScore}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') {
                          setGradingScore('');
                        } else {
                          setGradingScore(Math.min(parseInt(val) || 0, currentAssignment?.max_score || 100));
                        }
                      }}
                      placeholder="Enter score"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="gradeFeedback">Feedback</Label>
                    <Textarea
                      id="gradeFeedback"
                      value={gradingFeedback}
                      onChange={(e) => setGradingFeedback(e.target.value)}
                      placeholder="Provide feedback to the student..."
                      className="min-h-[200px]"
                      rows={8}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseGradingModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmitGrade} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Grade'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Weekly Awards Hub */}
      <WeeklyAwardsHub 
        isOpen={isWeeklyAwardsOpen}
        onClose={() => setIsWeeklyAwardsOpen(false)}
      />
    </div>
  );
}

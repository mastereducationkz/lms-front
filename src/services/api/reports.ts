import { api } from './client';

/**
 * Staff-facing student results report (backend /reports).
 *
 * Access is enforced server-side: admin / head_curator / head_teacher get any
 * student, a curator only students of groups they curate. These calls simply
 * surface whatever the server allows.
 */

export interface ReportSubmission {
  id: number;
  graded_at: string | null;
  is_late: boolean;
  feedback: string | null;
  file_url: string | null;
  file_name: string | null;
}

export interface ReportHomeworkItem {
  id: number;
  title: string;
  due_date: string | null;
  max_score: number | null;
  lesson_id: number | null;
  status: 'graded' | 'submitted' | 'not_submitted';
  score: number | null;
  submitted_at: string | null;
  submission: ReportSubmission | null;
}

export interface ReportQuizAttempt {
  completed_at: string | null;
  correct: number;
  total_questions: number;
  pct: number;
}

export interface ReportQuizSection {
  lesson_id: number | null;
  lesson_title: string;
  attempts: number;
  average_pct: number;
  best_pct: number;
  attempt_details: ReportQuizAttempt[];
}

export interface ReportQuizCourse {
  course_id: number;
  course_title: string;
  total_attempts: number;
  completed_attempts: number;
  draft_attempts: number;
  average_pct: number | null;
  sections: ReportQuizSection[];
}

export interface WeeklyTestSide {
  test_name?: string | null;
  completed_at?: string | null;
  correct: number | null;
  total: number | null;
  pct?: number | null;
  feedback?: string | null;
}

export interface WeeklySatTest {
  week_label: string;
  completed_at: string | null;
  math: WeeklyTestSide | null;
  verbal: WeeklyTestSide | null;
}

export interface WeeklyIeltsTest {
  set_id: number | null;
  week_label: string | null;
  listening_band: number | null;
  reading_band: number | null;
  writing_band: number | null;
  speaking_band: number | null;
  overall_band: number | null;
  speaking_status: string | null;
  feedback: {
    listening: string | null;
    reading: string | null;
    writing: string | { task1?: string | null; task2?: string | null } | null;
    speaking: string | { [criterion: string]: string | null } | null;
  };
}

export interface StudentReport {
  student: {
    id: number;
    name: string;
    email: string;
    created_at: string | null;
    groups: { id: number; name: string; joined_at: string | null }[];
  };
  homework: {
    assigned: number;
    submitted: number;
    graded: number;
    earned_score: number;
    max_score: number;
    items: ReportHomeworkItem[];
  };
  quizzes: ReportQuizCourse[];
  bluebook: {
    test_number: number;
    taken_at: string | null;
    verbal: number;
    math: number;
    total: number;
    source: string;
  }[];
  exams: {
    results: {
      exam_type: string;
      test_date: string | null;
      total_score: number;
      verbal_score: number | null;
      math_score: number | null;
      status: string;
    }[];
    sat_planned_date: string | null;
    ielts_planned_date: string | null;
  };
  courses: {
    course_id: number;
    course_title: string;
    total_steps: number;
    completed_steps: number;
    completion_pct: number;
    time_spent_minutes: number;
    last_activity_at: string | null;
  }[];
  attendance: {
    marked_total: number;
    attended: number;
    late: number;
    absent: number;
    attendance_pct: number | null;
    absences: { date: string | null; title: string }[];
    lates: { date: string | null; title: string }[];
  };
  activity: {
    daily_questions_completed: number;
    points_total: number;
    points_by_reason: Record<string, number>;
  };
  weekly_tests: {
    sat: WeeklySatTest[];
    ielts: WeeklyIeltsTest[];
    nuet: WeeklySatTest[];
    errors: string[];
  };
  generated_at: string;
}

export interface SubmissionTask {
  id: string | null;
  title: string | null;
  task_type: string | null;
  question: string | null;
  points: number | null;
}

export interface SubmissionDetail {
  assignment: {
    id: number;
    title: string | null;
    assignment_type: string | null;
    max_score: number | null;
    tasks: SubmissionTask[];
  };
  submission: {
    id: number;
    score: number | null;
    max_score: number | null;
    is_graded: boolean;
    is_late: boolean;
    feedback: string | null;
    file_url: string | null;
    file_name: string | null;
    submitted_at: string | null;
    graded_at: string | null;
    answers: Record<string, unknown> | null;
  };
}

/** The content of one homework submission (staff report drill-down). */
export async function getSubmissionDetail(studentId: number, submissionId: number): Promise<SubmissionDetail> {
  const response = await api.get(`/reports/students/${studentId}/submissions/${submissionId}`);
  return response.data;
}

export async function getStudentReport(studentId: number): Promise<StudentReport> {
  // The external-platform fetches make this slower than a normal read; never cache
  // so a curator always sees fresh weekly results.
  const response = await api.get(`/reports/students/${studentId}`, { cache: false } as { cache: boolean });
  return response.data;
}

/** Download the PDF version of the report and hand it to the browser. */
export async function downloadStudentReportPdf(studentId: number, studentName?: string): Promise<void> {
  const response = await api.get(`/reports/students/${studentId}/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(studentName || `student_${studentId}`).replace(/\s+/g, '_')}_report.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

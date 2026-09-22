import type { AxiosRequestConfig } from 'axios';

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
    // Of `absent`, how many carry a recorded excuse. Optional — older payloads (and any
    // caller that doesn't care) never send it. `absent` itself is unaffected: an excused
    // absence is still an absence, just one that doesn't hit billing.
    absent_excused?: number;
    attendance_pct: number | null;
    // `excused`/`excuse_note` are only ever set on an absence row — a late arrival has
    // no notion of an excuse — and both are optional since older report payloads (and
    // the `lates` rows) never carry them.
    absences: { date: string | null; title: string; excused?: boolean; excuse_note?: string | null }[];
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
  /** How much the student speaks in Meet lessons; null while talk time is switched off. */
  talk?: ReportTalk | null;
  generated_at: string;
}

export interface ReportTalkLesson {
  event_id: number;
  start: string;
  title: string;
  group_name: string | null;
  seconds: number;
  /** Of all the students' speech in that lesson, 0–1. */
  share_of_students: number;
  in_room: boolean;
  /** Needs the lesson's transcript; null without one. */
  questions: number | null;
  /** Teacher questions the student answered first (within 20 s); null without a transcript. */
  answers?: number | null;
}

export interface ReportTalk {
  lessons: ReportTalkLesson[];
  totals: { lessons: number; lessons_spoke: number; total_seconds: number; avg_seconds: number; questions: number | null; answers?: number | null };
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
  const response = await api.get(`/reports/students/${studentId}`, { cache: false } as AxiosRequestConfig & { cache?: boolean });
  return response.data;
}

export interface PdfExportOptions {
  /** Section keys understood by the backend; omit for the full report. */
  sections?: string[];
  includeFeedback?: boolean;
}

/** Download the PDF version of the report and hand it to the browser. */
export async function downloadStudentReportPdf(
  studentId: number,
  studentName?: string,
  options?: PdfExportOptions,
): Promise<void> {
  const params: Record<string, string | boolean> = {};
  if (options?.sections && options.sections.length > 0) params.sections = options.sections.join(',');
  if (options?.includeFeedback === false) params.include_feedback = false;
  const response = await api.get(`/reports/students/${studentId}/pdf`, {
    responseType: 'blob',
    params,
  });
  const url = URL.createObjectURL(response.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(studentName || `student_${studentId}`).replace(/\s+/g, '_')}_report.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ------------------------------------------------------------------ */
/* Еженедельные отчёты родителям (backend /reports/parent)             */
/* ------------------------------------------------------------------ */

export interface ParentTestSide {
  correct: number | null;
  total: number | null;
}

export interface ParentWeekTest {
  program: 'sat' | 'nuet' | 'ielts';
  label: string | null;
  date: string | null;
  verbal: ParentTestSide;
  math: ParentTestSide;
  prev: { label: string | null; verbal: ParentTestSide; math: ParentTestSide } | null;
  delta: { verbal: number | null; math: number | null } | null;
}

export interface ParentWeekFacts {
  student: { id: number; name: string };
  group: { id: number | null; name: string | null };
  week: { start: string; end: string };
  test: ParentWeekTest | null;
  test_unavailable: boolean;
  homework: { assigned: number; submitted: number; missing: string[] } | null;
  attendance: {
    lessons: number;
    present: number;
    late: number;
    absences: { date: string; excused: boolean }[];
  };
  talk: {
    lessons: number;
    lessons_spoke: number;
    /** Бэкенд отдаёт его в totals; без объявления поле молча теряется у потребителя. */
    total_seconds: number;
    avg_seconds: number;
    questions: number | null;
    answers: number | null;
  } | null;
  strength: { label: string; source: string; pct: number } | null;
  weakness: { label: string; source: string; pct: number } | null;
  teacher_feedback: { verbal: string | null; math: string | null } | null;
  no_growth_streak: number;
  curator_note: string | null;
}

export type ParentTemplateKey = 't1' | 't2' | 't3' | 't4' | 't5';

export interface ParentReportRow {
  template_key: ParentTemplateKey;
  template_auto: boolean;
  body: string;
  body_generated: string;
  curator_note: string | null;
  facts: ParentWeekFacts;
  updated_at: string | null;
}

export interface ParentStudentResponse {
  week_start: string;
  facts: ParentWeekFacts;
  suggested_template: ParentTemplateKey;
  suggested_reason: string;
  report: ParentReportRow | null;
  /** Проза не сгенерировалась — отдан детерминированный каркас. */
  prose_degraded?: boolean;
}

export interface ParentGroupOverview {
  week_start: string;
  students: { id: number; name: string; report: ParentReportRow | null }[];
}

export async function fetchParentGroupOverview(
  groupId: number,
  week: string,
  config?: AxiosRequestConfig,
): Promise<ParentGroupOverview> {
  const { data } = await api.get(`/reports/parent/groups/${groupId}`, {
    ...config,
    params: { week },
  });
  return data;
}

export async function fetchParentStudentFacts(
  studentId: number,
  week: string,
  config?: AxiosRequestConfig,
): Promise<ParentStudentResponse> {
  const { data } = await api.get(`/reports/parent/students/${studentId}`, {
    ...config,
    params: { week },
  });
  return data;
}

export async function generateParentReport(
  studentId: number,
  payload: { week: string; template?: ParentTemplateKey; note?: string },
): Promise<ParentStudentResponse> {
  const { data } = await api.post(`/reports/parent/students/${studentId}`, payload);
  return data;
}

export async function saveParentReport(
  studentId: number,
  payload: { week: string; body: string; note?: string | null },
): Promise<ParentReportRow> {
  const { data } = await api.put(`/reports/parent/students/${studentId}`, payload);
  return data;
}

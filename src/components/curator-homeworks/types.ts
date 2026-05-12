export interface StudentProgress {
  student_id: number;
  student_name: string;
  student_email: string;
  status: 'not_submitted' | 'submitted' | 'graded' | 'overdue';
  submission_id: number | null;
  score: number | null;
  max_score: number;
  submitted_at: string | null;
  graded_at: string | null;
  feedback: string | null;
}

export interface SubmissionDetails {
  id: number;
  assignment_id: number;
  user_id: number;
  submitted_at: string;
  score?: number | null;
  is_graded: boolean;
  file_url?: string;
  submitted_file_name?: string;
  answers?: Record<string, any>;
  feedback?: string;
}

export interface AssignmentSummary {
  total_students: number;
  submitted: number;
  graded: number;
  not_submitted: number;
  overdue: number;
  average_score: number;
}

export interface TaskContent {
  id: string;
  task_type: 'course_unit' | 'file_task' | 'text_task' | 'link_task' | 'pdf_text_task';
  content: {
    question?: string;
    link_description?: string;
    url?: string;
    course_id?: number;
    lesson_ids?: number[];
    teacher_file_url?: string;
    teacher_file_name?: string;
    allowed_file_types?: string[];
    max_file_size_mb?: number;
    max_length?: number;
    keywords?: string[];
  };
}

export interface AssignmentContent {
  tasks?: TaskContent[];
  question?: string;
  options?: string[];
}

export interface AssignmentData {
  id: number;
  title: string;
  description: string;
  course_title: string;
  due_date: string | null;
  max_score: number;
  assignment_type: string;
  content?: AssignmentContent;
  summary: AssignmentSummary;
  students: StudentProgress[];
}

export interface GroupData {
  group_id: number;
  group_name: string;
  is_over?: boolean;
  students_count: number;
  assignments: AssignmentData[];
}

export type StatusFilter = 'all' | 'submitted' | 'graded' | 'not_submitted';

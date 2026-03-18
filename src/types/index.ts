// =============================================================================
// CORE TYPES
// =============================================================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  name?: string; // Для обратной совместимости
  role: UserRole;
  student_id?: string;
  teacher_name?: string;
  curator_name?: string;
  group_id?: number; // ID группы, в которой состоит студент (deprecated)
  group_ids?: number[]; // List of group IDs for students (new - supports multiple groups)
  is_active?: boolean;
  daily_streak?: number; // Current daily streak count
  last_activity_date?: string; // Last date when student was active
  total_study_time_minutes?: number; // Total study time in minutes
  onboarding_completed?: boolean; // Whether user has completed onboarding
  onboarding_completed_at?: string; // When onboarding was completed
  assignment_zero_completed?: boolean; // Whether student has completed Assignment Zero
  assignment_zero_completed_at?: string; // When Assignment Zero was completed
  created_at: string;
  updated_at: string;
  course_ids?: number[]; // List of course IDs for head teachers
  no_substitutions?: boolean; // Teacher opt-out of substitutions
}

export type UserRole = 'student' | 'teacher' | 'curator' | 'admin' | 'head_curator' | 'head_teacher';

// =============================================================================
// AUTH TYPES
// =============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

// =============================================================================
// STEP TYPES
// =============================================================================

export interface StepAttachment {
  id: number;
  filename: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface Step {
  id: number;
  lesson_id: number;
  title: string;
  content_type: 'text' | 'video_text' | 'quiz' | 'flashcard' | 'summary';
  video_url?: string;
  content_text?: string;
  attachments?: string; // JSON string of StepAttachment[]
  order_index: number;
  created_at: string;
  is_completed?: boolean;
  is_optional?: boolean;
}

// =============================================================================
// QUIZ SUMMARY TYPES
// =============================================================================

export interface QuizSummaryItem {
  step_id: number;
  quiz_title: string;
  order_index: number;
  last_attempt: {
    score: number;
    total: number;
    percentage: number;
    completed_at: string;
  } | null;
}

export interface LessonQuizSummary {
  quizzes: QuizSummaryItem[];
  overall_stats: {
    average_percentage: number;
    total_questions: number;
    total_correct: number;
  };
}

export interface StepProgress {
  id: number;
  user_id: number;
  course_id: number;
  lesson_id: number;
  step_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at?: string;
  visited_at?: string;
  completed_at?: string;
  time_spent_minutes: number;
}

export interface StepProgressCreate {
  step_id: number;
  time_spent_minutes: number;
}

export interface StudentStepProgress {
  student_id: number;
  student_name: string;
  completed_steps: number;
  total_steps: number;
  completion_percentage: number;
  time_spent_minutes: number;
}

export interface LessonStepsProgress {
  lesson_id: number;
  lesson_title: string;
  total_steps: number;
  students_progress: StudentStepProgress[];
}

export interface ModuleStepsProgress {
  module_id: number;
  module_title: string;
  lessons: LessonStepsProgress[];
}

export interface CourseStepsProgress {
  course_id: number;
  course_title: string;
  total_students: number;
  modules: ModuleStepsProgress[];
}

export interface StudentProgressOverview {
  student_id: number;
  student_name: string;
  total_courses: number;
  total_lessons: number;
  total_steps: number;
  completed_lessons: number;
  completed_steps: number;
  overall_completion_percentage: number;
  total_time_spent_minutes: number;
  daily_streak?: number; // Current daily streak count
  last_activity_date?: string; // Last date when student was active
  courses: StudentCourseProgress[];
  group_teachers?: { id: number; name: string }[];
}

export interface StudentCourseProgress {
  course_id: number;
  course_title: string;
  teacher_id: number;
  teacher_name: string;
  cover_image_url?: string;
  total_lessons: number;
  total_steps: number;
  completed_lessons: number;
  completed_steps: number;
  completion_percentage: number;
  time_spent_minutes: number;
  last_accessed?: string;
}

export interface DailyStreakInfo {
  student_id: number;
  student_name: string;
  daily_streak: number;
  last_activity_date?: string;
  streak_status: 'not_started' | 'active' | 'at_risk' | 'broken';
  is_active_today: boolean;
  total_study_time_minutes: number;
  current_multiplier?: number;
  next_multiplier_at?: number;
}

// =============================================================================
// COURSE TYPES
// =============================================================================

export interface Course {
  id: string;
  title: string;
  description: string;
  teacher_id: string;
  teacher?: User;
  teacher_name?: string; // Added to match backend response
  image?: string;
  cover_image_url?: string;
  estimated_duration_minutes?: number;
  isActive?: boolean;
  created_at: string;
  updated_at: string;
  progress?: number; // For student view
  is_linear?: boolean;
  release_schedule?: 'all' | 'weekly'; // "all" = all open; "weekly" = unlock by week from group start
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  teacher_id: number;
  teacher_name?: string;
  curator_id?: number;
  curator_name?: string;
  student_count: number;
  students?: User[];
  created_at: string;
  is_active: boolean;
  is_special?: boolean;
  schedule_config?: any;
  current_week?: number;
  max_week?: number;
}

export interface CourseGroupAccess {
  id: number;
  course_id: number;
  group_id: number;
  group_name?: string;
  student_count: number;
  granted_by: number;
  granted_by_name?: string;
  granted_at: string;
  is_active: boolean;
}

export interface AdminStats {
  total_users: number;
  total_students: number;
  total_teachers: number;
  total_curators: number;
  total_courses: number;
  total_active_enrollments: number;
  recent_registrations: number;
  missing_attendance_reminders?: Array<{
    event_id: number;
    title: string;
    group_name: string;
    group_id?: number | null;
    event_date: string;
    expected_students: number;
    recorded_students: number;
  }>;
}

export interface AdminDashboard {
  stats: AdminStats;
  recent_users: User[];
  recent_groups: Group[];
  recent_courses: Array<{
    id: number;
    title: string;
    teacher_name: string;
    module_count: number;
    is_active: boolean;
    created_at: string;
  }>;
}

export interface UserListResponse {
  users: User[];
  total: number;
  skip: number;
  limit: number;
}

export interface GroupListResponse {
  groups: Group[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  teacher_id: number;
  curator_id?: number;
  course_id?: number; // Курс, к которому привязана группа
  is_active?: boolean;
  is_special?: boolean;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  teacher_id?: number;
  is_active?: boolean;
  is_special?: boolean;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  student_id?: string;
  group_ids?: number[]; // Multiple groups for students
  is_active?: boolean;
  course_ids?: number[]; // Courses for head teachers
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  student_id?: string;
  group_ids?: number[]; // Multiple groups for students
  is_active?: boolean;
  password?: string;
  course_ids?: number[]; // Courses for head teachers
}

export interface BulkCreateUsersResponse {
  created_users: Array<{
    user: User;
    generated_password?: string;
  }>;
  failed_users: Array<{
    email: string;
    error: string;
  }>;
}

export interface CourseModule {
  id: number;
  course_id: string;
  title: string;
  description: string;
  order_index: number;
  total_lessons?: number;
  lessons?: Lesson[];
  created_at: string;
  updated_at: string;
  is_completed?: boolean;
  week_number?: number | null; // For weekly release: which week (1-based) this module unlocks
}

// Updated lesson interface without content fields
export interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  order_index: number;
  duration_minutes?: number;
  created_at: string;
  updated_at: string;
  is_completed?: boolean; // For student view
  is_initially_unlocked?: boolean; // Admin can mark lessons as initially unlocked
  steps?: Step[];
  total_steps?: number;
  next_lesson_id?: number | null;
}

// Legacy lesson interface for backward compatibility (will be removed)
export interface LegacyLesson {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content_type: LessonContentType;
  video_url?: string;
  content_text?: string;
  order_index: number;
  duration_minutes?: number;
  created_at: string;
  updated_at: string;
  is_completed?: boolean; // For student view
  quiz_data?: QuizData;
}

export type LessonContentType = 'video' | 'text' | 'quiz' | 'materials' | 'mixed';

// =============================================================================
// QUIZ TYPES
// =============================================================================

export interface QuestionOption {
  id: string;
  text: string;
  is_correct: boolean;
  image_url?: string;
  letter?: string; // For SAT format: A, B, C, D
}

export interface Question {
  id: string;
  assignment_id: string;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'short_answer' | 'fill_blank' | 'text_completion' | 'long_text' | 'media_question' | 'media_open_question' | 'matching' | 'image_content';
  options?: QuestionOption[];
  correct_answer: any; // Use any to avoid complex type issues
  points: number;
  order_index: number;
  // SAT-specific fields
  explanation?: string; // Explanation for the correct answer
  original_image_url?: string; // URL of the original SAT image
  is_sat_question?: boolean; // Flag to identify SAT questions
  content_text?: string; // The full content/passage that the question is based on
  // New fields for enhanced question types
  media_url?: string; // For PDF/image attachments
  media_type?: 'pdf' | 'image'; // Type of media attachment
  expected_length?: number; // For long text questions (character count)
  keywords?: string[]; // For auto-grading long text answers
  gap_separator?: string; // Custom separator for fill_blank questions (default: ',')
  show_numbering?: boolean; // Show numbering before input fields in text_completion (e.g., "1. [input] 2. [input]")
  needs_image?: boolean; // Flag to indicate if the question requires an image (from Gemini parser)
  // Matching question fields
  matching_pairs?: { left: string; right: string }[]; // Pairs for matching questions
}

export interface QuizData {
  title: string;
  questions: Question[];
  time_limit_minutes?: number;
  max_score?: number;
  /** Audio playback mode: 'strict' = no seeking/limited replays, 'flexible' = full control */
  audio_playback_mode?: 'strict' | 'flexible';
  /** Max times audio can be replayed in strict mode */
  audio_max_plays?: number;
}

// =============================================================================
// FLASHCARD TYPES
// =============================================================================

export interface FlashcardItem {
  id: string;
  front_text: string;
  back_text: string;
  front_image_url?: string;
  back_image_url?: string;
  difficulty: 'easy' | 'normal' | 'hard';
  tags?: string[];
  order_index: number;
}

export interface FlashcardSet {
  title: string;
  description?: string;
  cards: FlashcardItem[];
  study_mode: 'sequential' | 'random' | 'spaced_repetition';
  auto_flip: boolean;
  show_progress: boolean;
}

export interface FavoriteFlashcard {
  id: number;
  user_id: number;
  step_id: number;
  flashcard_id: string;
  lesson_id?: number;
  course_id?: number;
  flashcard_data: string; // JSON string with FlashcardItem data
  created_at: string;
}

export interface FavoriteFlashcardCreate {
  step_id: number;
  flashcard_id: string;
  lesson_id?: number;
  course_id?: number;
  flashcard_data: string; // JSON string with FlashcardItem data
}

export interface LessonMaterial {
  id: string;
  lesson_id: string;
  title: string;
  file_path: string;
  file_type: string;
  file_size: number;
  file_url: string;
  file_size_bytes?: number;
  uploaded_at: string;
}

// =============================================================================
// ASSIGNMENT ZERO TYPES - Self-Assessment Questionnaire
// =============================================================================

export interface AssignmentZeroStatus {
  needs_completion: boolean;
  completed: boolean;
  completed_at?: string;
  message?: string;
}

export interface AssignmentZeroSubmission {
  id: number;
  user_id: number;
  full_name: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  email: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  has_passed_sat_before: boolean;
  previous_sat_score?: string;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string;
  screenshot_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AssignmentZeroSubmitData {
  full_name: string;
  phone_number: string;
  parent_phone_number: string;
  telegram_id: string;
  email: string;
  college_board_email: string;
  college_board_password: string;
  birthday_date: string;
  city: string;
  school_type: string;
  group_name: string;
  sat_target_date: string;
  has_passed_sat_before: boolean;
  previous_sat_score?: string;
  recent_practice_test_score: string;
  bluebook_practice_test_5_score: string;
  screenshot_url?: string;
}

export type SchoolType = 'NIS' | 'RFMS' | 'BIL' | 'Private' | 'Public';
export type SATTargetDate = 'October' | 'November' | 'December' | 'March' | 'May';

// =============================================================================
// ASSIGNMENT TYPES
// =============================================================================

export interface Assignment {
  id: string;
  lesson_id?: string;
  group_id?: number;
  title: string;
  description: string;
  assignment_type: AssignmentType;
  content: any; // JSON content with questions and options
  max_score: number;
  time_limit_minutes?: number;
  due_date?: string; // Deadline for assignment
  file_url?: string; // File attachment for assignment
  allowed_file_types?: string[]; // Allowed file types for submissions
  max_file_size_mb?: number; // Max file size in MB
  is_active: boolean;
  created_at: string;
  updated_at: string;
  late_penalty_enabled?: boolean;
  late_penalty_multiplier?: number;
}

export type AssignmentType =
  | 'single_choice'
  | 'multiple_choice'
  | 'picture_choice'
  | 'fill_in_blanks'
  | 'matching'
  | 'matching_text'
  | 'free_text'
  | 'file_upload'
  | 'quiz'
  | 'essay'
  | 'coding'
  | 'multi_task'
  | 'mixed';

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'fill_blank'
  | 'matching'
  | 'free_text'
  | 'picture_choice'
  | 'file_upload';

// QuestionOption is already defined in QUIZ TYPES section above

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  answers: any; // JSON with student answers
  file_url?: string; // File attachment for submission
  submitted_file_name?: string; // Original filename
  score?: number;
  max_score: number;
  is_graded: boolean;
  submitted_at: string;
  graded_at?: string;
  status: SubmissionStatus;
  feedback?: string;
  user_name?: string;
  grader_name?: string;
  is_late?: boolean;
}

export type SubmissionStatus = 'draft' | 'submitted' | 'graded' | 'needs_revision' | 'overdue';

export interface SubmissionAnswer {
  question_id: string;
  answer: string | string[] | File;
  points_earned?: number;
}

export interface SubmitAssignmentRequest {
  answers: any;
  file_url?: string;
  submitted_file_name?: string;
}

// =============================================================================
// ASSIGNMENT STATUS TYPES
// =============================================================================

export interface AssignmentStatus {
  status: string;
  attemptsLeft: number;
  late?: boolean;
  score?: number;
  feedback?: string;
  extended_deadline?: string; // If student has an extension
}

// =============================================================================
// ASSIGNMENT EXTENSION TYPES
// =============================================================================

export interface AssignmentExtension {
  id: number;
  assignment_id: number;
  student_id: number;
  student_name?: string;
  extended_deadline: string;
  reason?: string;
  granted_by: number;
  granter_name?: string;
  created_at: string;
}

export interface GrantExtensionRequest {
  student_id: number;
  extended_deadline: string;
  reason?: string;
}

// =============================================================================
// QUIZ TYPES  
// =============================================================================

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  timeLimitSec?: number;
}

export interface QuizQuestion {
  id: string;
  body: string;
  type: 'single' | 'short' | 'multiple';
  options?: string[];
  correct?: number[];
  correctText?: string;
}

// =============================================================================
// PROGRESS TYPES
// =============================================================================

export interface StudentProgress {
  id: string;
  student_id: string;
  course_id: string;
  lessons_completed: number;
  total_lessons: number;
  assignments_completed: number;
  total_assignments: number;
  total_score: number;
  max_possible_score: number;
  time_spent_minutes: number;
  last_activity: string;
  progress_percentage: number;
}

export interface LessonCompletion {
  lesson_id: string;
  student_id: string;
  completed_at: string;
  time_spent_minutes: number;
}

export interface ManualLessonUnlock {
  id: number;
  lesson_id: number;
  user_id?: number | null;
  group_id?: number | null;
  granted_by: number;
  granted_at: string;
  lesson_title?: string;
  user_name?: string;
  group_name?: string;
  granter_name?: string;
}

export interface ManualLessonUnlockCreate {
  lesson_id: number;
  user_id?: number | null;
  group_id?: number | null;
  unlock_all_teacher_groups?: boolean;
}

export interface ManualLessonUnlockListResponse {
  unlocks: ManualLessonUnlock[];
  total: number;
}

// =============================================================================
// DASHBOARD TYPES
// =============================================================================

export interface DashboardStats {
  courses_count: number;
  total_study_time: number;
  overall_progress: number;
  assignments_pending: number;
  messages_unread: number;
}

export interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  course_id?: string;
  created_at: string;
}

export type ActivityType = 'lesson_completed' | 'assignment_submitted' | 'course_enrolled' | 'message_received';

// =============================================================================
// MESSAGE TYPES
// =============================================================================

export interface MessageThread {
  partner_id: number;
  partner_name: string;
  partner_role: string;
  partner_avatar?: string;
  last_message: {
    content: string;
    created_at: string | null;
    from_me: boolean;
  };
  unread_count: number;
}

export interface Message {
  id: number;
  from_user_id: number;
  to_user_id: number;
  sender_name?: string;
  recipient_name?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface SendMessageRequest {
  to_user_id: number;
  content: string;
}

export interface AvailableContact {
  user_id: number;
  name: string;
  role: string;
  avatar_url?: string;
  student_id?: string;
}

export interface Conversation {
  partner_id: number;
  partner_name: string;
  partner_role: string;
  partner_avatar?: string;
  last_message: {
    content: string;
    created_at: string | null;
    from_me: boolean;
  };
  unread_count: number;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}

// =============================================================================
// GROUP TYPES
// =============================================================================

export interface Group {
  id: number;
  name: string;
  description?: string;
  teacher_id: number;
  teacher_name?: string;
  curator_id?: number;
  curator_name?: string;
  student_count: number;
  students?: User[];
  created_at: string;
  is_active: boolean;
  is_special?: boolean;
}

export interface Enrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
  status: EnrollmentStatus;
}

export type EnrollmentStatus = 'active' | 'completed' | 'dropped' | 'suspended';

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// FORM TYPES
// =============================================================================

export interface CourseCreateData {
  title: string;
  description: string;
  teacher_id?: string;
  is_linear?: boolean;
}

export interface ModuleCreateData {
  title: string;
  description: string;
  course_id: string;
}

export interface LessonCreateData {
  title: string;
  description: string;
  module_id: string;
  content_type: LessonContentType;
  content_url?: string;
  content_text?: string;
  duration_minutes?: number;
}

export interface UserCreateData {
  email: string;
  full_name: string;
  password: string;
  role: UserRole;
  group_id?: string;
}

// =============================================================================
// COMPONENT PROP TYPES
// =============================================================================

export interface ComponentWithChildren {
  children: React.ReactNode;
}

export interface ComponentWithClassName {
  className?: string;
}

export interface LoadingState {
  loading: boolean;
  error?: string | null;
}

// =============================================================================
// ROUTE TYPES
// =============================================================================

export interface RouteParams {
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  assignmentId?: string;
  userId?: string;
}

export interface NavigationItem {
  path: string;
  label: string;
  icon?: React.ComponentType;
  roles?: UserRole[];
  children?: NavigationItem[];
}

// =============================================================================
// EVENT TYPES - Schedule and Events Management
// =============================================================================

export interface Event {
  id: number;
  title: string;
  description?: string;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  is_online: boolean;
  meeting_url?: string;
  created_by: number;
  creator_name?: string;
  is_active: boolean;
  is_recurring: boolean;
  recurrence_pattern?: string;
  recurrence_end_date?: string;
  max_participants?: number;
  participant_count: number;
  is_substitution?: boolean;
  groups?: string[];
  courses?: string[];
  group_ids?: number[];
  course_ids?: number[];
  lesson_id?: number;
  teacher_id?: number;
  teacher_name?: string;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility or convenience
export type Submission = AssignmentSubmission;

export type EventType = 'class' | 'weekly_test' | 'webinar' | 'assignment';

export interface CreateEventRequest {
  title: string;
  description?: string;
  event_type: EventType;
  start_datetime: string;
  end_datetime: string;
  location?: string;
  is_online?: boolean;
  meeting_url?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  recurrence_end_date?: string;
  max_participants?: number;
  group_ids?: number[];
  course_ids?: number[];
  lesson_id?: number;
  teacher_id?: number;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string;
  event_type?: EventType;
  start_datetime?: string;
  end_datetime?: string;
  location?: string;
  is_online?: boolean;
  meeting_url?: string;
  is_active?: boolean;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  recurrence_end_date?: string;
  max_participants?: number;
  group_ids?: number[];
  course_ids?: number[];
  lesson_id?: number;
  teacher_id?: number;
}


export interface EventGroup {
  id: number;
  event_id: number;
  group_id: number;
  group_name?: string;
  created_at: string;
}

export interface EventParticipant {
  id: number;
  event_id: number;
  user_id: number;
  user_name?: string;
  registration_status: 'registered' | 'attended' | 'missed';
  registered_at: string;
  attended_at?: string;
}

export interface CalendarDay {
  date: Date;
  events: Event[];
  isCurrentMonth: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  events: Event[];
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  class: 'Class',
  weekly_test: 'Weekly Test',
  webinar: 'Webinar',
  assignment: 'Assignment Deadline'
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  class: 'bg-blue-100 text-blue-900 border-blue-200',
  weekly_test: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  webinar: 'bg-red-100 text-red-900 border-red-200',
  assignment: 'bg-orange-100 text-orange-900 border-orange-200'
};
// =============================================================================
// ATTENDANCE TYPES
// =============================================================================

export interface EventStudent {
  student_id: number;
  name: string;
  attendance_status: string; // "attended", "missed", "late", "registered"
  last_updated?: string;
}

export interface AttendanceRecord {
  student_id: number;
  status: string;
}

export interface AttendanceBulkUpdate {
  attendance: AttendanceRecord[];
}

// =============================================================================
// DAILY QUESTIONS TYPES
// =============================================================================

export interface DailyQuestionItem {
  questionId: number;
  text: string;
  imageUrl?: string;
  primaryTag: string;
  secondaryTags?: string | string[];
  difficulty: string;
  isMultipleChoice?: boolean;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  passageText?: string;
  questionType?: string; // 'Multiple Choice' | 'Student Response'
  correctAnswer?: string; // The correct answer (e.g. 'A', 'B', 'C', 'D' or text)
}

export interface DailyRecommendationSection {
  questions: DailyQuestionItem[];
  reasoning: string;
}

export interface DailyQuestionsRecommendations {
  email: string;
  studentName: string;
  mathTestId?: number;
  verbalTestId?: number;
  mathRecommendations?: DailyRecommendationSection;
  verbalRecommendations?: DailyRecommendationSection;
}

export interface DailyQuestionsStatus {
  completed_today: boolean;
  completed_at?: string;
  message?: string;
  score?: number | null;
  total_questions?: number | null;
}

// =============================================================================
// LESSON REQUEST TYPES (Substitution / Reschedule)
// =============================================================================

export interface LessonRequest {
  id: number;
  request_type: 'substitution' | 'reschedule';
  status: 'pending' | 'approved' | 'rejected' | 'pending_teacher';
  requester_id: number;
  requester_name?: string;
  lesson_schedule_id?: number;
  event_id?: number;
  group_id: number;
  group_name?: string;
  original_datetime: string;
  substitute_teacher_id?: number;
  substitute_teacher_name?: string;
  substitute_teacher_ids?: number[]; // List of candidate IDs
  substitute_teacher_names?: string[]; // List of candidate names
  confirmed_teacher_id?: number | null;
  confirmed_teacher_name?: string | null;
  new_datetime?: string; // ISO string;
  reason?: string;
  admin_comment?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: number;
}

export interface CreateLessonRequest {
  request_type: 'substitution' | 'reschedule';
  lesson_schedule_id?: number;
  event_id?: number;
  group_id: number;
  original_datetime: string;
  substitute_teacher_ids?: number[];
  substitute_teacher_id?: number;
  new_datetime?: string;
  reason?: string;
}

export interface AvailableTeacher {
  id: number;
  name: string;
  email: string;
}

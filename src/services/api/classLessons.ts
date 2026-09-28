import { api } from './client';
import type { StudentRegister, RegisterMode } from './meetRegister';

/**
 * One class lesson on one page — `/lessons/:id` (owner, 2026-09-28). The backend shapes the answer
 * for the viewer: staff get the register, the team note and the live room; a student gets their own
 * mark and homework status and never a classmate's. Contract: docs of lms-backend `GET /lessons/{id}`.
 */

export type LessonStatus = 'upcoming' | 'live' | 'finished' | 'cancelled';
export type LessonLocale = 'ru' | 'en';
export type NoteKind = 'plan' | 'summary' | 'staff';
export type UiMark = 'attended' | 'late' | 'missed' | 'registered' | 'cancelled' | 'removed';

export interface LessonRef { id: number; start: string }

export interface LessonGroup {
  id: number;
  name: string;
  lesson_number: number | null;
  prev: LessonRef | null;
  next: LessonRef | null;
}

export interface LessonPerson { id: number; name: string }

export interface LessonViewer {
  role: string;
  locale: LessonLocale;
  is_staff: boolean;
  is_student: boolean;
  can_mark: boolean;
  can_score: boolean;
  can_edit_notes: boolean;
  can_manage_materials: boolean;
  can_request: boolean;
  can_view_meet: boolean;
}

export interface LessonNote { text: string; by: string | null; at: string | null }

export interface LessonNotes {
  plan: LessonNote | null;
  summary: LessonNote | null;
  /** Only ever present for staff. */
  staff?: LessonNote | null;
}

export interface RegisterMeet {
  verdict: string | null;
  minutes: number | null;
  required: number | null;
  late_minutes: number | null;
  held_back?: boolean;
  register: StudentRegister | null;
}

export interface RegisterStudent {
  user_id: number;
  name: string;
  group_id: number | null;
  status: UiMark;
  marked: boolean;
  excused: boolean;
  excuse_note: string | null;
  activity_score: number | null;
  /** Painted by the journal and never editable: frozen on the lesson's day, or platform access off. */
  state: 'frozen' | 'no_access' | null;
  meet: RegisterMeet | null;
}

export interface LessonRegister {
  mode: RegisterMode;
  meet_decided: boolean;
  students: RegisterStudent[];
}

export interface LessonMe {
  status: UiMark;
  marked: boolean;
  excused: boolean;
  activity_score: number | null;
  missed: boolean;
}

export interface LessonHomework {
  id: number;
  title: string;
  due: string | null;
  group_id: number | null;
  submitted: number | null;
  total: number | null;
  my: { status: 'not_submitted' | 'submitted' | 'graded'; score: number | null; max_score: number | null } | null;
}

export interface LessonRequestRow {
  id: number;
  type: 'substitution' | 'reschedule' | 'cancel' | string;
  status: string;
  created_at: string | null;
  requester: string | null;
}

export interface LessonLiveRoom {
  updated_at: string | null;
  teacher_in: boolean;
  in_room: number;
  expected: number;
  missing: { user_id: number; name: string }[];
  unknown: number;
}

export interface LessonView {
  id: number;
  title: string;
  topic: string | null;
  start: string;
  end: string;
  status: LessonStatus;
  join: { url: string | null; opens_at: string | null };
  groups: LessonGroup[];
  teacher: LessonPerson | null;
  regular_teacher: LessonPerson | null;
  is_substitution: boolean;
  cancelled: { replacement: LessonRef | null; reason: string | null } | null;
  viewer: LessonViewer;
  notes: LessonNotes;
  register: LessonRegister | null;
  me: LessonMe | null;
  homework: LessonHomework[];
  homework_new_url: string | null;
  requests: LessonRequestRow[];
  request_new_url: string | null;
  live: LessonLiveRoom | null;
  /** Staff only: Meet's record state for the lesson (`no_room` = held outside an LMS Meet room). */
  meet_state: string | null;
  /** After the lesson: the recording's state, or null when it has none. */
  recording: { status: 'ready' | 'pending' | 'failed' | 'removed' } | null;
}

/** A failed load, with the HTTP status the page turns into «нет доступа» / «урок не найден». */
export class LessonLoadError extends Error {
  status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.status = status;
  }
}

function detailOf(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

// Per-viewer and live (the register moves every minute while Meet takes it): never cached.
const NO_CACHE = { cache: false } as never;

export async function getLesson(id: number | string): Promise<LessonView> {
  try {
    const response = await api.get(`/lessons/${id}`, NO_CACHE);
    return response.data as LessonView;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status ?? null;
    throw new LessonLoadError(detailOf(error, 'Failed to load the lesson'), status);
  }
}

/** Saves one note; empty text clears it (the answer is then null). */
export async function saveLessonNote(id: number, kind: NoteKind, text: string): Promise<LessonNote | null> {
  try {
    const response = await api.put(`/lessons/${id}/notes/${kind}`, { text });
    return (response.data ?? null) as LessonNote | null;
  } catch (error: unknown) {
    throw new Error(detailOf(error, 'Failed to save the note'));
  }
}

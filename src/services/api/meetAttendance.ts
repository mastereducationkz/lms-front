import { api } from './client';
import type { MeetLessonTalk } from './meetTalk';

/**
 * Who was in a lesson's Meet room, from when to when — read from what Meet reported.
 *
 * Evidence, never a mark: marks stay the teacher's (they feed billing). The record adds flags
 * where the two disagree, and lateness. Times are UTC ISO strings with a Z.
 *
 * Never cached: confirming one Google account changes every lesson it appears in, and a
 * cached copy of any of them would keep asking "who is this?" about someone already named.
 */

export type MeetFlagCode =
  | 'late'
  | 'left_early'
  | 'marked_present_not_joined'
  | 'marked_absent_was_in_room'
  | 'teacher_late'
  | 'ended_early'
  | 'teacher_not_joined';

/** A person looked at the flag and answered it; it stops asking for attention (owner, 2026-09-11). */
export interface MeetFlagReview {
  /** A preset key, `other` (free text), or null where a reason is optional and none was given. */
  reason_code?: string | null;
  reason_label: string | null;
  text: string | null;
  /** Who reviewed and when: inside the LMS only, the watch-link page gets neither. */
  by?: string | null;
  at?: string | null;
}

export interface MeetFlag {
  code: MeetFlagCode;
  minutes?: number | null;
  review?: MeetFlagReview | null;
}

/** What the review form offers for one flag: its reasons (the last is always «Другое»). */
export interface MeetReviewOption {
  required: boolean;
  reasons: { key: string; label: string }[];
}

export type MeetReviewOptions = Partial<Record<MeetFlagCode, MeetReviewOption>>;

export interface MeetSpan {
  joined_at: string;
  left_at: string | null;
}

export type MeetAccountKind = 'signed_in' | 'guest' | 'phone';

export interface MeetAccount {
  participant_id: number;
  kind: MeetAccountKind;
  display_name: string | null;
}

export interface MeetPresence {
  /** Overlapping stretches already merged; a reconnect with a gap stays two. */
  sessions: MeetSpan[];
  /** How many times they joined (before merging). */
  joins: number;
  first_join: string | null;
  last_leave: string | null;
  minutes_in_lesson: number;
}

export type MeetMark = 'present' | 'late' | 'absent' | 'removed' | null;

export interface MeetPerson extends MeetPresence {
  user_id: number;
  name: string;
  role: string;
  mark: MeetMark;
  accounts: MeetAccount[];
  flags: MeetFlag[];
}

export interface MeetUnknownAccount extends MeetAccount, MeetPresence {
  suggestion: { user_id: number; name: string } | null;
}

export type MeetNotTrackedAccount = MeetAccount & MeetPresence;

export interface MeetCandidate {
  user_id: number;
  name: string;
  role: 'teacher' | 'student';
}

export interface MeetLessonFlag extends MeetFlag {
  user_id: number;
  name: string;
  role: string;
}

/**
 * `no_room`: not held in an LMS Meet room (a teacher's own link) — nothing to read, show nothing.
 * `unavailable`: older than Google keeps records, from before the LMS saved them.
 */
export type MeetRecordState = 'not_started' | 'waiting' | 'none' | 'ready' | 'no_room' | 'unavailable';

export interface MeetRecord {
  event_id: number;
  title: string;
  start: string;
  end: string;
  state: MeetRecordState;
  /** Some call Google has not handed over yet; what is shown may grow. */
  partial?: boolean;
  calls?: { started_at: string | null; ended_at: string | null }[];
  teacher?: MeetPerson | null;
  students?: MeetPerson[];
  /** People the LMS knows who are neither this lesson's teacher nor its students. */
  others?: MeetPerson[];
  unknown?: MeetUnknownAccount[];
  not_tracked?: MeetNotTrackedAccount[];
  /** An unconfirmed account was in the room, so "never joined" flags are held back. */
  held_back?: boolean;
  flags?: MeetLessonFlag[];
  /** Marks that disagree with the room and nobody has answered yet. */
  mismatches?: number;
  /** Flags someone reviewed, with or without a reason. */
  reviewed?: number;
  review_options?: MeetReviewOptions;
  candidates?: MeetCandidate[];
  /** The whole class with marks — present in every state, also without a Meet record. */
  roster?: { user_id: number; name: string; mark: MeetMark }[];
}

const NO_CACHE = { cache: false } as never;

/** The lesson's record, or null when this viewer may not see it (404, by design). */
export async function getMeetRecord(eventId: number): Promise<MeetRecord | null> {
  try {
    const response = await api.get(`/meet-attendance/lessons/${eventId}`, NO_CACHE);
    return response.data as MeetRecord;
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 404 || status === 403) return null;
    throw new Error('Failed to load the Meet attendance');
  }
}

export interface MeetIdentity {
  user_id?: number | null;
  not_a_student?: boolean;
}

/**
 * Say who an account is. A signed-in Google account is remembered for every lesson; a guest
 * is matched for this lesson only. `{}` makes it unknown again. Returns the updated record.
 */
export async function confirmMeetAccount(participantId: number, identity: MeetIdentity): Promise<MeetRecord> {
  try {
    const response = await api.put(`/meet-attendance/participants/${participantId}`, {
      user_id: identity.user_id ?? null,
      not_a_student: identity.not_a_student ?? false,
    });
    return response.data as MeetRecord;
  } catch (error: unknown) {
    const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Could not save who this is');
  }
}

export interface MeetLessonSummary {
  event_id: number;
  title: string;
  start: string;
  end: string;
  state: MeetRecordState;
  groups: { id: number; name: string }[];
  teacher: { id: number; name: string; first_join: string | null; last_leave: string | null } | null;
  students: number;
  joined: number;
  unknown: number;
  held_back: boolean;
  mismatches: number;
  reviewed?: number;
  flags: MeetLessonFlag[];
  /** Who spoke how much; null (or absent) when the lesson has no Meet transcript. */
  talk?: MeetLessonTalk | null;
}

export interface MeetRecordsQuery {
  date_from?: string | null;
  date_to?: string | null;
  teacher_id?: number | null;
  group_id?: number | null;
}

/** Lessons with a Meet record in the range (default: the last 30 days), newest first. */
export async function listMeetRecords(query: MeetRecordsQuery = {}): Promise<{
  items: MeetLessonSummary[];
  from: string;
  to: string;
  review_options?: MeetReviewOptions;
  /** The talk-time admin switch. */
  talk_enabled?: boolean;
}> {
  const params: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value as string | number;
  });
  const response = await api.get('/meet-attendance/lessons', { params, cache: false } as never);
  return response.data;
}

export interface MeetReviewInput {
  user_id: number;
  code: MeetFlagCode;
  reason_code?: string | null;
  reason_text?: string | null;
  /** Correct the mark instead of explaining it (marks that disagree with the room only). */
  fix_mark?: boolean;
}

function reviewError(error: unknown, fallback: string): Error {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (response?.status === 404) return new Error('This lesson changed since it was opened. Reload it and try again.');
  const detail = response?.data?.detail;
  return new Error(typeof detail === 'string' ? detail : fallback);
}

/** Answer one flag — a reason, or a corrected mark. Returns the lesson's record as it now reads. */
export async function reviewMeetFlag(eventId: number, input: MeetReviewInput): Promise<MeetRecord> {
  try {
    const response = await api.put(`/meet-attendance/lessons/${eventId}/reviews`, {
      user_id: input.user_id,
      code: input.code,
      reason_code: input.reason_code ?? null,
      reason_text: input.reason_text ?? null,
      fix_mark: input.fix_mark ?? false,
    });
    return response.data as MeetRecord;
  } catch (error: unknown) {
    throw reviewError(error, 'Could not save the review');
  }
}

/** Put a reviewed flag back into «Needs attention». Returns the updated record. */
export async function restoreMeetFlag(eventId: number, userId: number, code: MeetFlagCode): Promise<MeetRecord> {
  try {
    const response = await api.delete(`/meet-attendance/lessons/${eventId}/reviews`, { params: { user_id: userId, code } });
    return response.data as MeetRecord;
  } catch (error: unknown) {
    throw reviewError(error, 'Could not put it back');
  }
}

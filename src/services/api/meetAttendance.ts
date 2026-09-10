import { api } from './client';

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

export interface MeetFlag {
  code: MeetFlagCode;
  minutes?: number | null;
}

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
  mismatches?: number;
  candidates?: MeetCandidate[];
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
  flags: MeetLessonFlag[];
}

export interface MeetRecordsQuery {
  date_from?: string | null;
  date_to?: string | null;
  teacher_id?: number | null;
  group_id?: number | null;
}

/** Lessons with a Meet record in the range (default: the last 30 days), newest first. */
export async function listMeetRecords(query: MeetRecordsQuery = {}): Promise<{ items: MeetLessonSummary[]; from: string; to: string }> {
  const params: Record<string, string | number> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = value as string | number;
  });
  const response = await api.get('/meet-attendance/lessons', { params, cache: false } as never);
  return response.data;
}

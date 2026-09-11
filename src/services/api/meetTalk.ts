import { api } from './client';

/**
 * Who spoke in a lesson, for how long — and what was said.
 *
 * Meet's own transcript says who spoke when, to the second, per Google account (its Russian
 * text is unusable and never kept). Deepgram supplies the readable text; each line is named by
 * overlapping Meet's timing. Read by the same people as the Meet attendance record: admins and
 * heads (every lesson), teachers (their lessons), curators (their groups) — students never.
 *
 * Times are UTC ISO strings with a Z; durations are seconds. Never cached: confirming a Google
 * account renames its speech in every lesson at once.
 */

/**
 * `off`: the admin switch is off. `waiting`: the lesson has just ended or Meet's transcript is
 * not in yet. `none`: no Meet transcript for this lesson (transcription was off then).
 * `no_room` / `unavailable`: as in the attendance record.
 */
export type TalkState = 'off' | 'not_started' | 'waiting' | 'none' | 'no_room' | 'unavailable' | 'ready';

export type TalkRole = 'teacher' | 'student' | 'unknown' | 'other';

export interface TalkPerson {
  /** "u<user_id>" for LMS people, "p<participant_id>" for accounts nobody has named. */
  key: string;
  /** Null for an unconfirmed account, or one marked "not a student". */
  user_id: number | null;
  name: string;
  /** unknown = an unconfirmed account; other = not a student, or someone from another group. */
  role: TalkRole;
  /** Speech inside the lesson window (the lesson ±30 min, like presence). */
  seconds: number;
  /** 0..1 of teacher + students + unknown speech; 0 for 'other'. */
  share: number;
  /** Stretches of speech (the same person, gaps under 1.5 s merged). */
  turns: number;
  longest_turn_seconds: number;
  in_room: boolean;
  /** Questions this person asked; null without a transcript. */
  questions: number | null;
  /** Teacher questions this person answered first (within 20 s); null without a transcript. */
  answers?: number | null;
  /** Speech stretches as [from, to] seconds from the lesson start. */
  spans: [number, number][];
}

export interface TalkBucket {
  from_minute: number;
  teacher_seconds: number;
  students_seconds: number;
}

export interface TalkInsights {
  /** Teacher turns ending with «?». */
  teacher_questions: number;
  /** …followed by a student within 20 s. */
  answered: number;
  median_wait_seconds: number | null;
  student_questions: number;
}

export type TranscriptState = 'off' | 'pending' | 'ready' | 'failed' | 'not_available';

export interface TranscriptLine {
  /** Seconds in the recording: seek the video here. */
  at: number;
  /** Seconds from the lesson start: shown as mm:ss. */
  lesson_at: number;
  /** Recording seconds. */
  end: number;
  /** A people[].key, or null when nobody could be matched. */
  speaker_key: string | null;
  /** The person's name, or «Голос 2». */
  speaker_label: string;
  role: TalkRole | null;
  text: string;
}

export interface TalkTranscript {
  /**
   * off: the Deepgram part is switched off; pending: waiting for the recording, or queued;
   * not_available: no recording, or the lesson is from before talk time was switched on.
   */
  state: TranscriptState;
  /** Admins only. */
  error?: string | null;
  /** Video time = lesson_at + recording_offset_seconds. */
  recording_offset_seconds: number | null;
  /** Consecutive lines of one speaker already merged into turns. */
  lines: TranscriptLine[];
}

export interface TalkRecord {
  event_id: number;
  title: string;
  start: string;
  end: string;
  state: TalkState;
  /** The admin switch. */
  enabled: boolean;
  /**
   * `meet`: Meet's own speaker timing names everyone. `voices`: the lesson was taught before talk
   * time was on, so the transcript's voices stand in — named only where who was in the room
   * leaves one choice, the rest «Голос N».
   */
  source?: TalkSource;
  // Everything below only when state === 'ready'.
  /** The scheduled length. */
  lesson_seconds?: number;
  /** All speech, merged, inside the scheduled lesson. */
  speech_seconds?: number;
  /** Gaps of 5 s or more with nobody speaking, inside the scheduled lesson. */
  silence_seconds?: number;
  /** Of teacher + students + unknown speech. */
  teacher_share?: number | null;
  /** Students and unknown accounts. */
  students_share?: number | null;
  /** The teacher, then students by seconds (silent ones too), unknown, other. */
  people?: TalkPerson[];
  /** In the room, never spoke. */
  silent_students?: { user_id: number; name: string }[];
  /** Every 10 minutes from the start. */
  buckets?: TalkBucket[];
  /** Teacher speech with no student speech in between. */
  longest_teacher_stretch_seconds?: number;
  speaker_changes_per_10_min?: number;
  /** An unconfirmed account spoke: names and shares may change once it is confirmed. */
  held_back?: boolean;
  /** Null until the transcript exists. */
  insights?: TalkInsights | null;
  transcript?: TalkTranscript;
  /**
   * Where the lesson's start falls in the recording: video second = lesson second + offset. Known
   * without a transcript too (from the recorded call's start); null when it cannot be placed.
   */
  recording_offset_seconds?: number | null;
}

/** What the lesson list carries per lesson; null when it has no Meet transcript. */
export interface MeetLessonTalk {
  teacher_share: number | null;
  students_share: number | null;
  speech_seconds: number;
  teacher_seconds: number;
  /** User ids in the room who never spoke. */
  silent: number[];
  /** Seconds spoken, by user id. */
  seconds: Record<string, number>;
}

/** The watch-link page's talk time (`participants.talk`): no ids, no transcript, no insights. */
export type TalkSource = 'meet' | 'voices';

export interface PublicTalk {
  state: TalkState;
  source?: TalkSource;
  /** The scheduled length, when the server sends it. */
  lesson_seconds?: number;
  /** Video second = lesson second + offset; null when it cannot be placed. */
  recording_offset_seconds?: number | null;
  speech_seconds: number;
  silence_seconds: number;
  teacher_share: number | null;
  students_share: number | null;
  people: { name: string; role: TalkRole; seconds: number; share: number; in_room: boolean; spans: [number, number][] }[];
  /** Names. */
  silent_students: string[];
  buckets: TalkBucket[];
}

const NO_CACHE = { cache: false } as never;

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function detailOf(error: unknown, fallback: string): Error {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return new Error(typeof detail === 'string' ? detail : fallback);
}

/** A lesson's talk time, or null when this viewer may not see it (404, by design). */
export async function getLessonTalk(eventId: number): Promise<TalkRecord | null> {
  try {
    const response = await api.get(`/meet-attendance/lessons/${eventId}/talk`, NO_CACHE);
    return response.data as TalkRecord;
  } catch (error: unknown) {
    const status = statusOf(error);
    if (status === 404 || status === 403) return null;
    throw new Error('Failed to load the talk time');
  }
}

/** Questions added up over the lessons that have a transcript; null when none of them do. */
export interface TalkQuestions {
  /** Teacher lines ending in «?». */
  teacher_questions: number;
  /** …that a student answered within 20 s. */
  answered: number;
  student_questions: number;
  lessons_with_transcript: number;
}

/** One lesson in the group, teacher and student views. */
export interface GroupTalkLesson {
  event_id: number;
  title: string;
  start: string;
  groups?: { id: number; name: string }[];
  teacher_name: string | null;
  teacher_share: number | null;
  students_share: number | null;
  speech_seconds: number;
  /** The longest the teacher spoke with no student in between. */
  longest_stretch_seconds?: number;
  students_in_room: number;
  silent: number;
  /** Null without a transcript. */
  teacher_questions?: number | null;
  answered?: number | null;
  student_questions?: number | null;
  median_wait_seconds?: number | null;
  /** 'voices': taught before talk time was on; names come from the recording's voices. */
  source?: TalkSource;
}

/**
 * How a student took part in one lesson. spoke: said something. silent: in the room 10+ min
 * without a word. present: in the room briefly, no words. absent: not in the room.
 */
export type StudentLessonState = 'spoke' | 'silent' | 'present' | 'absent';

export interface StudentLessonMark {
  event_id: number;
  start: string;
  state: StudentLessonState;
  seconds: number;
}

export interface GroupTalkStudent {
  user_id: number;
  name: string;
  lessons_in_room: number;
  lessons_spoke: number;
  silent_lessons: number;
  total_seconds: number;
  /** Per lesson in the room. */
  avg_seconds: number;
  share_of_student_talk: number;
  /** Questions they asked; null without transcripts. */
  questions: number | null;
  /** Teacher questions they answered first; null without transcripts. */
  answers?: number | null;
  /** One mark per lesson, oldest first. */
  lessons?: StudentLessonMark[];
}

export interface GroupTalk {
  group: { id: number; name: string };
  from: string;
  to: string;
  /** Newest first. */
  lessons: GroupTalkLesson[];
  /** Most spoken first. */
  students: GroupTalkStudent[];
  teacher: { avg_share: number | null; lessons: number };
  totals: { lessons: number; speech_seconds: number; teacher_seconds: number; student_seconds: number; unconfirmed_seconds?: number };
  questions?: TalkQuestions | null;
}

/** A teacher's (or one of their groups') lessons added up. */
export interface TalkTally {
  lessons: number;
  groups: number;
  /** Averages over the lessons. */
  teacher_share: number | null;
  students_share: number | null;
  /** Totals. */
  teacher_seconds: number;
  student_seconds: number;
  speech_seconds: number;
  /** The average of each lesson's longest teacher stretch. */
  longest_stretch_seconds: number;
  silent_per_lesson: number;
  students_in_room_per_lesson: number;
  questions: TalkQuestions | null;
}

export interface TeacherTalkRow extends TalkTally {
  teacher_id: number;
  name: string;
}

export interface TeachersTalk {
  from: string;
  to: string;
  teachers: TeacherTalkRow[];
}

export interface TeacherTalk {
  from: string;
  to: string;
  teacher: TeacherTalkRow;
  groups: (TalkTally & { group_id: number | null; name: string | null })[];
  /** Newest first. */
  lessons: GroupTalkLesson[];
}

/** Talk time is switched off (409): the views say so instead of "couldn't load". */
export class TalkSwitchedOff extends Error {
  constructor() {
    super('Talk time is switched off');
    this.name = 'TalkSwitchedOff';
  }
}

type Range = { date_from?: string | null; date_to?: string | null };

/** A talk report: null when not the viewer's to see (404/403), TalkSwitchedOff on 409. */
async function report<T>(url: string, range: Range, failure: string): Promise<T | null> {
  const params: Record<string, string> = {};
  if (range.date_from) params.date_from = range.date_from;
  if (range.date_to) params.date_to = range.date_to;
  try {
    const response = await api.get(url, { params, cache: false } as never);
    return response.data as T;
  } catch (error: unknown) {
    const status = statusOf(error);
    if (status === 404 || status === 403) return null;
    if (status === 409) throw new TalkSwitchedOff();
    throw new Error(failure);
  }
}

/** Every teacher over a period (admins and heads; null for anyone else). */
export function getTeachersTalk(range: Range = {}): Promise<TeachersTalk | null> {
  return report<TeachersTalk>('/meet-attendance/talk/teachers', range, 'Failed to load the teachers’ talk time');
}

/** One teacher over a period: all their groups together, each group, each lesson. */
export function getTeacherTalk(teacherId: number, range: Range = {}): Promise<TeacherTalk | null> {
  return report<TeacherTalk>(`/meet-attendance/talk/teachers/${teacherId}`, range, 'Failed to load the teacher’s talk time');
}

/** One group's talk time over a period (default: the last 30 days); null when not the viewer's group. */
export function getGroupTalk(groupId: number, range: Range = {}): Promise<GroupTalk | null> {
  return report<GroupTalk>(`/meet-attendance/talk/groups/${groupId}`, range, 'Failed to load the group’s talk time');
}

export interface TalkSettings {
  enabled: boolean;
  /** The Deepgram part: readable text and the insights built on it. */
  transcripts: boolean;
  enabled_at: string | null;
  updated_by: string | null;
  deepgram_configured: boolean;
  usage: { month: string; lessons: number; audio_hours: number; estimated_usd: number };
  last_error: string | null;
}

/** The switch as it stands (admins and heads). */
export async function getTalkSettings(): Promise<TalkSettings> {
  try {
    const response = await api.get('/meet-attendance/talk/settings', NO_CACHE);
    return response.data as TalkSettings;
  } catch (error: unknown) {
    throw detailOf(error, 'Could not load the talk time settings');
  }
}

/** Turn talk time, or only its transcripts, on or off (admins only). Returns the new settings. */
export async function updateTalkSettings(patch: { enabled?: boolean; transcripts?: boolean }): Promise<TalkSettings> {
  try {
    const response = await api.put('/meet-attendance/talk/settings', patch);
    return response.data as TalkSettings;
  } catch (error: unknown) {
    throw detailOf(error, 'Could not change the talk time settings');
  }
}

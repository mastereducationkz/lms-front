/**
 * The live lesson's shapes (owner, 2026-09-29; lms-backend `src/live_lesson/views.py`). The
 * backend shapes every answer for its viewer: staff get counts, names and keys as they come in; a
 * student gets their own answer and, after «Show», the totals. An anonymous activity names nobody.
 */

export type LiveMode = 'off' | 'admins' | 'everyone';
export type ActivityKind = 'poll' | 'cloud' | 'popcheck' | 'mistake';
export type QuestionShape = 'choice' | 'multi' | 'text' | 'gap';

export interface LiveOption { text: string; image_url: string | null }

/** A quiz question as a phone may see it before «Show»: no key, no explanation. */
export interface PublicQuestion {
  kind: QuestionShape;
  text: string;
  passage: string | null;
  options: LiveOption[] | null;
  select_count: number | null;
  media_url: string | null;
}

/** What «Show» reveals: an option index, indices, or the accepted typed answers. */
export interface QuestionKey {
  correct: number | number[] | string[];
  explanation: string | null;
}

export interface QuestionRef { step_id: number; question_id: string }

export interface QuestionSource { assignment_id: number; title: string; event_id: number; due: string | null }

export interface PopcheckItem {
  question: PublicQuestion;
  source?: QuestionSource;
  key?: QuestionKey;
  right?: number;
  answered?: number;
}

export interface NamedAnswer {
  user_id: number;
  name: string | null;
  value?: unknown;
  correct?: boolean | null;
  items?: Record<string, { value: unknown; correct: boolean | null }>;
}

export interface CloudEntry {
  id: number;
  text: string;
  /** `filter` = the word list, `ai` = Jev, `teacher` = hidden by hand. */
  hidden: 'filter' | 'ai' | 'teacher' | null;
  user_id?: number;
  name?: string | null;
}

export interface CloudGroup { text: string; count: number }

export interface ActivityView {
  id: number;
  kind: ActivityKind;
  anonymous: boolean;
  prompt: string;
  status: 'open' | 'closed';
  revealed: boolean;
  started_at: string;
  closes_at: string | null;
  answered: number;
  offered: number;
  results: {
    counts?: number[];
    groups?: CloudGroup[];
    correct?: number | number[];
    explanation?: string | null;
  } | null;
  answers: NamedAnswer[] | null;
  mine: unknown;
  // poll
  options?: string[];
  preset?: string | null;
  // cloud
  entries?: CloudEntry[];
  // popcheck
  items?: PopcheckItem[];
  // mistake
  question?: PublicQuestion;
  mode?: 'choice' | 'multi';
  stats?: { answered: number; wrong: number; share_wrong: number };
  source?: QuestionSource;
  fallback?: boolean;
  source_start?: string | null;
}

export interface LiveTimer { total: number | null; ends_at: string | null; paused_left: number | null; activity_id: number | null }

export interface LivePick { id: number; user_id: number; name: string | null; at: string; outcome: string | null; me: boolean }

export interface LiveState {
  lesson: { id: number; title: string; start: string; end: string; status: string };
  mode: LiveMode;
  version: number;
  server_now: string;
  link: string;
  is_staff: boolean;
  is_student: boolean;
  can_drive: boolean;
  timer: LiveTimer | null;
  pick: LivePick | null;
  activity: ActivityView | null;
  presence?: { here: number; roster: number; in_meet: number; on_page: number };
}

export interface CurrentLive {
  lesson: { id: number; title: string; start: string; end: string } | null;
  activity: { id: number; kind: ActivityKind } | null;
}

export interface LiveSummary {
  activities: number;
  open: { id: number; kind: ActivityKind } | null;
  can_drive: boolean;
}

export interface PopcheckPreviewItem { ref: QuestionRef; source: QuestionSource; question: PublicQuestion; key: QuestionKey }

export interface PopcheckPreview {
  items: PopcheckPreviewItem[];
  fallback: boolean;
  source_start: string | null;
  reason: string | null;
}

export interface MistakePreview {
  poll: {
    mode: 'choice' | 'multi';
    shown: PublicQuestion;
    correct: number | number[];
    explanation: string | null;
    ref: QuestionRef;
    source: QuestionSource;
    stats: { answered: number; wrong: number; share_wrong: number };
  } | null;
  fallback: boolean;
  source_start: string | null;
  reason: string | null;
}

export interface ScoreSuggestion {
  user_id: number;
  name: string;
  current: number | null;
  suggested: number | null;
  reason: string | null;
}

export interface Suggestions { ran: number; min_activities: number; students: ScoreSuggestion[] }

export interface LiveRecord {
  activities: ActivityView[];
  is_staff: boolean;
  picks?: LivePick[];
  scores?: Suggestions;
}

export interface LiveSettings { mode: LiveMode; modes: LiveMode[]; updated_by: string | null; updated_at: string | null }

export interface StartActivity {
  kind: ActivityKind;
  prompt?: string;
  options?: string[];
  preset?: string | null;
  anonymous?: boolean;
  refs?: QuestionRef[];
  ref?: QuestionRef;
  timer_seconds?: number;
}

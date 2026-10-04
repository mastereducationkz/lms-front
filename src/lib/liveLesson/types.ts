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

/** A named student as a live screen draws them: their orca (mascot code) or photo (owner, 2026-10-04). */
export interface Person {
  user_id: number;
  name: string | null;
  mascot?: string | null;
  avatar_url?: string | null;
}

export interface NamedAnswer extends Person {
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
  mascot?: string | null;
  avatar_url?: string | null;
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
  /** Staff, named activities only: who has answered (never what), first answer first. */
  answered_by?: Person[] | null;
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

export interface LivePick extends Person { id: number; at: string; outcome: string | null; me: boolean }

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
  /** Staff only: the students here now, for the presenter's «who's here» strip. */
  room?: Person[];
  // The fun layer (owner, 2026-10-04).
  reactions?: ReactionsStatus;
  crowned?: Person | null;
  recap?: LiveRecap | null;
  /** Students: their raised hand's place in the queue. */
  my_hand?: { position: number; raised_at: string } | null;
  /** Staff only. */
  hands?: (Person & { raised_at: string })[];
  lost?: { count: number };
  energy?: LessonEnergy;
  reactions_paused?: boolean;
  group_ids?: number[];
}

export type ReactionKind = 'love' | 'laugh' | 'fire' | 'clap' | 'mindblown' | 'splash';
export interface ReactionsStatus { on: boolean; paused: 'teacher' | 'focus' | 'timer' | null }

/** Per-lesson totals only — nothing per student. */
export interface LessonEnergy {
  counts: Partial<Record<ReactionKind, number>>;
  total: number;
  top: ReactionKind | null;
  lost: { count: number; peak: number | null; peak_at: string | null } | null;
}

export interface LiveRecap {
  activities: number;
  answers: number;
  energy: LessonEnergy;
  top: Person[];
  crowned: Person | null;
}

/** A reaction as it arrives over the socket; an anonymous one carries no identity. */
export interface ReactionEvent extends Partial<Person> {
  event_id: number;
  kind: ReactionKind;
  at: string;
  anonymous?: boolean;
}

export interface FunResult { accepted: boolean; retry_in: number; paused?: ReactionsStatus['paused'] }

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
  mascot?: string | null;
  avatar_url?: string | null;
  current: number | null;
  suggested: number | null;
  reason: string | null;
}

export interface Suggestions { ran: number; min_activities: number; students: ScoreSuggestion[] }

export interface LiveRecord {
  activities: ActivityView[];
  is_staff: boolean;
  energy?: LessonEnergy;
  crowned?: Person | null;
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

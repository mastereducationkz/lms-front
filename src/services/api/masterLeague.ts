/**
 * Master League, the student's own season (owner, 2026-10-13): GET /master-league/me feeds the
 * season banner and the welcome scene. Shapes follow docs/master-league/ACHIEVEMENTS.md §4.
 * Anything that isn't a live season (not launched, not in a league, season over, an error, an
 * older backend without the route) is `null`: no banner, never a crash.
 */
import { api } from './client';

export type LeaguePhase = 'warmup' | 'season' | 'final_week' | 'eve' | 'exam_day' | 'after' | 'over';
export type LessonState = 'attended' | 'missed' | 'unmarked' | 'today' | 'upcoming';

export interface LeagueLesson {
  id: number;
  number: number;
  /** Naive UTC + «Z», like the rest of the achievements payload. */
  starts_at: string;
  state: LessonState;
}

export interface LeagueGoal {
  key: string;
  unlocked: boolean;
  progress: { current: number; target: number } | null;
}

export interface MyLeague {
  group: { id: number; name: string };
  /** YYYY-MM-DD (Almaty), or null while the exam date is unknown. */
  exam_date: string | null;
  days_to_exam: number | null;
  phase: LeaguePhase;
  /** YYYY-MM-DD: the day College Board releases the scores; null from a backend that does not send it yet. */
  score_release: string | null;
  /** YYYY-MM-DD: the last day for the official score report, 14 days after the score release. */
  result_due: string | null;
  lessons: { total: number; played: number; items: LeagueLesson[] };
  next_lesson: { id: number; number: number; starts_at: string; title: string } | null;
  attendance: { attended: number; marked: number; percent: number };
  homework: { on_time: number; due: number };
  squad_size: number;
  achievements: LeagueGoal[];
}

const PHASES: readonly LeaguePhase[] = ['warmup', 'season', 'final_week', 'eve', 'exam_day', 'after', 'over'];
const STATES: readonly LessonState[] = ['attended', 'missed', 'unmarked', 'today', 'upcoming'];

const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** The one place a raw answer becomes a MyLeague; null for anything that is not a live season. */
export function asMyLeague(data: unknown): MyLeague | null {
  const d = (data ?? {}) as Record<string, any>;
  if (d.launched !== true || d.in_league !== true) return null;
  if (!PHASES.includes(d.phase) || d.phase === 'over') return null;
  const group = d.group && typeof d.group.name === 'string' ? { id: num(d.group.id), name: d.group.name } : null;
  if (!group) return null;
  const items: LeagueLesson[] = Array.isArray(d.lessons?.items)
    ? d.lessons.items
        .filter((i: any) => i && typeof i.starts_at === 'string' && STATES.includes(i.state))
        .map((i: any) => ({ id: num(i.id), number: num(i.number), starts_at: i.starts_at, state: i.state }))
    : [];
  const next = d.next_lesson && typeof d.next_lesson.starts_at === 'string'
    ? { id: num(d.next_lesson.id), number: num(d.next_lesson.number), starts_at: d.next_lesson.starts_at, title: String(d.next_lesson.title ?? '') }
    : null;
  return {
    group,
    exam_date: typeof d.exam_date === 'string' ? d.exam_date : null,
    days_to_exam: d.days_to_exam == null ? null : num(d.days_to_exam),
    phase: d.phase,
    score_release: typeof d.score_release === 'string' ? d.score_release : null,
    result_due: typeof d.result_due === 'string' ? d.result_due : null,
    lessons: { total: num(d.lessons?.total, items.length), played: num(d.lessons?.played), items },
    next_lesson: next,
    attendance: { attended: num(d.attendance?.attended), marked: num(d.attendance?.marked), percent: num(d.attendance?.percent) },
    homework: { on_time: num(d.homework?.on_time), due: num(d.homework?.due) },
    squad_size: num(d.squad_size),
    achievements: Array.isArray(d.achievements)
      ? d.achievements
          .filter((a: any) => a && typeof a.key === 'string')
          .map((a: any) => ({
            key: a.key,
            unlocked: a.unlocked === true,
            progress: a.progress && num(a.progress.target) > 0 ? { current: num(a.progress.current), target: num(a.progress.target) } : null,
          }))
      : [],
  };
}

export async function getMyLeague(): Promise<MyLeague | null> {
  try {
    const response = await api.get('/master-league/me', { cache: false } as never);
    return asMyLeague(response?.data);
  } catch {
    return null;
  }
}

/**
 * Results-day consent (lms-backend `src/master_league/result_consent.py`): once staff verified the
 * student's official result, may the group chat congratulate them? Nothing is ever posted without
 * the student's own «yes». `null` for anything that is not a question or an answer to show (no
 * verified result, an error, an older backend): the card then renders nothing.
 */
export type ConsentState = 'ask' | 'yes' | 'no' | 'posted';
export type ConsentDecision = 'yes' | 'no';

export interface ResultConsent {
  state: ConsentState;
  result_total: number;
  decision: ConsentDecision | null;
  /** The season is still open for answering (and the line is not posted yet). */
  can_answer: boolean;
}

const CONSENT_STATES: readonly ConsentState[] = ['ask', 'yes', 'no', 'posted'];

export function asResultConsent(data: unknown): ResultConsent | null {
  const d = (data ?? {}) as Record<string, any>;
  if (!CONSENT_STATES.includes(d.state)) return null;
  const total = num(d.result_total, NaN);
  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    state: d.state,
    result_total: total,
    decision: d.decision === 'yes' || d.decision === 'no' ? d.decision : null,
    can_answer: d.can_answer === true,
  };
}

export async function getResultConsent(): Promise<ResultConsent | null> {
  try {
    const response = await api.get('/master-league/me/result-consent', { cache: false } as never);
    return asResultConsent(response?.data);
  } catch {
    return null;
  }
}

/** The student's own answer; rejects when it could not be saved, so the card can say so. */
export async function answerResultConsent(decision: ConsentDecision): Promise<ResultConsent | null> {
  const response = await api.post('/master-league/me/result-consent', { decision });
  return asResultConsent(response?.data);
}

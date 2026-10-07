import { activeLocale, t, type Locale } from '../i18n';
import type { ActivityView, LiveTimer, QuestionKey } from './types';
import '@/lib/i18n/catalogs/chatLive';

/** The fixed link students open; the QR and «Copy for chat» carry it. */
export const LIVE_LINK = 'https://lms.mastereducation.kz/live';

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** One-tap polls that need no typing (owner, 2026-09-29): the question is asked aloud or on a slide. */
export const POLL_PRESETS: { key: string; label: string; options: string[] }[] = [
  { key: 'abcd', label: 'A / B / C / D', options: ['A', 'B', 'C', 'D'] },
  { key: 'yes_no', label: 'Yes / No', options: ['Yes', 'No'] },
  { key: 'true_false', label: 'True / False', options: ['True', 'False'] },
];

export const TIMER_PRESETS = [30, 60, 120, 180, 300];

/** The text teachers paste into the Meet chat. */
export function chatText(link: string = LIVE_LINK): string {
  return `Answer the questions here: ${link}`;
}

/** Server minus local clock, from the state's `server_now`, so every screen counts down alike. */
export function clockOffset(serverNow: string, localNow: number = Date.now()): number {
  const server = Date.parse(serverNow);
  return Number.isFinite(server) ? server - localNow : 0;
}

/** Seconds left on the timer at `now` (server time, ms); null when no timer runs or waits. */
export function timerLeft(timer: LiveTimer | null, now: number): number | null {
  if (!timer) return null;
  if (timer.paused_left != null) return Math.max(0, timer.paused_left);
  if (!timer.ends_at) return null;
  return Math.max(0, (Date.parse(timer.ends_at) - now) / 1000);
}

/** «1:05», «0:09». Rounds up so the display never reaches 0 before the time is up. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function percents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
}

/** The indices «Show» marks correct, for a choice-shaped key. */
export function correctIndices(correct: QuestionKey['correct'] | number | number[] | undefined): number[] {
  if (typeof correct === 'number') return [correct];
  if (Array.isArray(correct) && correct.every((c) => typeof c === 'number')) return correct as number[];
  return [];
}

/** How a finished activity reads in one line, for the record and the panel's header. */
export function activityLabel(kind: ActivityView['kind'], locale: Locale = activeLocale()): string {
  return t(`chatLive.live.kind.${kind}`, undefined, locale);
}

/** Word-cloud font size: the most common entry is largest, a single entry is readable. */
export function cloudSize(count: number, max: number): number {
  if (max <= 1) return 1.25;
  return 1 + (count - 1) / (max - 1) * 1.75;
}

/** A pop-check answer as the server stores it, keyed by item number (JSON keys are strings). */
export function mineAt<T>(mine: unknown, item: number): T | undefined {
  if (!mine || typeof mine !== 'object') return undefined;
  const record = mine as Record<string, T>;
  return record[String(item)];
}

/** Is the choice-question answer ready to send? A multi question wants exactly `need` picks. */
export function multiReady(selected: number[], need: number | null): boolean {
  return need ? selected.length === need : selected.length > 0;
}

/** «B · Dog», or just «B» when the option is its own letter (the A/B/C/D preset). */
export function optionLabel(index: number, text: string | undefined): string {
  const letter = LETTERS[index] ?? String(index + 1);
  return text && text.trim() !== letter ? `${letter} · ${text}` : letter;
}

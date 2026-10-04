/**
 * The reactions' screen logic (owner, 2026-10-04): identical reactions within a second merge into
 * one «🔥×7» bubble, at most MAX_BUBBLES float at once and the rest tick a counter, and the
 * «I'm lost» signal fades after a minute. Pure, so it is tested without a screen.
 */
import type { Person, ReactionEvent, ReactionKind } from './types';

export const MAX_BUBBLES = 15;
export const MERGE_MS = 1000;
export const BUBBLE_MS = 3200;

export interface Bubble {
  id: number;
  kind: ReactionKind;
  /** The latest sender (null = a plain orca: anonymous). */
  person: Person | null;
  count: number;
  born: number;
  /** 5–95: where across the screen it rises. */
  x: number;
}

export interface BubbleState { bubbles: Bubble[]; overflow: number; nextId: number }

export const emptyBubbles = (): BubbleState => ({ bubbles: [], overflow: 0, nextId: 1 });

function personOf(e: ReactionEvent): Person | null {
  if (e.anonymous || e.user_id == null) return null;
  return { user_id: e.user_id, name: e.name ?? null, mascot: e.mascot ?? null, avatar_url: e.avatar_url ?? null };
}

/** Drop bubbles that have finished rising. */
export function prune(state: BubbleState, now: number): BubbleState {
  const bubbles = state.bubbles.filter((b) => now - b.born < BUBBLE_MS);
  return bubbles.length === state.bubbles.length ? state : { ...state, bubbles };
}

/** One reaction arrives: merge into a fresh bubble of the same kind, else float a new one, else count it. */
export function addReaction(state: BubbleState, e: ReactionEvent, now: number, rand: () => number = Math.random): BubbleState {
  const live = prune(state, now);
  const same = live.bubbles.find((b) => b.kind === e.kind && now - b.born < MERGE_MS);
  if (same) {
    return { ...live, bubbles: live.bubbles.map((b) => (b === same ? { ...b, count: b.count + 1, person: personOf(e) ?? b.person } : b)) };
  }
  if (live.bubbles.length >= MAX_BUBBLES) return { ...live, overflow: live.overflow + 1 };
  const bubble: Bubble = { id: live.nextId, kind: e.kind, person: personOf(e), count: 1, born: now, x: 5 + Math.round(rand() * 90) };
  return { ...live, bubbles: [...live.bubbles, bubble], nextId: live.nextId + 1 };
}

/** «5 lost» shows while it's fresh: the server sends how many and until when. */
export function lostShowing(lost: { count: number; until: number } | null, now: number): number {
  return lost && lost.count > 0 && now < lost.until ? lost.count : 0;
}

/** Share of the cooldown left, for the ring on the button (1 = just tapped, 0 = ready). */
export function cooldownLeft(readyAt: number, total: number, now: number): number {
  if (total <= 0 || now >= readyAt) return 0;
  return Math.min(1, (readyAt - now) / total);
}

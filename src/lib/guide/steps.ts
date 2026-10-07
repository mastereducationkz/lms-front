/**
 * Moving through a tour. A step shows when it has no target (a centred card) or its target is on
 * the page right now with a size; anything else is skipped silently — a missing element can never
 * strand the tour on a stale pointer again. `resolves` answers «is this selector on screen?».
 */

export interface StepLike {
  id: string;
  /** CSS selector of the element the card points at; none = a centred card. */
  target?: string;
  /**
   * The element is page content that loads after the page (a dashboard card): wait for it, up to
   * TARGET_WAIT_MS. Without it the element belongs to the layout (sidebar, menu), which is there from
   * the first paint, so «not on screen» means «not for this person or this width»: skip at once.
   */
  waits?: boolean;
}

export type Resolves = (selector: string) => boolean;

export const stepShows = (step: StepLike, resolves: Resolves): boolean => !step.target || resolves(step.target);

export function shownSteps<T extends StepLike>(steps: readonly T[], resolves: Resolves): T[] {
  return steps.filter((s) => stepShows(s, resolves));
}

/** The next (dir 1) or previous (dir -1) step that can show after `fromId`; null past either end. */
export function neighbourStep<T extends StepLike>(steps: readonly T[], fromId: string | null, dir: 1 | -1, resolves: Resolves): T | null {
  const from = fromId === null ? (dir === 1 ? -1 : steps.length) : steps.findIndex((s) => s.id === fromId);
  if (from === -1 && fromId !== null) return null;
  for (let i = from + dir; i >= 0 && i < steps.length; i += dir) {
    if (stepShows(steps[i], resolves)) return steps[i];
  }
  return null;
}

/**
 * Where the tour should be when `currentId` can't show (resized to a phone, the target left): the
 * step itself if it still can, else the next one that can, else the previous, else null (end).
 */
export function settleStep<T extends StepLike>(steps: readonly T[], currentId: string, resolves: Resolves): T | null {
  const current = steps.find((s) => s.id === currentId);
  if (!current) return neighbourStep(steps, null, 1, resolves);
  if (stepShows(current, resolves)) return current;
  return neighbourStep(steps, currentId, 1, resolves) ?? neighbourStep(steps, currentId, -1, resolves);
}

/** «3 of 7», counted over the steps that can show now. */
export function stepPosition(steps: readonly StepLike[], currentId: string, resolves: Resolves): { index: number; total: number } {
  const shown = shownSteps(steps, resolves);
  return { index: Math.max(0, shown.findIndex((s) => s.id === currentId)), total: shown.length };
}

/** A stop waits this long in silence first, so an element that renders quickly never flashes a loader. */
export const QUIET_WAIT_MS = 250;
/** A waiting stop gives up after this long: on slow phones and links a card often takes 2–4 s. */
export const TARGET_WAIT_MS = 5000;
/** A layout stop (no `waits`) allows only a render's worth of delay, e.g. right after a reload. */
export const LAYOUT_WAIT_MS = 1000;

export type TargetPhase = 'show' | 'quiet' | 'loading' | 'skip';

/** What a stop does `elapsedMs` after it was asked for, given whether its element is on screen yet. */
export function targetPhase(elapsedMs: number, found: boolean, waits = false): TargetPhase {
  if (found) return 'show';
  if (elapsedMs < QUIET_WAIT_MS) return 'quiet';
  if (!waits) return elapsedMs < LAYOUT_WAIT_MS ? 'quiet' : 'skip';
  return elapsedMs < TARGET_WAIT_MS ? 'loading' : 'skip';
}

/**
 * Where Next and Back may go: a stop that shows now, or a waiting stop (its content may still be on
 * its way — the stop itself waits for it).
 */
export const reachable = (steps: readonly StepLike[], resolves: Resolves): Resolves => {
  const waiting = new Set(steps.filter((s) => s.waits && s.target).map((s) => s.target as string));
  return (selector) => waiting.has(selector) || resolves(selector);
};


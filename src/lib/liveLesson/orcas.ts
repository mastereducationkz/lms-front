/**
 * Pure helpers behind the live lesson's orcas (owner, 2026-10-04): who to draw, how many before
 * «+N», who voted for what on a named reveal, and the picker's shuffle before it lands.
 */
import type { NamedAnswer, Person } from './types';

/** The first `max` people and how many more there are (for a «+N» pill). */
export function capList<T>(list: T[], max: number): { shown: T[]; more: number } {
  if (max <= 0) return { shown: [], more: list.length };
  return list.length > max ? { shown: list.slice(0, max - 1), more: list.length - (max - 1) } : { shown: list, more: 0 };
}

/** Named poll answers grouped by option: voters[i] = everyone who picked option i. */
export function votersByOption(answers: NamedAnswer[] | null | undefined, options: number): Person[][] {
  const out: Person[][] = Array.from({ length: options }, () => []);
  for (const a of answers ?? []) {
    const v = a.value;
    if (typeof v === 'number' && v >= 0 && v < options) out[v].push(a);
  }
  return out;
}

/** Named answers that were right (mistake of the day): only the good news goes on the big screen. */
export function rightAnswerers(answers: NamedAnswer[] | null | undefined): Person[] {
  return (answers ?? []).filter((a) => a.correct === true);
}

/** Who got pop-check question `item` right. */
export function popcheckRight(answers: NamedAnswer[] | null | undefined, item: number): Person[] {
  return (answers ?? []).filter((a) => a.items?.[String(item)]?.correct === true);
}

/**
 * The faces the picker flashes before it lands: `steps` ids drawn from `candidates`, never the
 * same twice in a row, always ending on `picked`. One candidate (or none) skips straight to it.
 */
export function shuffleSequence(candidates: number[], picked: number, steps: number, rand: () => number = Math.random): number[] {
  const pool = Array.from(new Set(candidates.filter((id) => id !== picked)));
  if (!pool.length || steps <= 1) return [picked];
  const seq: number[] = [];
  let last: number | null = null;
  for (let i = 0; i < steps - 1; i += 1) {
    const choices = pool.length > 1 ? pool.filter((id) => id !== last) : pool;
    const next = choices[Math.floor(rand() * choices.length) % choices.length];
    seq.push(next);
    last = next;
  }
  if (seq[seq.length - 1] === picked) seq.pop();
  seq.push(picked);
  return seq;
}

/** Delay before showing step `i` of `n`: quick at first, slowing down as it lands. */
export function shuffleDelay(i: number, n: number): number {
  const t = n <= 1 ? 1 : i / (n - 1);
  return Math.round(70 + 330 * t * t);
}

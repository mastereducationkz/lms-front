/**
 * What the Halloween pieces share while the page is open: the hunt progress (the greeting's
 * pumpkin row updates the moment one is picked up elsewhere) and whether the finale is showing.
 * Progress itself is stored by hunt.ts; this only broadcasts changes.
 */
import { useSyncExternalStore } from 'react';
import { markFound, readFound, type FindResult } from './hunt';

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
/** closed · flight (the lap of honour, then the card) · card (straight to the card). */
export type Finale = 'closed' | 'flight' | 'card';
let finale: Finale = 'closed';

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The pages whose pumpkin this person has found, re-read whenever one is picked up. */
export function useFound(userId: number | string | undefined): string[] {
  useSyncExternalStore(subscribe, () => version);
  return userId == null ? [] : readFound(storage(), userId);
}

export function pickUp(userId: number | string, path: string): FindResult {
  const result = markFound(storage(), userId, path);
  if (result.isNew) emit();
  if (result.complete) openFinale('flight');
  return result;
}

export function useFinale(): Finale {
  return useSyncExternalStore(subscribe, () => finale);
}

export function openFinale(mode: Exclude<Finale, 'closed'>) {
  finale = mode;
  emit();
}

export function closeFinale() {
  finale = 'closed';
  emit();
}

/** Whether this visitor asked for less motion. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

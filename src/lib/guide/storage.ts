/**
 * This device's side of the guide state. Every access is guarded: blocked storage (private mode,
 * the Telegram in-app browser) only means the server alone decides.
 *
 * - localStorage `guide:marks:<user>`: what this device marked and the server may not have yet.
 * - sessionStorage `guide:tour:<user>`: where a running tour is, so a reload resumes it.
 */
import { NO_LOCAL_MARKS, type LocalMarks, type TourKind } from './state';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const storageOf = (kind: 'localStorage' | 'sessionStorage'): StorageLike | null => {
  try {
    return typeof window !== 'undefined' ? window[kind] : null;
  } catch {
    return null;
  }
};

const marksKey = (userId: string | number) => `guide:marks:${userId}`;
const progressKey = (userId: string | number) => `guide:tour:${userId}`;

export function readLocalMarks(userId: string | number, store: StorageLike | null = storageOf('localStorage')): LocalMarks {
  try {
    const raw = store?.getItem(marksKey(userId));
    if (!raw) return NO_LOCAL_MARKS;
    const parsed = JSON.parse(raw) as Partial<LocalMarks>;
    return {
      tourVersion: Number.isInteger(parsed.tourVersion) ? Number(parsed.tourVersion) : 0,
      tips: Array.isArray(parsed.tips) ? parsed.tips.filter((k): k is string => typeof k === 'string') : [],
    };
  } catch {
    return NO_LOCAL_MARKS;
  }
}

export function writeLocalMarks(userId: string | number, marks: LocalMarks, store: StorageLike | null = storageOf('localStorage')): void {
  try {
    if (marks.tourVersion === 0 && marks.tips.length === 0) store?.removeItem(marksKey(userId));
    else store?.setItem(marksKey(userId), JSON.stringify(marks));
  } catch {
    /* storage blocked: the server alone remembers */
  }
}

export interface TourProgress {
  kind: TourKind;
  stepId: string;
  origin: 'auto' | 'replay';
}

export function readTourProgress(userId: string | number, store: StorageLike | null = storageOf('sessionStorage')): TourProgress | null {
  try {
    const raw = store?.getItem(progressKey(userId));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<TourProgress>;
    if (!p.kind || !p.stepId || (p.origin !== 'auto' && p.origin !== 'replay')) return null;
    return { kind: p.kind, stepId: p.stepId, origin: p.origin };
  } catch {
    return null;
  }
}

export function writeTourProgress(userId: string | number, progress: TourProgress | null, store: StorageLike | null = storageOf('sessionStorage')): void {
  try {
    if (progress) store?.setItem(progressKey(userId), JSON.stringify(progress));
    else store?.removeItem(progressKey(userId));
  } catch {
    /* storage blocked: a reload restarts the tour from its first stop */
  }
}

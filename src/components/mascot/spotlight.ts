/**
 * «Meet your Kasatik» spotlight (owner, 2026-10-04): nudges a student who still has the automatic
 * orca to customise it. One dismissed state shared by the desktop coachmark and the mobile card,
 * kept in localStorage — every access guarded, so the app works without storage.
 */

export interface SpotlightInput {
  role?: string | null;
  mascot?: string | null;
  dismissed: boolean;
  /** The onboarding tour is showing, or still pending for this user. */
  tourActive: boolean;
  /** The student is held on the Assignment Zero gate. */
  assignmentZeroGate: boolean;
  pathname: string;
}

/** Students only, while they still have the automatic orca, outside the tour and the gate. */
export function shouldShowSpotlight(s: SpotlightInput): boolean {
  if (s.role !== 'student') return false;
  if (s.mascot) return false;
  if (s.dismissed || s.tourActive || s.assignmentZeroGate) return false;
  if (s.pathname.startsWith('/assignment-zero') || s.pathname.startsWith('/profile')) return false;
  return true;
}

const key = (userId: string | number) => `kasatik-spotlight-dismissed:${userId}`;
/** Dismissals of this page session — they still hold when storage is unavailable. */
const sessionDismissed = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

export function isSpotlightDismissed(userId: string | number): boolean {
  if (sessionDismissed.has(String(userId))) return true;
  try {
    return window.localStorage.getItem(key(userId)) === '1';
  } catch {
    return false;
  }
}

export function dismissSpotlight(userId: string | number): void {
  sessionDismissed.add(String(userId));
  try {
    window.localStorage.setItem(key(userId), '1');
  } catch {
    /* storage blocked: the session set still hides it */
  }
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribeSpotlight(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const spotlightVersion = () => version;

/** Whether the onboarding tour is still owed to this user (mirrors OnboardingManager). */
export function onboardingPending(userId: string | number, onboardingCompleted?: boolean): boolean {
  if (onboardingCompleted) return false;
  try {
    return window.localStorage.getItem(`onboarding_completed_${userId}`) !== 'true';
  } catch {
    return true;
  }
}

/**
 * Who sees the tour and the one-time tips, and when (owner, 2026-10-07). Pure: the components read
 * the user and storage, these rules decide.
 *
 * What a person has already seen lives on the server (`users.ui_state`, sent with /auth/me — rules in
 * lms-backend src/auth/ui_state.py), so a tip hidden on the laptop stays hidden on the phone. This
 * device also keeps what it marked until the server has it, so a failed request never brings a tour
 * or a tip back.
 */

/** Raise it when the tours are rewritten: everyone sees the new one once, finished-the-old-one included. */
export const TOUR_VERSION = 1;

export type TourKind = 'student' | 'teacher' | 'curator';

export interface UiState {
  tour_version_seen: number;
  /** tip key → when it was first dismissed (ISO). */
  tips: Record<string, string>;
}

/** What this device marked and the server may not have confirmed yet. */
export interface LocalMarks {
  tourVersion: number;
  tips: string[];
}

export const NO_LOCAL_MARKS: LocalMarks = { tourVersion: 0, tips: [] };

export interface GuideUser {
  id: string | number;
  role?: string | null;
  onboarding_completed?: boolean;
  assignment_zero_completed?: boolean;
  special_group_only_student?: boolean;
  ui_state?: unknown;
}

/** The roles whose tour starts by itself, once, on their first dashboard visit after a release. */
const AUTO_TOUR: Record<string, TourKind> = { student: 'student', teacher: 'teacher', curator: 'curator' };
/**
 * «Replay tour» adds the head curator: same sidebar as a curator, same Russian UI, so every stop of
 * the curator tour is there for them. Head teachers, admins and parents get none — their screens are
 * about overseeing others, and a tour of a teacher's tools would describe work they don't do.
 */
const REPLAY_TOUR: Record<string, TourKind> = { ...AUTO_TOUR, head_curator: 'curator' };

export const autoTourFor = (role?: string | null): TourKind | null => (role ? AUTO_TOUR[role] ?? null : null);
export const replayTourFor = (role?: string | null): TourKind | null => (role ? REPLAY_TOUR[role] ?? null : null);

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

/** The server's state, cleaned; null while it isn't known (not loaded yet, or an older backend). */
export function readUiState(raw: unknown): UiState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as { tour_version_seen?: unknown; tips?: unknown };
  const tips: Record<string, string> = {};
  if (r.tips && typeof r.tips === 'object' && !Array.isArray(r.tips)) {
    for (const [key, when] of Object.entries(r.tips as Record<string, unknown>)) {
      if (typeof when === 'string') tips[key] = when;
    }
  }
  return { tour_version_seen: isCount(r.tour_version_seen) ? r.tour_version_seen : 0, tips };
}

export function tourSeen(server: UiState | null, local: LocalMarks, version = TOUR_VERSION): boolean {
  return Math.max(server?.tour_version_seen ?? 0, local.tourVersion) >= version;
}

export function tipDismissed(key: string, server: UiState | null, local: LocalMarks): boolean {
  return Boolean(server?.tips[key]) || local.tips.includes(key);
}

/** A student held on the Assignment Zero page sees nothing else until it's done. */
export function assignmentZeroGate(user: GuideUser): boolean {
  return user.role === 'student' && !user.special_group_only_student && user.assignment_zero_completed === false;
}

/** The tour opens by itself: its role, on the dashboard, known not yet seen, past Assignment Zero. */
export function shouldAutoStartTour(user: GuideUser | null, pathname: string, local: LocalMarks): boolean {
  if (!user || !autoTourFor(user.role) || pathname !== '/dashboard') return false;
  const server = readUiState(user.ui_state);
  if (!server) return false; // unknown: never guess, a stale «not seen» would replay it
  return !tourSeen(server, local) && !assignmentZeroGate(user);
}

/** The full-screen «Hello, …» comes once, before a new person's very first tour. */
export function shouldShowWelcome(user: GuideUser, resuming: boolean): boolean {
  return !resuming && user.onboarding_completed === false;
}

/**
 * Whether the tour is still owed (the one-popup queue keeps the visit for it). Before the server's
 * state is known, the old flag answers, as it did before the tour had versions.
 */
export function tourOwed(user: GuideUser, local: LocalMarks): boolean {
  const server = readUiState(user.ui_state);
  if (!server) return !user.onboarding_completed && local.tourVersion === 0;
  return autoTourFor(user.role) !== null && !tourSeen(server, local);
}

/** What this device marked that the server hasn't confirmed: resent on the next load. */
export function marksToSync(server: UiState | null, local: LocalMarks): { tourVersion: number | null; tips: string[] } {
  if (!server) return { tourVersion: null, tips: [] };
  return {
    tourVersion: local.tourVersion > server.tour_version_seen ? local.tourVersion : null,
    tips: local.tips.filter((key) => !server.tips[key]),
  };
}

/** The client's mirror of the server rules, for the optimistic update. */
export function withTourSeen(state: UiState | null, version = TOUR_VERSION): UiState {
  const base = state ?? { tour_version_seen: 0, tips: {} };
  return { ...base, tour_version_seen: Math.max(base.tour_version_seen, version) };
}

export function withTipDismissed(state: UiState | null, key: string, at: Date = new Date()): UiState {
  const base = state ?? { tour_version_seen: 0, tips: {} };
  if (base.tips[key]) return base;
  return { ...base, tips: { ...base.tips, [key]: at.toISOString().replace(/\.\d{3}Z$/, 'Z') } };
}

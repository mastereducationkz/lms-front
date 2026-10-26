/**
 * The pumpkin hunt (owner, 2026-10-26): five small pumpkins hidden on the pages each role really
 * opens, one per page, peeking from the right edge at a different height on each. Progress lives
 * on this device only (no backend for a five-day game); each person on a shared device has their own.
 */

export const HUNT_SIZE = 5;

export interface HuntSpot {
  path: string;
  /** How far down the screen the pumpkin peeks out, as a share of the viewport height. */
  top: number;
}

const spots = (...entries: [string, number][]): HuntSpot[] => entries.map(([path, top]) => ({ path, top }));

const STAFF_COMMON = (third: string, fourth: string) =>
  spots(['/dashboard', 0.62], ['/calendar', 0.34], [third, 0.71], [fourth, 0.45], ['/chat', 0.56]);

const SPOTS: Record<string, HuntSpot[]> = {
  // Not /courses: a student's «My Courses» in the sidebar only expands a list (2026-10-27).
  student: spots(['/dashboard', 0.62], ['/favorites', 0.38], ['/achievements', 0.7], ['/chat', 0.47], ['/profile', 0.31]),
  parent: spots(['/dashboard', 0.62], ['/calendar', 0.34], ['/chat', 0.56], ['/profile', 0.42], ['/settings', 0.68]),
  teacher: STAFF_COMMON('/homework', '/teacher/class'),
  curator: STAFF_COMMON('/curator/students', '/curator/leaderboard'),
  head_curator: STAFF_COMMON('/curator/students', '/curator/leaderboard'),
  head_teacher: STAFF_COMMON('/curator/homeworks', '/analytics'),
  admin: STAFF_COMMON('/admin/users', '/analytics'),
};

/** The pumpkin hidden on this page for this role, or null. */
export function spotFor(role: string | undefined | null, pathname: string): HuntSpot | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return (role && SPOTS[role]?.find((s) => s.path === path)) || null;
}

const key = (userId: number | string) => `seasonal:halloween-2026:hunt:${userId}`;

/** The pages whose pumpkin this person has found on this device. */
export function readFound(storage: Storage | null, userId: number | string): string[] {
  try {
    const raw = storage?.getItem(key(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

export interface FindResult {
  found: number;
  isNew: boolean;
  complete: boolean;
}

export function markFound(storage: Storage | null, userId: number | string, path: string): FindResult {
  const before = readFound(storage, userId);
  const isNew = !before.includes(path);
  const after = isNew ? [...before, path] : before;
  if (isNew) {
    try {
      storage?.setItem(key(userId), JSON.stringify(after));
    } catch {
      // Private mode or a full quota: the find still counts for this visit.
    }
  }
  // Exactly the fifth: someone who found a pumpkin before it moved may pick up a sixth.
  return { found: after.length, isNew, complete: isNew && after.length === HUNT_SIZE };
}

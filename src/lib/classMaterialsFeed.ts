import type { FeedLessonEntry, LessonMaterials } from '../services/api/classMaterials';

/**
 * «Материалы» page — pure helpers for paginating and deep-linking `GET /class-materials/feed`.
 * Kept separate from `classMaterials.ts` (copy/formatting) and `classMaterialsView.ts` (per-item
 * view selection): this file is about the page's own list — merging pages and deciding what
 * belongs on top of it.
 */

/**
 * Appends a newly-loaded feed page's lessons after what is already shown, dropping any lesson
 * id already present. The backend's `(start_datetime, id)` cursor already guarantees no
 * duplicates across pages in the normal case (Review Focus 3); this is the client-side safety
 * net for it, and for a lesson that could otherwise appear twice after a group/search change.
 */
export function mergeFeedLessons(existing: FeedLessonEntry[], incoming: FeedLessonEntry[]): FeedLessonEntry[] {
  const seen = new Set(existing.map((entry) => entry.lesson.id));
  const merged = existing.slice();
  for (const entry of incoming) {
    if (seen.has(entry.lesson.id)) continue;
    seen.add(entry.lesson.id);
    merged.push(entry);
  }
  return merged;
}

/** `getClassMaterials(id)`'s richer payload, cut down to the three fields a feed card needs. */
export function toFeedEntry(data: Pick<LessonMaterials, 'lesson' | 'items' | 'pending_after_end'>): FeedLessonEntry {
  return { lesson: data.lesson, items: data.items, pending_after_end: data.pending_after_end };
}

/**
 * The list the page actually renders: the deep-linked lesson pinned at the top, but only when
 * it isn't already somewhere in the loaded feed pages — never a duplicate card for one lesson.
 */
export function buildVisibleLessons(entries: FeedLessonEntry[], pinned: FeedLessonEntry | null): FeedLessonEntry[] {
  if (!pinned) return entries;
  if (entries.some((entry) => entry.lesson.id === pinned.lesson.id)) return entries;
  return [pinned, ...entries];
}

export interface DeepLinkState {
  lessonId: number | null;
  /** Whether the current group/search's first feed page has come back at least once. */
  loadedFeedOnce: boolean;
  foundInEntries: boolean;
  /** A moderator who hasn't picked a group yet never gets a feed page to check at all. */
  moderatorAwaitingGroup: boolean;
}

/**
 * Whether `?lesson=<id>` needs its own `getClassMaterials` fetch: either the feed already had
 * its chance to include it and didn't, or — for a moderator with no group chosen yet — it never
 * will get that chance, so there is nothing worth waiting for.
 */
export function shouldFetchDeepLinkDirectly(state: DeepLinkState): boolean {
  if (state.lessonId === null || state.foundInEntries) return false;
  if (state.moderatorAwaitingGroup) return true;
  return state.loadedFeedOnce;
}

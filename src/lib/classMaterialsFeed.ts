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
  /** Whether the current group/search's first feed page has come back at least once. A
   *  moderator's group-less call answers this too (Controller Ruling 15: 200 with empty
   *  `lessons` rather than 400), so there is no separate "still waiting for a group" case here. */
  loadedFeedOnce: boolean;
  foundInEntries: boolean;
}

/**
 * Whether `?lesson=<id>` needs its own `getClassMaterials` fetch: the feed already had its one
 * chance to include it (its first page, for the current group/search) and didn't.
 */
export function shouldFetchDeepLinkDirectly(state: DeepLinkState): boolean {
  if (state.lessonId === null || state.foundInEntries) return false;
  return state.loadedFeedOnce;
}

export interface FeedFilters {
  groupId: number | null;
  q: string;
}

/**
 * Whether switching from `prev` to `next` filters should drop a pinned deep-linked lesson and
 * its highlight ring, so it doesn't keep floating at the top of a view the viewer just filtered
 * away from. `prev === null` is the very first filter snapshot (nothing to compare against yet,
 * so nothing has "changed") — not the same as picking a group for the first time, which is a
 * real change once a prior snapshot exists.
 */
export function filtersChanged(prev: FeedFilters | null, next: FeedFilters): boolean {
  if (prev === null) return false;
  return prev.groupId !== next.groupId || prev.q !== next.q;
}

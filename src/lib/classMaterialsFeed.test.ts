import { describe, expect, it } from 'vitest';
import type { FeedLessonEntry, LessonMaterials } from '../services/api/classMaterials';
import {
  buildVisibleLessons, feedFooter, filtersChanged, mergeFeedLessons, shouldFetchDeepLinkDirectly, toFeedEntry,
} from './classMaterialsFeed';

function lesson(id: number, overrides: Partial<FeedLessonEntry['lesson']> = {}): FeedLessonEntry['lesson'] {
  return {
    id,
    title: `Lesson ${id}`,
    start_datetime: '2026-09-20T12:00:00',
    end_datetime: '2026-09-20T13:00:00',
    is_active: true,
    topic: null,
    group_ids: [1],
    group_names: ['G1'],
    ...overrides,
  };
}

function entry(id: number, overrides: Partial<FeedLessonEntry['lesson']> = {}): FeedLessonEntry {
  return { lesson: lesson(id, overrides), items: [], pending_after_end: 0 };
}

describe('mergeFeedLessons', () => {
  it('appends a new page after the existing one', () => {
    const merged = mergeFeedLessons([entry(1), entry(2)], [entry(3), entry(4)]);
    expect(merged.map((e) => e.lesson.id)).toEqual([1, 2, 3, 4]);
  });

  it('drops a lesson id already present, keeping the earlier copy', () => {
    const original = entry(2, { title: 'first seen' });
    const merged = mergeFeedLessons([entry(1), original], [entry(2, { title: 'duplicate' }), entry(3)]);
    expect(merged.map((e) => e.lesson.id)).toEqual([1, 2, 3]);
    expect(merged[1].lesson.title).toBe('first seen');
  });

  it('returns a plain copy when incoming is empty', () => {
    const existing = [entry(1)];
    expect(mergeFeedLessons(existing, [])).toEqual(existing);
  });
});

describe('toFeedEntry', () => {
  it('keeps only lesson/items/pending_after_end from a LessonMaterials payload', () => {
    const data: Pick<LessonMaterials, 'lesson' | 'items' | 'pending_after_end'> = {
      lesson: lesson(5),
      items: [],
      pending_after_end: 2,
    };
    expect(toFeedEntry(data)).toEqual({ lesson: lesson(5), items: [], pending_after_end: 2 });
  });
});

describe('buildVisibleLessons', () => {
  it('returns the feed entries unchanged when nothing is pinned', () => {
    const entries = [entry(1), entry(2)];
    expect(buildVisibleLessons(entries, null)).toBe(entries);
  });

  it('prepends the pinned lesson when it is not already on the page', () => {
    const entries = [entry(1), entry(2)];
    const pinned = entry(9);
    expect(buildVisibleLessons(entries, pinned).map((e) => e.lesson.id)).toEqual([9, 1, 2]);
  });

  it('never duplicates a pinned lesson already present in the feed pages', () => {
    const entries = [entry(1), entry(9), entry(2)];
    const pinned = entry(9, { title: 'refetched copy' });
    expect(buildVisibleLessons(entries, pinned)).toBe(entries);
  });
});

describe('shouldFetchDeepLinkDirectly', () => {
  it('is false when there is no deep link', () => {
    expect(shouldFetchDeepLinkDirectly({
      lessonId: null, loadedFeedOnce: true, foundInEntries: false,
    })).toBe(false);
  });

  it('is false once the lesson has been found in the loaded feed', () => {
    expect(shouldFetchDeepLinkDirectly({
      lessonId: 5, loadedFeedOnce: true, foundInEntries: true,
    })).toBe(false);
  });

  it('waits for the first feed page before fetching directly', () => {
    expect(shouldFetchDeepLinkDirectly({
      lessonId: 5, loadedFeedOnce: false, foundInEntries: false,
    })).toBe(false);
  });

  it('fetches once the first feed page came back without the lesson — including a moderator\'s group-less call, which now answers 200 instead of 400 (Controller Ruling 15)', () => {
    expect(shouldFetchDeepLinkDirectly({
      lessonId: 5, loadedFeedOnce: true, foundInEntries: false,
    })).toBe(true);
  });
});

describe('filtersChanged', () => {
  it('is false for the very first filter snapshot', () => {
    expect(filtersChanged(null, { groupId: null, q: '' })).toBe(false);
  });

  it('is false when neither filter differs', () => {
    expect(filtersChanged({ groupId: 3, q: 'algebra' }, { groupId: 3, q: 'algebra' })).toBe(false);
  });

  it('is true when the group changes, including a moderator picking their first group', () => {
    expect(filtersChanged({ groupId: null, q: '' }, { groupId: 3, q: '' })).toBe(true);
  });

  it('is true when the search text changes', () => {
    expect(filtersChanged({ groupId: 3, q: '' }, { groupId: 3, q: 'algebra' })).toBe(true);
  });
});

describe('feedFooter', () => {
  const base = { loading: false, failed: false, loadMoreFailed: false, nextBefore: '2026-09-20T12:00:00' };

  it('offers Load more while there is a next page', () => {
    expect(feedFooter(base)).toBe('loadMore');
  });

  it('turns a failed Load more into the failure line, keeping the cursor for Retry', () => {
    expect(feedFooter({ ...base, loadMoreFailed: true })).toBe('loadMoreFailed');
  });

  it('shows nothing without a next page, while the first page loads, or after it failed', () => {
    expect(feedFooter({ ...base, nextBefore: null })).toBe('none');
    expect(feedFooter({ ...base, nextBefore: null, loadMoreFailed: true })).toBe('none');
    expect(feedFooter({ ...base, loading: true })).toBe('none');
    expect(feedFooter({ ...base, failed: true })).toBe('none');
  });
});

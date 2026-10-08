import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ default: { get }, api: { get } }));

import { listManageableLessons, normalizeFeedPage } from './classMaterials';

beforeEach(() => get.mockReset());

describe('listManageableLessons', () => {
  it('asks for one group, uncached, and returns the rows', async () => {
    const rows = [{ lesson: { id: 5 }, item_count: 0 }];
    get.mockResolvedValue({ data: { lessons: rows } });
    expect(await listManageableLessons(12)).toEqual(rows);
    expect(get).toHaveBeenCalledWith('/class-materials/manageable-lessons', { params: { group_id: 12 }, cache: false });
  });

  it('can cap the page', async () => {
    get.mockResolvedValue({ data: { lessons: [] } });
    await listManageableLessons(12, 30);
    expect(get).toHaveBeenCalledWith('/class-materials/manageable-lessons', { params: { group_id: 12, limit: 30 }, cache: false });
  });

  it('treats a body without a lessons list as a failed load', async () => {
    get.mockResolvedValue({ data: '<!doctype html>' });
    await expect(listManageableLessons(12)).rejects.toThrow('Unexpected class-materials response');
  });
});

describe('the feed keeps what says a teacher can add to a lesson', () => {
  it('passes can_manage through on a lesson row', () => {
    const page = { lessons: [{ lesson: { id: 1 }, items: [], pending_after_end: 0, can_manage: true }], next_before: null, groups: [] };
    expect(normalizeFeedPage(page).lessons[0].can_manage).toBe(true);
  });
});

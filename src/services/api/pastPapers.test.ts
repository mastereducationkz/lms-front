import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

import { buildCacheKey, clearCache, getCached, getTtlForUrl, invalidateForMutation, setCached } from './cache';
import { getPastPaperCatalog, getPastPaperGrid, getPastPaperStatus } from './pastPapers';

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { ok: true } });
});

describe('past paper API calls', () => {
  it('the catalog sends the builder\'s groups as one comma-separated list', async () => {
    await getPastPaperCatalog([4, 9]);
    expect(get).toHaveBeenCalledWith('/past-papers/catalog', { params: { group_ids: '4,9' } });
  });

  it('the catalog sends no group filter when none is chosen yet', async () => {
    await getPastPaperCatalog([]);
    expect(get).toHaveBeenCalledWith('/past-papers/catalog', { params: {} });
  });

  it('status passes the student for staff', async () => {
    await getPastPaperStatus(12, 77);
    expect(get).toHaveBeenCalledWith('/past-papers/assignments/12/status', { params: { student_id: 77 } });
  });

  it('status sends no student for a student reading their own homework (NaN or missing)', async () => {
    await getPastPaperStatus(12);
    expect(get).toHaveBeenLastCalledWith('/past-papers/assignments/12/status', { params: {} });
    await getPastPaperStatus(12, Number.NaN);
    expect(get).toHaveBeenLastCalledWith('/past-papers/assignments/12/status', { params: {} });
  });

  it('the grid is read per group', async () => {
    const data = await getPastPaperGrid(5);
    expect(get).toHaveBeenCalledWith('/past-papers/groups/5/grid');
    expect(data).toEqual({ ok: true });
  });
});

describe('past paper cache rules', () => {
  it('never caches a paper\'s status (SAT results arrive at any moment)', () => {
    expect(getTtlForUrl('/past-papers/assignments/12/status')).toBe(0);
  });

  it('caches the catalog for a minute', () => {
    expect(getTtlForUrl('/past-papers/catalog')).toBe(60 * 1000);
  });

  it('drops cached past-paper reads when a homework is saved or submitted', () => {
    const key = buildCacheKey('/past-papers/catalog', { params: { group_ids: '1' } });
    setCached(key, { enabled: true }, 60_000);
    expect(getCached(key)).toBeDefined();
    invalidateForMutation('/assignments/12/submit');
    expect(getCached(key)).toBeUndefined();
    clearCache();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.fn(); const del = vi.fn(); const get = vi.fn();
vi.mock('./client', () => ({ api: { put: (...a: unknown[]) => put(...a), delete: (...a: unknown[]) => del(...a), get: (...a: unknown[]) => get(...a) } }));

import { deleteEvent, getEventSeries, updateEvent } from './events';

beforeEach(() => {
  put.mockReset(); del.mockReset(); get.mockReset();
  put.mockResolvedValue({ data: { id: 5 } });
  del.mockResolvedValue({ data: { deleted: 3 } });
  get.mockResolvedValue({ data: { series_id: 'abc', total: 50, position: 3, following: 48 } });
});

describe('series scope on the events API', () => {
  it('an edit is for this event only unless asked otherwise (no scope param at all)', async () => {
    await updateEvent(5, { title: 'T' });
    expect(put).toHaveBeenCalledWith('/admin/events/5', { title: 'T' }, undefined);
  });

  it('an edit can reach this and all following', async () => {
    await updateEvent(5, { title: 'T' }, 'following');
    expect(put).toHaveBeenCalledWith('/admin/events/5', { title: 'T' }, { params: { scope: 'following' } });
  });

  it('a cancel is for this event only unless asked otherwise, and says how many went', async () => {
    expect(await deleteEvent(5)).toBe(3);
    expect(del).toHaveBeenCalledWith('/admin/events/5', undefined);
    await deleteEvent(5, 'following');
    expect(del).toHaveBeenLastCalledWith('/admin/events/5', { params: { scope: 'following' } });
  });

  it('asks where an event stands in its series', async () => {
    expect(await getEventSeries(5)).toEqual({ series_id: 'abc', total: 50, position: 3, following: 48 });
    expect(get).toHaveBeenCalledWith('/admin/events/5/series');
  });
});

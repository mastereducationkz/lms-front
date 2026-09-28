import { describe, it, expect, vi, beforeEach } from 'vitest';

// `./client` touches `document`/`localStorage` at module scope, which vitest's node environment
// doesn't have; mock it, as assignment-zero.test.ts does.
vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from './client';
import { CLASS_MATERIAL_NOTIFICATION_TYPES, getNotifications, getUnreadNotificationCount } from './notifications';

const get = api.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => get.mockReset());

describe('getNotifications (LMS-FRONT-5)', () => {
  it('passes a real list through', async () => {
    const list = [{ id: 1, title: 't', content: 'c', notification_type: 'class_materials', related_id: null, is_read: false, created_at: '2026-09-28T00:00:00Z' }];
    get.mockResolvedValueOnce({ data: list });
    expect(await getNotifications(CLASS_MATERIAL_NOTIFICATION_TYPES)).toEqual(list);
  });

  it.each([
    ['an empty body after a dropped request', ''],
    ['an HTML page from a proxy', '<html>502</html>'],
    ['an error envelope', { detail: 'Internal error' }],
    ['null', null],
    ['no data at all', undefined],
  ])('turns %s into an empty list, so .some/.map never crash', async (_label, data) => {
    get.mockResolvedValueOnce({ data });
    const result = await getNotifications(CLASS_MATERIAL_NOTIFICATION_TYPES);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
    expect(() => result.some(() => true)).not.toThrow();
  });

  it('still rejects on a network failure, for the caller to fall back to an empty list', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { request: {}, response: undefined }));
    await expect(getNotifications(CLASS_MATERIAL_NOTIFICATION_TYPES)).rejects.toThrow('Network Error');
  });
});

describe('getUnreadNotificationCount', () => {
  it.each([
    [{ count: 3 }, 3],
    [{ count: 0 }, 0],
    [{ count: '3' }, 0],
    [{ count: -1 }, 0],
    ['', 0],
    [undefined, 0],
  ])('reads %j as %d', async (data, expected) => {
    get.mockResolvedValueOnce({ data });
    expect(await getUnreadNotificationCount(CLASS_MATERIAL_NOTIFICATION_TYPES)).toBe(expected);
  });
});

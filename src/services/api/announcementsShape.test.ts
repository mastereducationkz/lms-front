import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

import { getAnnouncements, getGroups, getRecipientSummary } from './announcements';

beforeEach(() => get.mockReset());

describe('the announcements reads never hand the page a shape it cannot filter or map', () => {
  it('getGroups returns the list as it came', async () => {
    get.mockResolvedValue({ data: [{ id: 1, status: 'approved' }] });
    expect(await getGroups()).toEqual([{ id: 1, status: 'approved' }]);
  });

  it.each([[{ ok: true, captured: true }], [null], ['oops'], [{ groups: 'x' }]])('getGroups turns %j into an empty list', async (body) => {
    get.mockResolvedValue({ data: body });
    expect(await getGroups()).toEqual([]);
  });

  it('getGroups unwraps an {items} or {groups} body', async () => {
    get.mockResolvedValue({ data: { items: [{ id: 3 }] } });
    expect(await getGroups()).toEqual([{ id: 3 }]);
    get.mockResolvedValue({ data: { groups: [{ id: 4 }] } });
    expect(await getGroups()).toEqual([{ id: 4 }]);
  });

  it('getRecipientSummary falls back to zero counts', async () => {
    get.mockResolvedValue({ data: null });
    expect(await getRecipientSummary()).toEqual({ approved_groups: 0, students_opted_in: 0, students_bound: 0 });
    get.mockResolvedValue({ data: { approved_groups: 2, students_opted_in: 5, students_bound: 7 } });
    expect(await getRecipientSummary()).toEqual({ approved_groups: 2, students_opted_in: 5, students_bound: 7 });
  });

  it('getAnnouncements always carries an announcements array', async () => {
    get.mockResolvedValue({ data: { ok: true, items: [] } });
    expect(await getAnnouncements()).toEqual({ announcements: [], total: 0 });
    get.mockResolvedValue({ data: { announcements: [{ id: 9 }], total: 1 } });
    expect(await getAnnouncements()).toEqual({ announcements: [{ id: 9 }], total: 1 });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { getAutomaticMessages } from './announcements';

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { total: 0, items: [] } });
});

const paramsOfCall = () => (get.mock.calls[get.mock.calls.length - 1][1] as { params: Record<string, unknown> }).params;

describe('getAutomaticMessages', () => {
  it('asks the record for a week, 50 at a time, by default', async () => {
    await getAutomaticMessages({});
    expect(get.mock.calls[0][0]).toBe('/announcements/automatic');
    expect(paramsOfCall()).toEqual({ days: 7, limit: 50, offset: 0 });
  });

  it('passes the filters along and leaves out the empty ones', async () => {
    await getAutomaticMessages({ days: 30, kind: 'weekly_test', status: 'failed', q: ' тест ', chatId: 228, limit: 20, offset: 40 });
    expect(paramsOfCall()).toEqual({ days: 30, kind: 'weekly_test', status: 'failed', q: 'тест', chat_id: 228, limit: 20, offset: 40 });
    await getAutomaticMessages({ kind: '', status: '', q: '   ' });
    expect(paramsOfCall()).toEqual({ days: 7, limit: 50, offset: 0 });
  });

  it('returns the total and the items', async () => {
    get.mockResolvedValue({ data: { total: 3, items: [{ id: 1 }] } });
    expect(await getAutomaticMessages({})).toEqual({ total: 3, items: [{ id: 1 }] });
  });

  it('says why it failed when the backend does', async () => {
    get.mockRejectedValue({ response: { data: { detail: 'Support platform is unreachable' } } });
    await expect(getAutomaticMessages({})).rejects.toThrow(/unreachable/);
  });
});

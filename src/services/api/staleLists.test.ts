// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

const { api, clearCache } = await import('./client');
const { setCached, invalidateForMutation } = await import('./cache');

type Hit = { method: string; url: string };

/** Replace the network with a counter, keeping the client's own cache layer in front of it. */
function fakeNetwork(hits: Hit[]) {
  api.defaults.adapter = async (config) => {
    hits.push({ method: String(config.method), url: String(config.url) });
    return { data: { n: hits.length }, status: 200, statusText: 'OK', headers: {}, config } as never;
  };
}

describe('lists refetch after the mutation that changes them', () => {
  let hits: Hit[];
  beforeEach(() => {
    clearCache();
    hits = [];
    fakeNetwork(hits);
  });

  const gets = (url: string) => hits.filter((h) => h.method === 'get' && h.url === url).length;

  it('POST /admin/events drops the cached /admin/events list', async () => {
    await api.get('/admin/events', { params: { limit: 100 } });
    await api.get('/admin/events', { params: { limit: 100 } });
    expect(gets('/admin/events')).toBe(1);
    await api.post('/admin/events', { title: 'x' });
    await api.get('/admin/events', { params: { limit: 100 } });
    expect(gets('/admin/events')).toBe(2);
  });

  it('saving a register drops the attendance grid, the journal and the head-teacher table', async () => {
    const reads = ['/leaderboard/curator/full-attendance/7', '/leaderboard/curator/weekly-lessons/7', '/student-journal/group/7', '/head-teacher/course/3/teachers'];
    for (const url of reads) await api.get(url);
    for (const url of reads) await api.get(url);
    for (const url of reads) expect(gets(url)).toBe(1);
    await api.post('/events/55/attendance', { attendance: [] });
    for (const url of reads) await api.get(url);
    for (const url of reads) expect(gets(url)).toBe(2);
  });

  it('saving activity scores drops them too', async () => {
    await api.get('/leaderboard/curator/leaderboard/7', { params: { week_number: 1 } });
    await api.put('/events/55/activity-scores', { scores: [] });
    await api.get('/leaderboard/curator/leaderboard/7', { params: { week_number: 1 } });
    expect(gets('/leaderboard/curator/leaderboard/7')).toBe(2);
  });

  it('an invalidated entry does not come back from the persisted copy after a reload', () => {
    vi.useFakeTimers();
    try {
      window.sessionStorage.clear();
      setCached('/admin/events::{limit:2000}', [{ id: 1 }], 60_000);
      vi.advanceTimersByTime(600); // the debounced write has stored it
      expect(window.sessionStorage.getItem('lms:api-cache:v1')).toContain('/admin/events::');
      invalidateForMutation('/admin/events'); // a create
      // No waiting: a reload right now must not find the entry in the stored copy.
      expect(window.sessionStorage.getItem('lms:api-cache:v1') ?? '').not.toContain('/admin/events::');
    } finally {
      vi.useRealTimers();
    }
  });
});

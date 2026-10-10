// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});

const getAllEvents = vi.fn();
const deleteEvent = vi.fn();
const getEventSeries = vi.fn();
vi.mock('../services/api', () => ({
  getAllEvents: (...a: unknown[]) => getAllEvents(...a),
  getAllGroups: vi.fn().mockResolvedValue([]),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
  bulkDeleteEvents: vi.fn(),
  getEventSeries: (...a: unknown[]) => getEventSeries(...a),
}));

import EventManagement from './EventManagement';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

const week = (n: number) => new Date(Date.UTC(2099, 0, 3 + 7 * n, 9, 0)).toISOString();
const ev = (id: number, n: number, extra: object = {}) => ({
  id, title: 'NUET Math Office Hours — Akzhol', event_type: 'webinar', start_datetime: week(n), end_datetime: week(n), is_online: true,
  created_by: 1, creator_name: 'Admin', is_active: true, is_recurring: false, series_id: 's1', participant_count: 0, created_at: '2026-10-10T00:00:00Z', ...extra,
});
const events = [ev(11, 0), ev(12, 1), ev(13, 2), ev(20, 3, { title: 'One-off webinar', series_id: null })];

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><EventManagement /></MemoryRouter>); });
  await settle();
}
beforeEach(() => {
  getAllEvents.mockReset(); deleteEvent.mockReset(); getEventSeries.mockReset();
  getAllEvents.mockResolvedValue(events);
  deleteEvent.mockResolvedValue(3);
  getEventSeries.mockResolvedValue({ series_id: 's1', total: 3, position: 1, following: 3 });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const titles = (text: string) => Array.from(host.querySelectorAll('h3, span.truncate')).filter((n) => n.textContent === text).length;
const button = (name: string) => Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes(name));

describe('events list: weekly series', () => {
  it('shows a series as one line, with the weeks closed', async () => {
    await show();
    expect(host.textContent).toContain('Weekly series');
    expect(host.textContent).toContain('3 upcoming · 3 in all');
    expect(titles('NUET Math Office Hours — Akzhol')).toBe(1);
    expect(titles('One-off webinar')).toBe(1);
  });

  it('opens the weeks under it', async () => {
    await show();
    const line = Array.from(host.querySelectorAll('button[aria-expanded]')).find((b) => b.textContent?.includes('Weekly series')) as HTMLElement;
    await act(async () => { line.click(); });
    expect(titles('NUET Math Office Hours — Akzhol')).toBe(4);      // the series line and its three weeks
  });

  it('lists every week on its own when grouping is switched off', async () => {
    await show();
    const toggle = host.querySelector('#group-series') as HTMLInputElement;
    await act(async () => { toggle.click(); });
    expect(titles('NUET Math Office Hours — Akzhol')).toBe(3);
    expect(host.textContent).not.toContain('Weekly series');
  });

  it('cancels the upcoming weeks of a series in one go and reloads', async () => {
    await show();
    await act(async () => { button('Cancel upcoming')!.click(); });
    await settle();
    expect(getEventSeries).toHaveBeenCalledWith(11);
    expect(document.body.textContent).toContain('This and all 2 following events');
    await act(async () => { (document.body.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click(); });
    const calls = getAllEvents.mock.calls.length;
    await act(async () => { button('Cancel events')!.click(); });
    await settle();
    expect(deleteEvent).toHaveBeenCalledWith(11, 'following');
    expect(getAllEvents.mock.calls.length).toBeGreaterThan(calls);
  });
});

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
const restoreEvent = vi.fn();
vi.mock('../services/api', () => ({
  getAllEvents: (...a: unknown[]) => getAllEvents(...a),
  getAllGroups: vi.fn().mockResolvedValue([]),
  deleteEvent: (...a: unknown[]) => deleteEvent(...a),
  bulkDeleteEvents: vi.fn(),
  getEventSeries: (...a: unknown[]) => getEventSeries(...a),
  restoreEvent: (...a: unknown[]) => restoreEvent(...a),
}));

// The detail card's recording section and platform links reach for the API client, which a lesson card never uses.
vi.mock('../components/calendar/LessonRecordingSection', () => ({ default: () => null }));
vi.mock('../lib/platformLinks', () => ({ openPlatformPage: vi.fn(), parsePlatformUrl: () => null }));

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
  getAllEvents.mockReset(); deleteEvent.mockReset(); getEventSeries.mockReset(); restoreEvent.mockReset();
  getAllEvents.mockResolvedValue(events);
  deleteEvent.mockResolvedValue(3);
  restoreEvent.mockResolvedValue(2);
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

describe('events list: finished and cancelled events', () => {
  const cancelledWeeks = [ev(11, 0), ev(12, 1, { is_active: false }), ev(13, 2, { is_active: false }), ev(20, 3, { title: 'One-off webinar', series_id: null, is_active: false })];
  const exactButton = (name: string) => Array.from(document.body.querySelectorAll('button')).filter((b) => b.textContent?.trim() === name);

  it('asks for the upcoming ones first, and for all of them', async () => {
    await show();
    expect(getAllEvents).toHaveBeenLastCalledWith(expect.objectContaining({ include_finished: false, include_cancelled: false, limit: 2000 }));
  });

  it('shows finished events when asked, and reloads', async () => {
    await show();
    await act(async () => { (host.querySelector('#show-finished') as HTMLInputElement).click(); });
    await settle();
    expect(getAllEvents).toHaveBeenLastCalledWith(expect.objectContaining({ include_finished: true, include_cancelled: false }));
  });

  it('lists cancelled events only when asked', async () => {
    await show();
    await act(async () => { (host.querySelector('#show-cancelled') as HTMLInputElement).click(); });
    await settle();
    expect(getAllEvents).toHaveBeenLastCalledWith(expect.objectContaining({ include_cancelled: true }));
  });

  it('counts only the live weeks of a series, names the cancelled ones and restores them in one go', async () => {
    getAllEvents.mockResolvedValue(cancelledWeeks);
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await show();
    expect(host.textContent).toContain('1 upcoming · 1 in all · 2 cancelled');
    await act(async () => { button('Restore cancelled (2)')!.click(); });
    await settle();
    expect(confirmed).toHaveBeenCalled();
    expect(restoreEvent).toHaveBeenCalledWith(12, 'following');
    confirmed.mockRestore();
  });

  it('leaves the cancelled weeks alone when the restore is not confirmed', async () => {
    getAllEvents.mockResolvedValue(cancelledWeeks);
    const confirmed = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await show();
    await act(async () => { button('Restore cancelled (2)')!.click(); });
    await settle();
    expect(restoreEvent).not.toHaveBeenCalled();
    confirmed.mockRestore();
  });

  it('puts a Restore button, not Edit and Delete, on a cancelled event', async () => {
    getAllEvents.mockResolvedValue(cancelledWeeks);
    await show();
    expect(host.textContent).toContain('Cancelled');
    const restore = exactButton('Restore');
    expect(restore).toHaveLength(1);                                 // the one-off; the series restores through its own line
    await act(async () => { restore[0].click(); });
    await settle();
    expect(restoreEvent).toHaveBeenCalledWith(20, 'this');
  });

  it('gives a cancelled event no checkbox to select it for deletion', async () => {
    getAllEvents.mockResolvedValue([ev(20, 3, { title: 'One-off webinar', series_id: null, is_active: false })]);
    await show();
    const rows = Array.from(host.querySelectorAll('h3')).filter((n) => n.textContent === 'One-off webinar');
    expect(rows).toHaveLength(1);
    expect(rows[0].closest('div.p-6')!.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe('events list: the ⋯ menu', () => {
  it('View Details opens the event card in place, not the dashboard', async () => {
    getAllEvents.mockResolvedValue([ev(30, 0, { title: 'Lesson 5', event_type: 'class', series_id: null, groups: ['G1'] })]);
    await show();
    const trigger = Array.from(host.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-ellipsis, svg.lucide-more-horizontal'));
    expect(trigger).toBeTruthy();
    await act(async () => { trigger!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })); });
    const view = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent?.includes('View Details')) as HTMLElement;
    await act(async () => { view.click(); });
    await settle();
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Lesson 5');
    expect(dialog?.textContent).toContain('Open lesson');
    expect(host.textContent).toContain('Lesson 5');                  // still on the list
  });
});

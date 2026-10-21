// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../services/api/apiError';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});

const api = vi.hoisted(() => ({ getAllEvents: vi.fn(), deleteEvent: vi.fn(), bulkDeleteEvents: vi.fn(), getEventSeries: vi.fn() }));
vi.mock('../services/api', () => ({ ...api, getAllGroups: vi.fn().mockResolvedValue([]), restoreEvent: vi.fn() }));
const getPublicSummary = vi.hoisted(() => vi.fn());
vi.mock('../services/api/openWebinars', () => ({ getPublicSummary }));
vi.mock('../components/calendar/LessonRecordingSection', () => ({ default: () => null }));
vi.mock('../components/open-webinars/PublicAccessStrip', () => ({ default: () => null }));
vi.mock('../lib/platformLinks', () => ({ openPlatformPage: vi.fn(), parsePlatformUrl: () => null }));

import EventManagement from './EventManagement';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

const ev = (id: number, title: string, extra: object = {}) => ({
  id, title, event_type: 'webinar', start_datetime: '2099-01-03T09:00:00Z', end_datetime: '2099-01-03T10:00:00Z', is_online: true, created_by: 1,
  creator_name: 'Admin', is_active: true, is_recurring: false, series_id: null, participant_count: 0, created_at: '2026-10-10T00:00:00Z', ...extra,
});
const events = [ev(20, 'Open day'), ev(21, 'Past open day', { start_datetime: '2020-01-03T09:00:00Z', end_datetime: '2020-01-03T10:00:00Z' })];

let root: Root | null = null;
let host: HTMLDivElement;
const confirmSpy = vi.fn();
const alertSpy = vi.fn();
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><EventManagement /></MemoryRouter>); });
  await settle();
}
beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  getPublicSummary.mockReset();
  confirmSpy.mockReset().mockReturnValue(true);
  alertSpy.mockReset();
  vi.stubGlobal('confirm', confirmSpy);
  vi.stubGlobal('alert', alertSpy);
  api.getAllEvents.mockResolvedValue(events);
  api.deleteEvent.mockResolvedValue(1);
  api.bulkDeleteEvents.mockResolvedValue(undefined);
  api.getEventSeries.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const NOTE = 'Everyone who registered is told it is cancelled.';
/** Opens the ⋯ menu of the row titled `title` and clicks Delete. */
async function deleteRow(title: string) {
  const row = Array.from(host.querySelectorAll('h3')).find((h) => h.textContent === title)!.closest('div.p-6') as HTMLElement;
  const trigger = Array.from(row.querySelectorAll('button')).pop() as HTMLButtonElement;
  await act(async () => { trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })); });
  const item = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((i) => i.textContent?.includes('Delete')) as HTMLElement;
  await act(async () => { item.click(); });
  await settle();
}

describe('Manage events: deleting a webinar that is open to everyone', () => {
  it('says registrants are told when it is still ahead', async () => {
    getPublicSummary.mockResolvedValue({ open: true });
    await show();
    await deleteRow('Open day');
    expect(getPublicSummary).toHaveBeenCalledWith(20);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain('Are you sure you want to delete this event?');
    expect(confirmSpy.mock.calls[0][0]).toContain(NOTE);
    expect(api.deleteEvent).toHaveBeenCalledWith(20);
  });

  it('keeps the plain question for a webinar that is not open', async () => {
    getPublicSummary.mockResolvedValue({ open: false });
    await show();
    await deleteRow('Open day');
    expect(confirmSpy.mock.calls[0][0]).not.toContain(NOTE);
    expect(api.deleteEvent).toHaveBeenCalled();
  });

  it('does not delete when the person says no', async () => {
    getPublicSummary.mockResolvedValue({ open: true });
    confirmSpy.mockReturnValue(false);
    await show();
    await deleteRow('Open day');
    expect(api.deleteEvent).not.toHaveBeenCalled();
  });

  it('does not even ask the server about a webinar that already took place', async () => {
    await show();
    await deleteRow('Past open day');
    expect(getPublicSummary).not.toHaveBeenCalled();
    expect(confirmSpy.mock.calls[0][0]).not.toContain(NOTE);
  });

  it('shows the server’s own reason when a webinar that took place cannot be deleted', async () => {
    getPublicSummary.mockResolvedValue({ open: false });
    api.deleteEvent.mockRejectedValue(apiError({ response: { data: {
      detail: 'This webinar already took place and has a public page, registrations or a recording, so it stays as history.', reason_code: 'webinar_public_delete' } } }, 'Failed to delete event'));
    await show();
    await deleteRow('Past open day');
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('stays as history'));
  });

  it('keeps the generic message for any other failure', async () => {
    getPublicSummary.mockResolvedValue({ open: false });
    api.deleteEvent.mockRejectedValue(new Error('boom'));
    await show();
    await deleteRow('Open day');
    expect(alertSpy).toHaveBeenCalledWith('Error deleting event');
  });

  it('a bulk delete says so too when any selected webinar is open and ahead, and shows the server’s refusal', async () => {
    getPublicSummary.mockImplementation(async (id: number) => ({ open: id === 20 }));
    api.bulkDeleteEvents.mockRejectedValue(apiError({ response: { data: { detail: 'It stays as history.', reason_code: 'webinar_public_delete' } } }, 'Failed to delete events'));
    await show();
    for (const box of Array.from(host.querySelectorAll('div.p-6 input[type="checkbox"]'))) await act(async () => { (box as HTMLInputElement).click(); });
    const bulk = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.includes('Delete')) as HTMLButtonElement;
    await act(async () => { bulk.click(); });
    await settle();
    expect(confirmSpy.mock.calls[0][0]).toContain(NOTE);
    expect(alertSpy).toHaveBeenCalledWith('It stays as history.');
  });
});

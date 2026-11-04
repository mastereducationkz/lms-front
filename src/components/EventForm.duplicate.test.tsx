// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role } }) };
});

const events = vi.hoisted(() => ({
  createEvent: vi.fn(), createCuratorEvent: vi.fn(), updateEvent: vi.fn(), getEventHosts: vi.fn(), getAllGroups: vi.fn(), getCuratorGroups: vi.fn(), getCourses: vi.fn(),
}));
vi.mock('../services/api', () => ({
  ...events, getEventSeries: vi.fn().mockResolvedValue(null), getCourseModules: vi.fn().mockResolvedValue([]), getModuleLessons: vi.fn().mockResolvedValue([]),
}));
const open = vi.hoisted(() => ({
  getOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), preflightOpenAccess: vi.fn(), saveOpenAccess: vi.fn(), uploadBanner: vi.fn(),
  getOpenAccess: vi.fn(), closeOpenAccess: vi.fn(),
}));
vi.mock('../services/api/openWebinars', () => open);

import EventForm from './EventForm';
import { duplicateDraftOf } from './open-webinars/duplicate';
import type { OpenAccess } from '../services/api/openWebinars';
import type { Event } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const SETTINGS = {
  policy_text: 'Policy', policy_version: 'abc', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }, { id: 10736538, name: 'NUET + IELTS' }],
};
const SOURCE = {
  id: 77, title: 'SAT Math open day', description: 'Bring a calculator.', event_type: 'webinar',
  start_datetime: '2026-11-01T09:00:00', end_datetime: '2026-11-01T10:30:00', location: 'Room 4', is_online: true,
  meeting_url: 'https://meet.google.com/abc-defg-hij', created_by: 1, is_active: true, is_recurring: false, participant_count: 0,
  course_ids: [3], group_ids: [1], teacher_id: 5, max_participants: 300,
} as Event;
const ACCESS = {
  event_id: 77, open: true, access_mode: 'registration', slug: 'sat-math-open-day', speaker_id: 3, presenter: 'host',
  lead_pipeline_id: 10520038, banner_url: '/uploads/webinar_banners/a.png', title_en: 'SAT Math', description_en: 'Bring one.', ask_profile: true,
} as OpenAccess;
const CREATED = { id: 501, title: 'SAT Math open day #2', event_type: 'webinar' } as Event;

let root: Root | null = null;
let host: HTMLDivElement;
const onSave = vi.fn();
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
async function show(access: OpenAccess = ACCESS) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const duplicate = duplicateDraftOf(SOURCE, access);
  await act(async () => { root!.render(<MemoryRouter><EventForm onSave={onSave} onCancel={() => {}} onAccessFailed={vi.fn()} duplicate={duplicate} /></MemoryRouter>); });
  await settle();
}
const value = (selector: string) => (host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement).value;
const type = (selector: string, next: string) => act(async () => {
  const input = host.querySelector(selector) as HTMLInputElement;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click(); });
const saveButton = () => host.querySelector('button[type="submit"]') as HTMLButtonElement;
const checked = (selector: string) => host.querySelector(selector)?.getAttribute('data-state') === 'checked';

beforeEach(() => {
  auth.role = 'admin';
  Object.values(events).forEach((fn) => fn.mockReset());
  Object.values(open).forEach((fn) => fn.mockReset());
  onSave.mockReset();
  events.getEventHosts.mockResolvedValue([{ id: 5, name: 'Aldiyar', role: 'teacher', has_workspace: true }]);
  events.getAllGroups.mockResolvedValue([{ id: 1, name: 'Group one', student_count: 3, is_special: false }]);
  events.getCuratorGroups.mockResolvedValue([{ id: 1, name: 'Group one', student_count: 3, is_special: false }]);
  events.getCourses.mockResolvedValue([{ id: '3', title: 'SAT Math' }, { id: '4', title: 'IELTS' }]);
  events.createEvent.mockResolvedValue(CREATED);
  events.createCuratorEvent.mockResolvedValue(CREATED);
  open.getOpenSettings.mockResolvedValue(SETTINGS);
  open.listGuestSpeakers.mockResolvedValue([{ id: 3, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
  open.preflightOpenAccess.mockResolvedValue({ ok: true, slug: 'sat-math-open-day-2' });
  open.saveOpenAccess.mockResolvedValue({ event_id: 501, access_mode: 'registration', slug: 'sat-math-open-day-2', banner_url: null });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('create form started from «Duplicate»', () => {
  it('says what it is a copy of and what to fill in', async () => {
    await show();
    expect(host.querySelector('[data-duplicate-note]')?.textContent).toBe('Copy of the webinar «SAT Math open day» — choose the date, title, speaker and banner.');
  });

  it('starts with the copied fields and the per-webinar ones empty', async () => {
    await show();
    expect(value('#title')).toBe('');
    expect(value('#description')).toBe('Bring a calculator.');
    expect(value('#start_datetime')).toBe('');
    expect(value('#end_datetime')).toBe('');
    expect(value('#location')).toBe('');
    expect(value('#meeting_url')).toBe('');
    expect(value('#max_participants')).toBe('300');
    expect(checked('#is_online')).toBe(true);
    expect(checked('#course-3')).toBe(true);
    expect(checked('#course-4')).toBe(false);
    expect(checked('#group-1')).toBe(true);
    expect((host.querySelector('input[name="access-mode"][value="registration"]') as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the source length: the end follows the chosen start until it is typed by hand', async () => {
    await show();
    await type('#start_datetime', '2099-03-03T14:00');
    expect(value('#end_datetime')).toBe('2099-03-03T15:30');
    await type('#start_datetime', '2099-03-04T10:00');
    expect(value('#end_datetime')).toBe('2099-03-04T11:30');
    await type('#end_datetime', '2099-03-04T12:00');
    await type('#start_datetime', '2099-03-05T10:00');
    expect(value('#end_datetime')).toBe('2099-03-04T12:00');
  });

  it('a source presented by its guest speaker needs a speaker picked again before Create', async () => {
    await show({ ...ACCESS, presenter: 'speaker' });
    await type('#title', 'SAT Math open day #2');
    await type('#start_datetime', '2099-03-03T14:00');
    expect(saveButton().disabled).toBe(true);
  });

  it.each([['admin', 'createEvent'], ['head_teacher', 'createEvent'], ['head_curator', 'createCuratorEvent']] as const)(
    '%s: Create checks, creates and saves the copied access — no banner, speaker, address or English texts', async (role, endpoint) => {
      auth.role = role;
      await show();
      await type('#title', 'SAT Math open day #2');
      await type('#start_datetime', '2099-03-03T14:00');
      await settle();
      expect(saveButton().disabled).toBe(false);
      await click(saveButton());
      await settle();

      expect(open.preflightOpenAccess).toHaveBeenCalledTimes(1);
      expect(open.preflightOpenAccess.mock.calls[0][0]).toMatchObject({
        access_mode: 'registration', lead_pipeline_id: 10520038, title: 'SAT Math open day #2', teacher_id: 5,
        meeting_url: null, slug: null, speaker_id: null, presenter: 'host', is_recurring: false,
      });
      expect(events[endpoint]).toHaveBeenCalledTimes(1);
      const created = events[endpoint].mock.calls[0][0];
      expect(created).toMatchObject({
        title: 'SAT Math open day #2', description: 'Bring a calculator.', event_type: 'webinar', is_online: true,
        course_ids: [3], group_ids: [1], teacher_id: 5, max_participants: 300, is_recurring: false,
      });
      expect(created.meeting_url).toBeUndefined();
      expect(created.location).toBeUndefined();
      expect(open.saveOpenAccess).toHaveBeenCalledWith(501, {
        access_mode: 'registration', slug: null, speaker_id: null, presenter: 'host', lead_pipeline_id: 10520038, banner_url: null, ask_profile: true,
      });
      expect(onSave).toHaveBeenCalledWith(CREATED);
    },
  );
});

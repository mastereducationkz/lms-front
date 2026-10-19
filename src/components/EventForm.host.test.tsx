// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ role: 'admin' }));
// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role } }) };
});

const getEventSeries = vi.fn();
const updateEvent = vi.fn();
const getEventHosts = vi.fn();
const STAFF = [
  { id: 2478, name: 'Ислам Зинаэнур', role: 'teacher', has_workspace: true },
  { id: 2568, name: 'Сулеймен Нуриддин', role: 'teacher', has_workspace: true },
  { id: 986, name: 'Абдураимов Азамат', role: 'head_teacher', has_workspace: false },
];
vi.mock('../services/api', () => ({
  getEventSeries: (...a: unknown[]) => getEventSeries(...a),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  getAllGroups: vi.fn().mockResolvedValue([]),
  getCourses: vi.fn().mockResolvedValue([]),
  getCuratorGroups: vi.fn().mockResolvedValue([]),
  getCourseModules: vi.fn().mockResolvedValue([]),
  getModuleLessons: vi.fn().mockResolvedValue([]),
  getEventHosts: (...a: unknown[]) => getEventHosts(...a),
  createEvent: vi.fn(),
  createCuratorEvent: vi.fn(),
}));

// The public-access card has its own tests and talks to the API client, which these form tests never use:
// a marker stands in for it, carrying what the form tells it.
vi.mock('./open-webinars/OpenAccessCard', async () => {
  const { createElement } = await import('react');
  return { default: (p: { eventId: number; hostUnsaved?: boolean }) => createElement('i', { 'data-open-card': p.eventId, 'data-unsaved': String(!!p.hostUnsaved) }) };
});

import EventForm from './EventForm';
import type { Event } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

const webinar = {
  id: 19283, title: 'IELTS Speaking Club', description: 'Weekly IELTS speaking practice.', event_type: 'webinar',
  start_datetime: '2099-01-03T12:00:00Z', end_datetime: '2099-01-03T13:00:00Z', location: 'Google Meet', is_online: true,
  created_by: 1, is_active: true, is_recurring: false, teacher_id: 2478, teacher_name: 'Ислам Зинаэнур',
  group_ids: [], course_ids: [2], participant_count: 0, series_id: 's1',
} as unknown as Event;
const lesson = { ...webinar, id: 5, title: 'Lesson', event_type: 'class', series_id: null, course_ids: [] } as unknown as Event;

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
async function show(ev: Event) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<EventForm event={ev} onSave={() => {}} onCancel={() => {}} />); });
  await settle();
}
beforeEach(() => {
  auth.role = 'admin';
  getEventSeries.mockReset(); updateEvent.mockReset(); getEventHosts.mockReset();
  getEventHosts.mockResolvedValue(STAFF);
  getEventSeries.mockResolvedValue({ series_id: 's1', total: 49, position: 1, following: 49 });
  updateEvent.mockResolvedValue({ ...webinar });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const trigger = () => host.querySelector('#teacher_id') as HTMLButtonElement | null;
const labelFor = () => host.querySelector('label[for="teacher_id"]')?.textContent;

describe('event form: who runs the event', () => {
  it('a webinar has a Host field, with the current host and what no host means', async () => {
    await show(webinar);
    expect(labelFor()).toBe('Host');
    expect(trigger()?.textContent).toContain('Ислам Зинаэнур');
    expect(host.textContent).toContain('Without a host no Meet room is created and no host pay is counted');
  });

  it('asks for the staff list with the current host, and offers every staff member in it', async () => {
    await show(webinar);
    expect(getEventHosts).toHaveBeenCalledWith(2478);
    await act(async () => { trigger()!.click(); });
    const shown = Array.from(document.body.querySelectorAll('[role="option"]')).map((o) => o.textContent ?? '');
    expect(shown).toHaveLength(4); // «no host» + three people
    expect(shown.some((text) => text.includes('Абдураимов Азамат') && text.includes('no Workspace account'))).toBe(true);
  });

  it('the list is searchable by name', async () => {
    await show(webinar);
    await act(async () => { trigger()!.click(); });
    const search = document.body.querySelector('input[role="combobox"]') as HTMLInputElement;
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(search, 'азам');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const shown = Array.from(document.body.querySelectorAll('[role="option"]')).map((o) => o.textContent ?? '');
    expect(shown).toHaveLength(1);
    expect(shown[0]).toContain('Абдураимов Азамат');
  });

  it('warns when the chosen host has no Workspace account, and not before', async () => {
    await show(webinar);
    expect(host.textContent).not.toContain('no Meet room will be created for this event');
    await act(async () => { trigger()!.click(); });
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Абдураимов Азамат'));
    await act(async () => { (option as HTMLElement).click(); });
    expect(host.textContent).toContain('no Meet room will be created for this event');
  });

  it('says so when the staff list cannot be loaded, instead of showing an empty dropdown', async () => {
    getEventHosts.mockRejectedValue(new Error('boom'));
    await show(webinar);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('The list of staff could not be loaded');
  });

  it('the public-access card is for admins editing a webinar, and learns when the host was changed but not saved', async () => {
    await show(webinar);
    const card = () => host.querySelector('[data-open-card]') as HTMLElement | null;
    expect(card()?.getAttribute('data-open-card')).toBe('19283');
    expect(card()?.getAttribute('data-unsaved')).toBe('false');
    await act(async () => { trigger()!.click(); });
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Сулеймен Нуриддин'));
    await act(async () => { (option as HTMLElement).click(); });
    expect(card()?.getAttribute('data-unsaved')).toBe('true');
  });

  it('a head teacher editing the same webinar gets no public-access card (its endpoints are admin-only)', async () => {
    auth.role = 'head_teacher';
    await show(webinar);
    expect(host.querySelector('[data-open-card]')).toBeNull();
  });

  it('a lesson has no public-access card either', async () => {
    await show(lesson);
    expect(host.querySelector('[data-open-card]')).toBeNull();
  });

  it('a class lesson keeps its Teacher field, without the host note', async () => {
    await show(lesson);
    expect(labelFor()).toBe('Assigned Teacher (Optional)');
    expect(host.textContent).not.toContain('Without a host');
  });

  it('changing the host and choosing «this and all following» sends the new host to the whole series', async () => {
    await show(webinar);
    await act(async () => { trigger()!.click(); });
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Сулеймен Нуриддин'));
    expect(option).toBeTruthy();
    await act(async () => { (option as HTMLElement).click(); });
    await act(async () => { (host.querySelectorAll('input[type="radio"]')[1] as HTMLInputElement).click(); });
    await act(async () => { (host.querySelector('button[type="submit"]') as HTMLButtonElement).click(); });
    await settle();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(updateEvent).toHaveBeenCalledWith(19283, { teacher_id: 2568 }, 'following');
  });
});

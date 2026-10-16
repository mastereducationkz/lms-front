// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});

const getEventSeries = vi.fn();
const updateEvent = vi.fn();
vi.mock('../services/api', () => ({
  getEventSeries: (...a: unknown[]) => getEventSeries(...a),
  updateEvent: (...a: unknown[]) => updateEvent(...a),
  getAllGroups: vi.fn().mockResolvedValue([]),
  getCourses: vi.fn().mockResolvedValue([]),
  getCuratorGroups: vi.fn().mockResolvedValue([]),
  getCourseModules: vi.fn().mockResolvedValue([]),
  getModuleLessons: vi.fn().mockResolvedValue([]),
  getUsers: vi.fn().mockResolvedValue([]),
  createEvent: vi.fn(),
  createCuratorEvent: vi.fn(),
}));
vi.mock('@/lib/eventHosts', () => ({
  loadEventHosts: vi.fn().mockResolvedValue([
    { id: 2478, name: 'Ислам Зинаэнур', role: 'teacher' },
    { id: 2568, name: 'Сулеймен Нуриддин', role: 'teacher' },
  ]),
}));

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
  getEventSeries.mockReset(); updateEvent.mockReset();
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

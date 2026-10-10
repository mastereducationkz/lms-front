// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});

const getEventSeries = vi.fn();
const updateEvent = vi.fn();
vi.mock('../../services/api', () => ({
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
    { id: 1911, name: 'Орынбасар Ақжол Ерғалиұлы', role: 'teacher' },
    { id: 2294, name: 'Қайратқызы Дина', role: 'teacher' },
  ]),
}));

import EventForm from '../EventForm';
import { HostTitleSuggestion } from './SeriesEditSection';
import type { Event } from '../../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

const event = {
  id: 33, title: 'NUET Math Office Hours — Akzhol', description: 'Weekly NUET Math office hours.', event_type: 'webinar',
  start_datetime: '2099-01-03T09:00:00Z', end_datetime: '2099-01-03T10:00:00Z', location: 'Google Meet', is_online: true,
  created_by: 1, is_active: true, is_recurring: false, teacher_id: 1911, group_ids: [], course_ids: [78], participant_count: 0, series_id: 's1',
} as unknown as Event;

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
async function show(ev: Event, onSave = vi.fn()) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<EventForm event={ev} onSave={onSave} onCancel={() => {}} />); });
  await settle();
  return onSave;
}
beforeEach(() => {
  getEventSeries.mockReset(); updateEvent.mockReset();
  getEventSeries.mockResolvedValue({ series_id: 's1', total: 50, position: 3, following: 48 });
  updateEvent.mockResolvedValue({ ...event });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const radios = () => Array.from(host.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
const setTitle = async (value: string) => {
  const input = host.querySelector('#title') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
};
const save = async () => {
  const button = Array.from(host.querySelectorAll('button[type="submit"]'))[0] as HTMLButtonElement;
  await act(async () => { button.click(); });
  await settle();
};

describe('edit form: weekly series', () => {
  it('says which week of the series this is and offers this event or the rest', async () => {
    await show(event);
    expect(host.textContent).toContain('Weekly series - event 3 of 50');
    expect(radios().map((r) => r.closest('label')?.textContent)).toEqual(['Only this event', 'This and all 47 following events']);
    expect(getEventSeries).toHaveBeenCalledWith(33);
  });

  it('saves just this event by default, exactly as before', async () => {
    await show(event);
    await setTitle('NUET Math Office Hours — Renamed');
    await save();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    const args = updateEvent.mock.calls[0];
    expect(args[0]).toBe(33);
    expect(args[1]).toMatchObject({ title: 'NUET Math Office Hours — Renamed', course_ids: [78] });
    expect(args[2]).toBeUndefined();
  });

  it('with «this and all following» sends only what changed, and the scope', async () => {
    await show(event);
    await act(async () => { radios()[1].click(); });
    await setTitle('NUET Math Office Hours — Renamed');
    await save();
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(updateEvent).toHaveBeenCalledWith(33, { title: 'NUET Math Office Hours — Renamed' }, 'following');
  });

  it('shows what stays per event when the whole series is chosen', async () => {
    await show(event);
    expect(host.textContent).not.toContain('Groups, courses and the Meet link stay as they are');
    await act(async () => { radios()[1].click(); });
    expect(host.textContent).toContain('Groups, courses and the Meet link stay as they are');
  });

  it('shows no series section for an event that is not in a series, and does not ask the server', async () => {
    await show({ ...event, series_id: null } as Event);
    expect(host.textContent).not.toContain('Weekly series');
    expect(getEventSeries).not.toHaveBeenCalled();
  });

  it('shows no choice on the last occurrence: nothing follows', async () => {
    getEventSeries.mockResolvedValue({ series_id: 's1', total: 50, position: 50, following: 1 });
    await show(event);
    expect(radios()).toHaveLength(0);
  });
});

describe('HostTitleSuggestion', () => {
  it('offers the title with the new host in it, and applies it on a click', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onUse = vi.fn();
    await act(async () => { root!.render(<HostTitleSuggestion title="NUET Math Office Hours — Akzhol" oldHost="Орынбасар Ақжол Ерғалиұлы" newHost="Қайратқызы Дина" onUse={onUse} />); });
    expect(host.textContent).toContain('The title still names the previous host.');
    const use = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Use'))!;
    expect(use.textContent).toContain('NUET Math Office Hours — Дина');
    await act(async () => { use.click(); });
    expect(onUse).toHaveBeenCalledWith('NUET Math Office Hours — Дина');
  });

  it('says nothing when there is nothing to suggest', async () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => { root!.render(<HostTitleSuggestion title="NUET Math Office Hours" oldHost="A B" newHost="C D" onUse={() => {}} />); });
    expect(host.textContent).toBe('');
  });
});

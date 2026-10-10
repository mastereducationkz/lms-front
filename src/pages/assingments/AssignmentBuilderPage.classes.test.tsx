// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() and the page read AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'head_teacher' } }) };
});

const getTeacherGroups = vi.fn();
const getGroupSchedules = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    getTeacherGroups: (...a: unknown[]) => getTeacherGroups(...a),
    getGroupSchedules: (...a: unknown[]) => getGroupSchedules(...a),
    getAssignment: vi.fn(),
  },
}));
// Heavy editors the class picker has nothing to do with.
vi.mock('../../components/assignments/MultiTaskEditor', () => ({ default: () => null }));
vi.mock('../../components/ui/date-time-picker', () => ({ DateTimePicker: () => null }));

import AssignmentBuilderPage from './AssignmentBuilderPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has none of these; the Radix controls on the page ask for them.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};

let root: Root | null = null;
let host: HTMLDivElement;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 50)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={['/homework/new/group/7']}>
        <Routes><Route path="/homework/new/group/:groupId" element={<AssignmentBuilderPage />} /></Routes>
      </MemoryRouter>,
    );
  });
  await settle();
}
const http = (status: number) => Object.assign(new Error('x'), { response: { status } });
const lesson = { id: 41, title: 'Lesson 4', scheduled_at: '2099-01-01T10:00:00Z', lesson_number: 4, is_past: false };

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  getTeacherGroups.mockReset();
  getGroupSchedules.mockReset();
  getTeacherGroups.mockResolvedValue([{ id: 7, name: 'SAT - Group 7', is_active: true, is_over: false, student_count: 3 }]);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const retryButton = () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Try again');

describe('homework builder: «Pick a class»', () => {
  it('asks for four weeks back and the endpoint maximum ahead', async () => {
    getGroupSchedules.mockResolvedValue([lesson]);
    await show();
    expect(getGroupSchedules).toHaveBeenCalledWith(7, 4, 24);
  });

  it('shows the picker when the group has an upcoming class', async () => {
    getGroupSchedules.mockResolvedValue([lesson]);
    await show();
    expect(host.textContent).toContain('Pick a class');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('a refusal is said out loud - the dropdown used to just stay empty', async () => {
    getGroupSchedules.mockRejectedValue(http(403));
    await show();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("don't have access");
    expect(retryButton()).toBeUndefined();
    expect(getGroupSchedules).toHaveBeenCalledTimes(1);
  });

  it('a dropped request is retried by itself and, if it keeps failing, can be retried by hand', async () => {
    getGroupSchedules.mockRejectedValue(http(500));
    await show();
    await act(async () => { await new Promise((r) => setTimeout(r, 800)); });
    expect(getGroupSchedules).toHaveBeenCalledTimes(2);          // the automatic second attempt
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load");

    getGroupSchedules.mockResolvedValue([lesson]);
    await act(async () => { retryButton()!.click(); });
    await settle();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain('Pick a class');
  });

  it('a group whose load failed is asked for again when it is ticked again', async () => {
    getGroupSchedules.mockRejectedValue(http(403));
    await show();
    expect(getGroupSchedules).toHaveBeenCalledTimes(1);
    const box = host.querySelector('#group-7') as HTMLElement;
    await act(async () => { box.click(); });          // untick
    await act(async () => { box.click(); });          // tick again
    await settle();
    expect(getGroupSchedules).toHaveBeenCalledTimes(2);
  });

  it('a group that loaded is not asked for again when it is ticked again', async () => {
    getGroupSchedules.mockResolvedValue([lesson]);
    await show();
    const box = host.querySelector('#group-7') as HTMLElement;
    await act(async () => { box.click(); });
    await act(async () => { box.click(); });
    await settle();
    expect(getGroupSchedules).toHaveBeenCalledTimes(1);
  });

  it('a group with nothing upcoming says so and what to do', async () => {
    getGroupSchedules.mockResolvedValue([{ ...lesson, id: 40, scheduled_at: '2020-01-01T10:00:00Z', is_past: true }]);
    await show();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('No upcoming classes');
  });
});

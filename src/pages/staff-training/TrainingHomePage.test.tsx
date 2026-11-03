// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, task, text, unmount } from '@/components/staff-training/__tests__/kit';
import type { TrainingMe } from '@/services/api/staffTraining';

vi.mock('@/contexts/AuthContext', async () => (await import('@/components/staff-training/__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ getTrainingMe: vi.fn(), getTrainingLibrary: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

import TrainingHomePage from './TrainingHomePage';

const summary = (id: number, key: string, over = {}) => ({
  id, key, title: { ru: `Клип ${id}`, en: `Clip ${id}` }, duration_ms: 90000, platform: 'lms' as const,
  watch_pct: 0, questions_total: 2, questions_passed: 0, ...over,
});

const me = (over: Partial<TrainingMe> = {}): TrainingMe => ({
  user: { id: 12, role: 'curator', ui_locale: 'ru' },
  enrollments: [{ id: 5, kind: 'track', track_id: 2, clip_id: null, source: 'new_hire', required: true, due_at: null, completed_at: null }],
  track: {
    id: 2, role: 'curator', title: { ru: 'Куратор', en: 'Curator' }, version: 3, state: 'in_progress', done_items: 1, total_items: 3, completed_at: null,
    items: [
      { position: 1, kind: 'clip', required: true, done: true, clip: summary(7, 'a', { watch_pct: 100, questions_passed: 2 }) },
      { position: 2, kind: 'clip', required: true, done: false, clip: summary(8, 'b', { watch_pct: 40 }) },
      { position: 3, kind: 'task', required: true, done: false, task: { id: 3, key: 't', platform: 'lms', title: task().title, last_result: null } },
    ],
  },
  assigned_clips: [],
  ...over,
});

const open = () => mount(<MemoryRouter><TrainingHomePage /></MemoryRouter>);
const hrefs = () => Array.from(document.querySelectorAll('li[data-step] a')).map((a) => a.getAttribute('href'));

beforeEach(() => { api.getTrainingMe.mockReset(); api.getTrainingLibrary.mockReset().mockResolvedValue([]); });
afterEach(unmount);

describe('the training home page', () => {
  it('shows the track with its state, how far along it is and where to continue', async () => {
    api.getTrainingMe.mockResolvedValue(me());
    await open();
    expect(text()).toContain('Staff training');
    expect(text()).toContain('Curator');
    expect(document.querySelector('[data-state="in_progress"]')).not.toBeNull();
    expect(text()).toContain('1 of 3 steps done');
    expect(text()).toContain('Required');
    expect(document.querySelector('[data-current="true"]')?.getAttribute('data-step')).toBe('2');
    expect(Array.from(document.querySelectorAll('a')).some((a) => a.getAttribute('href') === '/training/clips/8' && a.textContent?.includes('Continue'))).toBe(true);
  });

  it('never locks a step: every one is a link, including those after an unfinished one (D10)', async () => {
    api.getTrainingMe.mockResolvedValue(me());
    await open();
    expect(hrefs()).toEqual(['/training/clips/7', '/training/clips/8', '/training/tasks/3']);
    expect(document.querySelector('[data-not-blocking]')?.textContent).toContain('Nothing here blocks your work');
  });

  it('shows the library for someone with no track, and what was assigned to them', async () => {
    api.getTrainingMe.mockResolvedValue(me({
      track: null, enrollments: [],
      assigned_clips: [{ clip: summary(9, 'c'), done: false, due_at: null, required: true, enrollment_id: 91 }],
    }));
    api.getTrainingLibrary.mockResolvedValue([
      { id: 2, role: 'curator', title: { ru: 'Куратор', en: 'Curator' }, items: [{ position: 1, kind: 'clip', required: true, clip: summary(7, 'a') }] },
    ]);
    await open();
    expect(text()).toContain('You don’t have a track of your own');
    expect(text()).toContain('Assigned to you');
    expect(text()).toContain('Clip 9');
    expect(text()).toContain('Library');
    expect(text()).toContain('Clip 7');
  });

  it('offers the progress pages to a head and not to a curator', async () => {
    api.getTrainingMe.mockResolvedValue(me());
    await open();
    expect(Array.from(document.querySelectorAll('a')).some((a) => a.getAttribute('href') === '/training/progress')).toBe(false);
  });

  it('shows a finished track as finished', async () => {
    const done = me();
    done.track = { ...done.track!, state: 'done', done_items: 3, completed_at: '2026-11-03T10:00:00Z', items: done.track!.items.map((i) => ({ ...i, done: true })) };
    api.getTrainingMe.mockResolvedValue(done);
    await open();
    expect(document.querySelector('[data-state="done"]')).not.toBeNull();
    expect(text()).toContain('You finished this track');
  });
});

describe('the training home page while the feature is off', () => {
  it('says so instead of calling it a failure (the server answers 404 until it is switched on)', async () => {
    api.getTrainingMe.mockRejectedValue(Object.assign(new Error('x'), { cause: { response: { status: 404 } } }));
    await open();
    expect(text()).toContain('not switched on yet');
    expect(text()).not.toContain('Couldn’t load');
  });
});

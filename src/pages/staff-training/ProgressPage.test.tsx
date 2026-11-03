// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pickValue } from '@/test/dropdown';
import { click, mount, settle, text, unmount } from '@/components/staff-training/__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('@/components/staff-training/__tests__/kit')).authMock('head_curator'));
const api = vi.hoisted(() => ({ getTrainingProgress: vi.fn(), getTrainingLibrary: vi.fn(), assignTraining: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

import ProgressPage from './ProgressPage';

const person = (id: number, name: string, state: string, over = {}) => ({
  user: { id, name, email: `${name.toLowerCase()}@example.com`, role: 'curator', created_at: '2026-10-20T00:00:00Z' },
  required: true, state, done_items: 0, total_items: 19, current_item: null, last_active_at: null, completed_at: null, ...over,
});

const LIST = {
  rows: [
    person(1, 'Dana', 'done', { done_items: 19, completed_at: '2026-11-01T00:00:00Z', last_active_at: '2026-11-01T09:00:00Z' }),
    person(2, 'Erlan', 'stuck', {
      done_items: 4, last_active_at: '2026-10-28T09:00:00Z',
      current_item: { kind: 'task', title: { ru: 'Отметьте посещаемость', en: 'Mark attendance' }, failed_attempts: 6 },
    }),
    person(3, 'Farida', 'not_started'),
  ],
  counts: { done: 1, in_progress: 0, stuck: 1, not_started: 1 },
};
const LIBRARY = [{ id: 2, role: 'curator', title: { ru: 'Куратор', en: 'Curator' }, items: [
  { position: 1, kind: 'clip', required: true, clip: { id: 7, key: 'a', title: { ru: 'Клип', en: 'Mark a late student' }, duration_ms: 90000, platform: 'lms' } },
] }];

const open = () => mount(<MemoryRouter><ProgressPage /></MemoryRouter>);
const rowsOf = (state: string) => document.querySelectorAll(`[data-person][data-state="${state}"]`).length;

beforeEach(() => {
  api.getTrainingProgress.mockReset().mockResolvedValue(LIST);
  api.getTrainingLibrary.mockReset().mockResolvedValue(LIBRARY);
  api.assignTraining.mockReset().mockResolvedValue({ created: 2, skipped_existing: 0 });
});
afterEach(unmount);

describe('the progress page', () => {
  it('tells a done, a stuck and an untouched person apart, and says which step the stuck one is on', async () => {
    await open();
    // the page draws a table and a card list; the container query shows one of them
    expect(rowsOf('done')).toBe(2);
    expect(rowsOf('stuck')).toBe(2);
    expect(rowsOf('not_started')).toBe(2);
    expect(text()).toContain('Mark attendance');
    expect(text()).toContain('6 failed attempts');
    expect(text()).toContain('4 / 19');
    expect(text()).toContain('No activity yet');
    const counts = Object.fromEntries(Array.from(document.querySelectorAll('[data-count]')).map((b) => [b.getAttribute('data-count'), b.textContent]));
    expect(counts.stuck).toContain('1');
    expect(document.querySelector('a[href="/training/progress/2"]')).not.toBeNull();
  });

  it('only offers the roles this head may see, and sends the filter to the server', async () => {
    await open();
    await pickValue('#st-filter-role', 'head_curator');
    await settle();
    expect(api.getTrainingProgress).toHaveBeenLastCalledWith({ role: 'head_curator', state: undefined, required: undefined });
    await click(document.querySelector('[data-count="stuck"]'));
    await settle();
    expect(api.getTrainingProgress).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'stuck' }));
  });

  it('assigns videos to the people ticked, as optional or required, with a date that blocks nothing', async () => {
    await open();
    const boxes = (name: string) => Array.from(document.querySelectorAll(`input[aria-label="Select ${name}"]`)) as HTMLInputElement[];
    await click(boxes('Erlan')[0]);
    await click(boxes('Farida')[0]);
    expect(text()).toContain('2 people selected');
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Assign…')!);
    await settle();
    await click(document.querySelector('input[data-clip="7"]'));
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Assign')!);
    await settle();
    expect(api.assignTraining).toHaveBeenCalledWith({ user_ids: [2, 3], track_id: null, clip_ids: [7], required: true, due_at: null });
  });

  it('refuses an empty assignment instead of sending it', async () => {
    await open();
    await click((Array.from(document.querySelectorAll('input[aria-label="Select Dana"]'))[0]) as HTMLElement);
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Assign…')!);
    await settle();
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Assign')!);
    expect(api.assignTraining).not.toHaveBeenCalled();
    expect(text()).toContain('Pick at least one video');
  });

  it('says so when nobody matches', async () => {
    api.getTrainingProgress.mockResolvedValue({ rows: [], counts: { done: 0, in_progress: 0, stuck: 0, not_started: 0 } });
    await open();
    expect(text()).toContain('Nobody matches these filters.');
  });
});

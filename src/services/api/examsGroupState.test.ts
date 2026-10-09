import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

import { exportExamResults, getBluebookGroups, getExamGroups, getExamResults } from './exams';

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: [] });
});

const paramsOfLastCall = () => (get.mock.calls[get.mock.calls.length - 1][1] as { params: Record<string, unknown> }).params;

describe('group state on the exam calls', () => {
  it('the results list sends it', async () => {
    await getExamResults({ examType: 'sat', groupState: 'finished' });
    expect(paramsOfLastCall()).toMatchObject({ group_state: 'finished' });
  });

  it('the export sends the same filter as the screen', async () => {
    await exportExamResults({ examType: 'sat', groupState: 'all' });
    expect(paramsOfLastCall()).toMatchObject({ group_state: 'all' });
  });

  it('sends nothing when no state was chosen, so the server applies the role default', async () => {
    await getExamResults({ examType: 'sat' });
    expect(paramsOfLastCall()).not.toHaveProperty('group_state');
  });

  it('the exam group picker sends it', async () => {
    await getExamGroups({ program: 'sat', groupState: 'finished' });
    expect(paramsOfLastCall()).toMatchObject({ program: 'sat', group_state: 'finished' });
  });

  it('the Bluebook group picker sends it, with or without a search', async () => {
    await getBluebookGroups('dan', 'all');
    expect(paramsOfLastCall()).toEqual({ search: 'dan', group_state: 'all' });
    await getBluebookGroups(undefined, 'running');
    expect(paramsOfLastCall()).toEqual({ group_state: 'running' });
    await getBluebookGroups();
    expect(paramsOfLastCall()).toEqual({});
  });
});

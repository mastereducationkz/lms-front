import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { getEventHosts } from './events';

/**
 * The form's host list used to be read from `/admin/users`, which answers `{users, total}`; the loader
 * expected an array, its tests mocked an array, and the dropdown stayed empty for months. This one pins
 * the real contract: the endpoint's own URL, and its answer handed over as it is.
 */
describe('getEventHosts', () => {
  // Braces: vitest runs a function returned from beforeEach as a teardown, and `get` is one.
  beforeEach(() => { get.mockReset(); });

  it('reads /event-hosts and returns the list as the server sent it', async () => {
    const staff = [{ id: 7, name: 'Aigerim', role: 'teacher', has_workspace: true }];
    get.mockResolvedValue({ data: staff });
    await expect(getEventHosts()).resolves.toEqual(staff);
    expect(get).toHaveBeenCalledWith('/event-hosts', { params: undefined });
  });

  it('sends the current host so an edit keeps them in the list', async () => {
    get.mockResolvedValue({ data: [] });
    await getEventHosts(2478);
    expect(get).toHaveBeenCalledWith('/event-hosts', { params: { include_id: 2478 } });
  });

  it('turns a failure into an error the form can show', async () => {
    get.mockRejectedValue({ response: { status: 500, data: {} } });
    await expect(getEventHosts()).rejects.toThrow('Failed to load the list of hosts');
  });
});

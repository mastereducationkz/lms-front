import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ api: { get } }));

import { listAnnotations } from './annotations';

beforeEach(() => get.mockReset());

describe('listAnnotations', () => {
  it('retries a timed-out read once without using the cache', async () => {
    const result = { attempt_no: 1, annotations: [] };
    get.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    get.mockResolvedValueOnce({ data: result });

    await expect(listAnnotations('quiz', 42)).resolves.toEqual(result);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith('/annotations', {
      params: { surface: 'quiz', target_id: 42, attempt: 'current' },
      cache: false,
      timeout: 10000,
    });
  });

  it('does not retry a server response error', async () => {
    const error = Object.assign(new Error('denied'), { code: 'ERR_BAD_RESPONSE' });
    get.mockRejectedValueOnce(error);
    await expect(listAnnotations('lesson', 42)).rejects.toBe(error);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

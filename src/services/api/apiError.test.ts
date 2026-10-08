import { describe, expect, it } from 'vitest';
import { apiError } from './apiError';

describe('apiError', () => {
  it("uses the server's detail as the message and keeps the original error as the cause", () => {
    const axiosFailure = { isAxiosError: true, response: { status: 409, data: { detail: 'Already a favorite' } } };
    const error = apiError(axiosFailure, 'Failed to add flashcard to favorites');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Already a favorite');
    expect((error as Error & { cause?: unknown }).cause).toBe(axiosFailure);
  });

  it('falls back when the call got no answer or the answer has no detail', () => {
    expect(apiError({ isAxiosError: true, code: 'ERR_NETWORK' }, 'Failed to load').message).toBe('Failed to load');
    expect(apiError({ response: { status: 500, data: {} } }, 'Failed to load').message).toBe('Failed to load');
  });

  it('survives a thrown value that is not an axios error', () => {
    expect(apiError(undefined, 'Failed to load').message).toBe('Failed to load');
    expect(apiError(null, 'Failed to load').message).toBe('Failed to load');
  });
});

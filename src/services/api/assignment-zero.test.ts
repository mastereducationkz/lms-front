import { describe, it, expect, vi } from 'vitest';

// `./client` touches `document`/`localStorage` at module scope (cookie-backed auth
// state), which don't exist under vitest's node environment. Mock it out so this
// file can exercise `revealCollegeBoardPassword` without ever loading the real
// client.
vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import { api } from './client';
import { revealCollegeBoardPassword } from './assignment-zero';
import type { AssignmentZeroSubmission, AssignmentZeroSubmitData } from '../../types';

const post = api.post as unknown as ReturnType<typeof vi.fn>;

describe('revealCollegeBoardPassword', () => {
  it('POSTs to /assignment-zero/{user_id}/college-board-password with no body', async () => {
    post.mockResolvedValueOnce({ data: { college_board_password: 'sekret-value' } });

    const value = await revealCollegeBoardPassword(42);

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/assignment-zero/42/college-board-password');
    expect(value).toBe('sekret-value');
  });

  it('propagates the raw axios error so callers can branch on response.status', async () => {
    const axiosError = { response: { status: 404 } };
    post.mockRejectedValueOnce(axiosError);

    await expect(revealCollegeBoardPassword(42)).rejects.toBe(axiosError);
  });
});

describe('response types no longer carry the plaintext (compile-time check)', () => {
  // These assignments only need to type-check: `tsc --noEmit` fails the whole
  // suite if `college_board_password` is ever reintroduced as a valid key of
  // either response shape.
  it('AssignmentZeroSubmission has no college_board_password key', () => {
    type NoPasswordKey = 'college_board_password' extends keyof AssignmentZeroSubmission ? never : true;
    const check: NoPasswordKey = true;
    expect(check).toBe(true);
  });

  it('AssignmentZeroSubmitData has no college_board_password key', () => {
    type NoPasswordKey = 'college_board_password' extends keyof AssignmentZeroSubmitData ? never : true;
    const check: NoPasswordKey = true;
    expect(check).toBe(true);
  });
});

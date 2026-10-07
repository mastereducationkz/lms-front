import { describe, expect, it, vi } from 'vitest';

// The real deps touch cookies and the socket at import; the flow is tested with its own.
vi.mock('./api/client', () => ({ tokenManager: {} }));
vi.mock('./socket', () => ({ adoptSocketToken: vi.fn(), getSocket: () => null }));

import { signOutOtherDevices, type SignOutOthersDeps } from './sessions';

function deps(over: Partial<SignOutOthersDeps> = {}): SignOutOthersDeps {
  return {
    refreshToken: () => 'old-refresh',
    socketId: () => 'sock-123',
    revoke: vi.fn(async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', revoked_sessions: 3 })),
    store: vi.fn(),
    adoptSocket: vi.fn(),
    ...over,
  };
}

describe('signOutOtherDevices', () => {
  it('names this device (refresh token + socket), then keeps it signed in with the new tokens', async () => {
    const d = deps();
    expect(await signOutOtherDevices(d)).toBe(3);
    expect(d.revoke).toHaveBeenCalledWith('old-refresh', 'sock-123');
    expect(d.store).toHaveBeenCalledWith('new-access', 'new-refresh');
    expect(d.adoptSocket).toHaveBeenCalledWith('new-access');
  });

  it('a refusal changes nothing on this device', async () => {
    const d = deps({ revoke: vi.fn(async () => Promise.reject(new Error('401'))) });
    await expect(signOutOtherDevices(d)).rejects.toThrow('401');
    expect(d.store).not.toHaveBeenCalled();
    expect(d.adoptSocket).not.toHaveBeenCalled();
  });
});

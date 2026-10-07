/**
 * «Sign out other devices» (owner Q18, 2026-10-07): every other session ends at once, this one
 * stays. The server keeps this device's refresh chain and its live socket and returns new
 * tokens; they replace the old ones here, or this device would be the next one signed out.
 */
import { tokenManager } from './api/client';
import { revokeOtherSessions } from './api/notificationCenter';
import { adoptSocketToken, getSocket } from './socket';

export interface SignOutOthersDeps {
  refreshToken(): string | null;
  socketId(): string | null;
  revoke: typeof revokeOtherSessions;
  store(access: string, refresh: string): void;
  adoptSocket(access: string): void;
}

const browserDeps: SignOutOthersDeps = {
  refreshToken: () => tokenManager.getRefreshToken() || null,
  socketId: () => getSocket()?.id ?? null,
  revoke: revokeOtherSessions,
  store: (access, refresh) => tokenManager.setTokens(access, refresh),
  adoptSocket: adoptSocketToken,
};

/** How many other sessions ended. Throws when the server refused (nothing changes here then). */
export async function signOutOtherDevices(deps: SignOutOthersDeps = browserDeps): Promise<number> {
  const result = await deps.revoke(deps.refreshToken(), deps.socketId());
  deps.store(result.access_token, result.refresh_token);
  deps.adoptSocket(result.access_token);
  return result.revoked_sessions;
}

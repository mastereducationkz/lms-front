import { api } from './client';

export type HandoffPlatform = 'ielts' | 'sat';

export interface HandoffLink {
  url: string;
  expires_in: number;
}

/**
 * Mint a 60-second signed handoff link to `returnTo` on a sibling platform
 * (Platform Integration Pack §3). Throws on any failure (flag off → 503, parent → 403,
 * path not allowed → 403/400, rate limit → 429); callers fall back to the bare host.
 */
export async function mintHandoff(platform: HandoffPlatform, returnTo: string): Promise<HandoffLink> {
  const response = await api.post('/handoff/mint', { platform, return_to: returnTo });
  return response.data as HandoffLink;
}

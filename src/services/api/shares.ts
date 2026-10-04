/**
 * «Share achievement» (owner, 2026-10-04): share links (snapshots of a card), the counters, the
 * student's crowns, and the staff share stats (backend `src/achievements/shares`).
 */
import { api } from './client';
import type { NameMode, ShareKind, ShareMethod } from '@/components/share/shareCopy';

export interface ShareLink {
  slug: string;
  url: string;
  kind: ShareKind;
  ref: string;
  title: string | null;
  name_mode: NameMode;
  created_at: string;
  expires_at: string;
  revoked: boolean;
  live: boolean;
  views: number;
  shares: Record<ShareMethod, number>;
}

export interface Crown {
  event_id: number;
  lesson_title: string | null;
  lesson_date: string | null;
  crowned_at: string | null;
}

export interface ShareStats {
  totals: { shares: number; views: number; links?: number; by_method: Record<ShareMethod, number> };
  by_kind: Record<ShareKind, { shares: number; views: number; by_method: Record<ShareMethod, number> }>;
  by_achievement: { key: string; shares: number; views: number }[];
  last_30_days: { date: string; shares: number; views: number }[];
}

function reason(error: unknown, fallback: string): Error {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return new Error(typeof detail === 'string' && detail ? detail : fallback);
}

export async function getMyCrowns(): Promise<Crown[]> {
  const response = await api.get('/achievements/me/crowns', { cache: false } as never);
  const crowns = (response?.data as { crowns?: unknown })?.crowns;
  return Array.isArray(crowns) ? (crowns as Crown[]) : [];
}

/** Uploads the card the device drew and gets a share link (the server checks it was earned). */
export async function createShare(body: { kind: ShareKind; ref: string; nameMode: NameMode; image: Blob }): Promise<ShareLink> {
  const form = new FormData();
  form.append('kind', body.kind);
  form.append('ref', body.ref);
  form.append('name_mode', body.nameMode);
  form.append('image', body.image, body.image.type === 'image/png' ? 'card.png' : 'card.jpg');
  try {
    // A 1–2 MB card on a slow phone connection outlasts the client's 20 s default.
    const response = await api.post('/achievements/shares', form, { timeout: 60000 });
    return response.data as ShareLink;
  } catch (error) {
    throw reason(error, 'Could not create the share link');
  }
}

/** Counts one share. Fire-and-forget: a lost count never bothers the student. */
export function trackShare(slug: string, method: ShareMethod): void {
  api.post(`/achievements/shares/${encodeURIComponent(slug)}/track`, { method }).catch(() => undefined);
}

export async function getMyShares(): Promise<ShareLink[]> {
  const response = await api.get('/achievements/shares/mine', { cache: false } as never);
  const shares = (response?.data as { shares?: unknown })?.shares;
  return Array.isArray(shares) ? (shares as ShareLink[]) : [];
}

export async function revokeShare(slug: string): Promise<ShareLink> {
  try {
    const response = await api.delete(`/achievements/shares/${encodeURIComponent(slug)}`);
    return response.data as ShareLink;
  } catch (error) {
    throw reason(error, 'Could not turn off the link');
  }
}

export async function getShareStats(): Promise<ShareStats> {
  const response = await api.get('/achievements/shares/stats', { cache: false } as never);
  return response.data as ShareStats;
}

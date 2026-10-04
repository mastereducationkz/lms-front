/**
 * «Share achievement» (owner, 2026-10-04): the student's crowns, counting a share, and the staff
 * share stats (backend `src/achievements/shares`). Cards never leave the device; only counts do.
 */
import { api } from './client';
import type { ShareKind, ShareMethod } from '@/components/share/shareCopy';

export interface Crown {
  event_id: number;
  lesson_title: string | null;
  lesson_date: string | null;
  crowned_at: string | null;
}

export interface ShareStats {
  totals: { shares: number; by_method: Record<ShareMethod, number> };
  by_kind: Record<ShareKind, { shares: number; by_method: Record<ShareMethod, number> }>;
  by_achievement: { key: string; shares: number }[];
  last_30_days: { date: string; shares: number }[];
}

export async function getMyCrowns(): Promise<Crown[]> {
  const response = await api.get('/achievements/me/crowns', { cache: false } as never);
  const crowns = (response?.data as { crowns?: unknown })?.crowns;
  return Array.isArray(crowns) ? (crowns as Crown[]) : [];
}

/** Counts one share. Fire-and-forget: a lost count never bothers the student. */
export function trackShare(kind: ShareKind, ref: string, method: ShareMethod): void {
  api.post('/achievements/shares/events', { kind, ref, method }).catch(() => undefined);
}

export async function getShareStats(): Promise<ShareStats> {
  const response = await api.get('/achievements/shares/stats', { cache: false } as never);
  return response.data as ShareStats;
}

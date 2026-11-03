import '@/lib/i18n/catalogs/staffTraining';
import type { Locale } from '@/lib/i18n';
import type { TFunction } from '@/lib/i18n';
import { reasonCodeOf } from '@/services/api/apiError';
import type { TrackItem, TrainingState } from '@/services/api/staffTraining';

/** The text in the reader's language; the other language when that one is empty, so a gap never shows as a blank. */
export function pick(text: { ru?: string | null; en?: string | null } | null | undefined, locale: Locale): string {
  if (!text) return '';
  const other: Locale = locale === 'ru' ? 'en' : 'ru';
  return text[locale] || text[other] || '';
}

/** 104000 → "1:44", the way the video's own clock reads. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const STATES: readonly TrainingState[] = ['not_started', 'in_progress', 'stuck', 'done'];

/** Staff roles an admin can see in the progress filters, and which of them a head sees (CONTRACTS §6.2). */
export const ROLES_BY_VIEWER: Record<string, readonly string[]> = {
  admin: ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing'],
  head_curator: ['curator', 'head_curator'],
  head_teacher: ['teacher', 'head_teacher'],
};

export const STAFF_ROLES = ['admin', 'teacher', 'head_teacher', 'curator', 'head_curator', 'marketing'] as const;
export const PROGRESS_ROLES = ['admin', 'head_curator', 'head_teacher'] as const;

export const itemId = (item: TrackItem): number => (item.kind === 'clip' ? item.clip?.id : item.task?.id) ?? 0;
export const itemPath = (kind: 'clip' | 'task', id: number): string => (kind === 'clip' ? `/training/clips/${id}` : `/training/tasks/${id}`);

/** The first required step not done yet (else the first not done): where «Continue» goes. Nothing is ever locked behind it. */
export function currentItem(items: TrackItem[]): TrackItem | null {
  return items.find((i) => !i.done && i.required) ?? items.find((i) => !i.done) ?? null;
}

/** The HTTP status behind an error thrown by an API wrapper (the AxiosError sits in `cause`), or null. */
export function statusOf(error: unknown): number | null {
  const status = (error as { cause?: { response?: { status?: unknown } } } | null)?.cause?.response?.status;
  return typeof status === 'number' ? status : null;
}

/** What a person reads when a call failed: the server's sentence for a coded refusal (already in their language), else the generic one. */
export function errorText(error: unknown, t: TFunction, fallback: 'staffTraining.loadFailed' | 'staffTraining.saveFailed' = 'staffTraining.saveFailed'): string {
  return reasonCodeOf(error) && error instanceof Error && error.message ? error.message : t(fallback);
}

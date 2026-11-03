import type { AnswerCitation, SearchDocument, SearchMoment } from '@/services/api/staffTrainingSearch';

/** Where a moment of a clip opens: the player starts at that second (`?t=`). A title chunk has no time: the clip's start. */
export function clipLink(clipId: number, startMs: number | null | undefined): string {
  const base = `/training/clips/${clipId}`;
  return startMs && startMs > 0 ? `${base}?t=${Math.floor(startMs / 1000)}` : base;
}

export const taskLink = (taskId: number): string => `/training/tasks/${taskId}`;

/** An address worth a real link: http(s) or an absolute path on this site. Anything else (javascript:, data:) is dropped. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : null;
}

/** The in-app route for a document's moment, or null for a handbook (which opens its own address). */
export function momentLink(doc: SearchDocument, moment: SearchMoment): string | null {
  if (doc.kind === 'clip') return clipLink(doc.clip_id, moment.start_ms);
  if (doc.kind === 'task') return taskLink(doc.task_id);
  return null;
}

export function citationLink(c: AnswerCitation): { to: string | null; href: string | null } {
  if (c.kind === 'clip' && c.clip_id != null) return { to: clipLink(c.clip_id, c.start_ms), href: null };
  if (c.kind === 'task' && c.task_id != null) return { to: taskLink(c.task_id), href: null };
  return { to: null, href: safeUrl(c.url) };
}

/** Three words or more is a question worth an automatic answer; shorter ones get a button. */
export const wantsAutoAnswer = (query: string): boolean => query.trim().split(/\s+/).filter(Boolean).length >= 3;

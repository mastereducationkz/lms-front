/**
 * A lesson's recording on the calendar (2026-09-15): which mark a lesson gets, and which lessons are
 * worth asking the server about while a day is open. The calendar's own summary is cached and says
 * only ready / pending / failed / removed — enough for a mark in any view. The live stage and percent
 * come from `GET /recordings/status`, asked for the lessons on screen only, never for a month.
 */
import type { Event } from '../types';
import type { RecordingStatusEntry } from '../services/api/recordings';
import { badgeText, pollInterval, progressFor } from './recordingProgress';
import type { Locale } from './recordings';

/** Who sees a recording that is not watchable yet — as in the library, students see only finished ones. */
const STAFF = new Set(['admin', 'head_curator', 'head_teacher', 'teacher', 'curator']);

export function seesRecordingProgress(role?: string | null): boolean {
  return STAFF.has(role ?? '');
}

/** How long after a lesson its recording can still arrive before it is flagged missing (the server's grace). */
export const RECORDING_GRACE_MS = 6 * 60 * 60 * 1000;

export type RecordingMarkKind = 'ready' | 'processing' | 'waiting' | 'failed' | 'removed';

export interface RecordingMarkInfo {
  kind: RecordingMarkKind;
  /** The tooltip and the accessible name. */
  label: string;
}

const MARK_TEXT: Record<Locale, Record<RecordingMarkKind, string>> = {
  en: {
    ready: 'Recorded',
    processing: 'Recording is being prepared',
    waiting: 'Waiting for the recording',
    failed: 'Recording could not be processed',
    removed: 'Recording no longer available',
  },
  ru: {
    ready: 'Есть запись',
    processing: 'Запись готовится',
    waiting: 'Ждём запись',
    failed: 'Запись не обработалась',
    removed: 'Запись больше недоступна',
  },
};

/**
 * The mark beside a lesson: from the live status when the day is open and the viewer is staff,
 * else from the calendar's summary. Everyone sees «recorded»; the stages before it are staff-only.
 */
export function recordingMark(
  event: Event,
  role: string | null | undefined,
  live?: RecordingStatusEntry | null,
  locale: Locale = 'en',
): RecordingMarkInfo | null {
  if (event.event_type !== 'class') return null;
  const staff = seesRecordingProgress(role);
  const status = live && staff ? live.status : event.recording?.status;
  if (!status || status === 'missing') return null;
  if (status === 'ready') return { kind: 'ready', label: MARK_TEXT[locale].ready };
  if (!staff) return null;
  const kind: RecordingMarkKind = status === 'pending' ? 'processing' : status === 'waiting' ? 'waiting' : status;
  const progress = live?.progress ? progressFor(status, live.progress) : null;
  return { kind, label: progress ? badgeText(progress, locale) : MARK_TEXT[locale][kind] };
}

/**
 * The lessons of an open day worth asking about: a class whose recording is being prepared, or one
 * that has ended within the grace with a Meet room and no recording yet — its recording may be on
 * its way. Staff only, one request's worth. Ready, failed and removed recordings need no asking.
 */
export function liveRecordingIds(events: Event[], role: string | null | undefined, now: number, limit = 48): number[] {
  if (!seesRecordingProgress(role)) return [];
  return events
    .filter((event) => {
      if (event.event_type !== 'class') return false;
      const end = new Date(event.end_datetime).getTime();
      if (!Number.isFinite(end) || end > now) return false;
      const status = event.recording?.status;
      if (status === 'pending') return true;
      return !status && !!event.meeting_url && now - end <= RECORDING_GRACE_MS;
    })
    .slice(0, limit)
    .map((event) => event.id);
}

/**
 * When to ask again: at the pace of the busiest lesson still on its way, or null once none is.
 * A lesson absent from the answers is not the viewer's to see, or has no recording coming.
 */
export function nextRecordingPoll(ids: number[], entries: Record<string, RecordingStatusEntry>): number | null {
  const intervals = ids
    .map((id) => entries[String(id)])
    .map((entry) => (entry ? pollInterval(progressFor(entry.status, entry.progress)) : null))
    .filter((ms): ms is number => ms != null);
  return intervals.length ? Math.min(...intervals) : null;
}

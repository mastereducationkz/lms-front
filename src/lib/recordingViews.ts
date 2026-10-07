/**
 * Recording views (owner, 2026-09-28): does anybody watch the lesson recordings?
 *
 * The player keeps a small meter of one playback session — seconds actually played, the furthest
 * point reached, whether the server has counted the session yet — and reports it every 30 s while it
 * plays and on pause, end and close (see `useRecordingViewTracker`). Never per second. Pure functions
 * here; the hook owns the video element and the network.
 *
 * Staff read the result as one line per library card and one school figure above the library.
 * Students see nothing new.
 */
import { activeLocale, formatDate, t, type Locale } from './i18n';

/** How often a playing video reports. */
export const HEARTBEAT_MS = 30_000;
/** A playhead step longer than this is a seek, not watching. `timeupdate` fires about four times a
 * second; at 2× speed a step is ~0.5 s, and a throttled background tab still stays well under this. */
export const MAX_STEP_SECONDS = 3;

export interface WatchMeter {
  /** The playhead at the last reading while playing; null after a seek or a pause. */
  last: number | null;
  /** Seconds played and not yet reported. */
  unsent: number;
  /** The furthest point reached while playing. */
  furthest: number;
  /** The server has counted this session as a view. */
  counted: boolean;
}

/** What one heartbeat sends: `POST /recordings/{event_id}/view-progress`. */
export interface ViewReport {
  watched_seconds: number;
  position_seconds: number;
  new_view: boolean;
}

export function newMeter(): WatchMeter {
  return { last: null, unsent: 0, furthest: 0, counted: false };
}

/**
 * A reading of the playhead. While playing, a short forward step is watching and adds up; a jump
 * or a step back is a seek and only moves the mark. While paused nothing adds up.
 */
export function advance(meter: WatchMeter, time: number, playing: boolean): WatchMeter {
  if (!Number.isFinite(time) || time < 0) return meter;
  if (!playing) return { ...meter, last: null };
  const step = meter.last == null ? 0 : time - meter.last;
  const played = step > 0 && step <= MAX_STEP_SECONDS ? step : 0;
  return { ...meter, last: time, unsent: meter.unsent + played, furthest: Math.max(meter.furthest, time) };
}

/** The viewer is seeking: the next reading starts a new stretch rather than counting the jump. */
export function seeking(meter: WatchMeter): WatchMeter {
  return { ...meter, last: null };
}

/**
 * The report to send now, and the meter as it stands once it is sent — or null while less than a
 * whole second has played since the last one. Whole seconds only; the fraction waits for the next.
 */
export function takeReport(meter: WatchMeter): { meter: WatchMeter; report: ViewReport } | null {
  const seconds = Math.floor(meter.unsent);
  if (seconds < 1) return null;
  return {
    meter: { ...meter, unsent: meter.unsent - seconds, counted: true },
    report: { watched_seconds: seconds, position_seconds: Math.floor(meter.furthest), new_view: !meter.counted },
  };
}

/** A report that did not arrive: its seconds, and the view it would have counted, go back. */
export function giveBack(meter: WatchMeter, report: ViewReport): WatchMeter {
  return {
    ...meter,
    unsent: meter.unsent + report.watched_seconds,
    counted: report.new_view ? false : meter.counted,
  };
}

// ── what staff read ──────────────────────────────────────────────────────────────────────────

/** One recording's line: of its `students`, `watched` played at least a minute; of the `absent`,
 * `absent_watched` did. Present on library cards for staff only. */
export interface RecordingViewStats {
  students: number;
  watched: number;
  absent: number;
  absent_watched: number;
}

/** The school figure: `GET /recordings/view-summary`. */
export interface RecordingViewSummary {
  since: string | null;
  window_days: number;
  period_days: number;
  absent: number;
  watched: number;
  share: number | null;
  pending_absent: number;
  pending_watched: number;
}

/** "Watched by 5 of 12 · missed it: 3 of 4" — or null for a lesson with no students to count. */
export function viewsLine(stats: RecordingViewStats | null | undefined, locale: Locale = activeLocale()): string | null {
  if (!stats || stats.students <= 0) return null;
  const parts: string[] = [t('recordings.views.watched', { watched: stats.watched, students: stats.students }, locale)];
  if (stats.absent > 0) parts.push(t('recordings.views.absent', { watched: stats.absent_watched, absent: stats.absent }, locale));
  return parts.join(' · ');
}

export function viewsHint(locale: Locale = activeLocale()): string {
  return t('recordings.views.hint', undefined, locale);
}

export function summaryHint(locale: Locale = activeLocale()): string {
  return t('recordings.views.summaryHint', undefined, locale);
}

/** "8 Sep" / "8.09" — Russian staff read the short numeric day. */
function day(iso: string, locale: Locale): string {
  return formatDate(iso, { day: 'numeric', month: locale === 'ru' ? '2-digit' : 'short' }, locale);
}

/** The school figure in one sentence — the 7-day share once a week has run out, what has been
 * watched so far before that, or only since when views are counted; null before any view at all. */
export function summaryLine(summary: RecordingViewSummary | null | undefined, locale: Locale = activeLocale()): string | null {
  if (!summary?.since) return null;
  if (summary.absent > 0 && summary.share != null) {
    return t('recordings.views.figure', {
      percent: Math.round(summary.share * 100), watched: summary.watched, absent: summary.absent,
      days: summary.window_days, period: summary.period_days,
    }, locale);
  }
  const since = day(summary.since, locale);
  if (summary.pending_absent > 0) {
    return t('recordings.views.soFar', { since, watched: summary.pending_watched, absent: summary.pending_absent }, locale);
  }
  return t('recordings.views.since', { since }, locale);
}

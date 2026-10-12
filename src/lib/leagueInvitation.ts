/**
 * The Master League invitation page's pure rules (owner, 2026-10-13): which scene a state gets, how
 * long is left, how a squad's schedule reads in the student's language. No React, no
 * requests: tested in leagueInvitation.test.ts. The server decides every state
 * (lms-backend src/master_league/invitations.py); this file only words them.
 */
import { activeLocale, formatDate, t, type Locale } from './i18n';
import { groupTail, kickoffLabel } from './leagueSeason';
import { localizeSchedule, scheduleChips } from './leagueSchedule';
import type { InvitationOption, LeagueInvitation } from '../services/api/leagueInvitation';
import '@/lib/i18n/catalogs/studentHome';

export { localizeSchedule, scheduleChips };

export { invitationNotificationPath, LEAGUE_INVITATION_NOTIFICATION_TYPES, LEAGUE_INVITATION_PATH } from './leagueInvitationPaths';

const MIN_MS = 60 * 1000;
/** A student who accepted is re-checked this often until the CRM has enrolled them. */
export const ENROL_POLL_MS = 15_000;
export const ENROL_POLL_LIMIT_MS = 10 * MIN_MS;

/** How far the student's clock is from the server's: add it to Date.now() to get the server's time. */
export function clockOffset(serverNow: string | null, deviceNow: number): number {
  const server = serverNow ? Date.parse(serverNow) : NaN;
  return Number.isFinite(server) ? server - deviceNow : 0;
}

/** Milliseconds to the deadline on the server's clock (negative once it has passed). */
export function msLeft(invitation: Pick<LeagueInvitation, 'expires_at'>, deviceNow: number, offset = 0): number {
  return Date.parse(invitation.expires_at) - (deviceNow + offset);
}

/** Can the student still answer? The server says `open`; the deadline can pass while the page is up. */
export function isAnswerable(invitation: Pick<LeagueInvitation, 'state' | 'expires_at'>, deviceNow: number, offset = 0): boolean {
  return invitation.state === 'open' && msLeft(invitation, deviceNow, offset) > 0;
}

/** How often a countdown with `left` ms to go needs to redraw; null when it has stopped. */
export function tickEvery(left: number): number | null {
  if (left <= 0) return null;
  return left <= 5 * MIN_MS ? 5_000 : 30_000;
}

const NB = ' ';

/**
 * «1 d 23 h» / «5 h 20 min» / «42 min» / «under a minute»: the time left, rounded down to the
 * minute (a deadline is never closer than it says), days only while there are more than 24 h.
 */
export function deadlineCountdown(left: number, locale: Locale = activeLocale()): string {
  const tr = (key: 'd' | 'h' | 'min') => t(`studentHome.leagueInvite.unit.${key}`, undefined, locale);
  if (left <= 0) return t('studentHome.leagueInvite.closedShort', undefined, locale);
  const minutes = Math.floor(left / MIN_MS);
  if (minutes < 1) return t('studentHome.leagueInvite.underMinute', undefined, locale);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = minutes % 60;
  if (d >= 1) return h === 0 ? `${d}${NB}${tr('d')}` : `${d}${NB}${tr('d')} ${h}${NB}${tr('h')}`;
  if (h >= 1) return m === 0 ? `${h}${NB}${tr('h')}` : `${h}${NB}${tr('h')} ${m}${NB}${tr('min')}`;
  return `${m}${NB}${tr('min')}`;
}

/** «Wed 14 Oct, 18:00» on the school's clock. */
export const deadlineLabel = (invitation: Pick<LeagueInvitation, 'expires_at'>, locale: Locale = activeLocale()): string =>
  kickoffLabel(invitation.expires_at, locale);

/** «Sat 7 Nov». */
export function examLabel(examDate: string, locale: Locale = activeLocale()): string {
  return formatDate(examDate, { weekday: 'short', day: 'numeric', month: 'short' }, locale);
}

/** «November 2026»: the month of the Final, which names the cohort for the student. */
export function examMonth(examDate: string, locale: Locale = activeLocale()): string {
  return `${formatDate(examDate, { month: 'long' }, locale)} ${examDate.slice(0, 4)}`;
}

/** «Dreamville» out of «Master League Dreamville». */
export const squadName = (option: Pick<InvitationOption, 'label'>): string => groupTail(option.label);

/** The squad the student chose, if it is still among the options. */
export function chosenOption(invitation: Pick<LeagueInvitation, 'options' | 'chosen_group_id'>): InvitationOption | null {
  return invitation.options.find((o) => o.group_id === invitation.chosen_group_id) ?? null;
}

/** The scenes of the page. */
export type InvitationScene =
  | 'open' | 'seatRequested' | 'enrolled' | 'ended' | 'declined' | 'expired' | 'withdrawn' | 'alreadyIn' | 'none';

/**
 * Which scene to play. An open invitation whose deadline has passed on the page reads as expired
 * without waiting for the CRM to close it; with no invitation to show, a student already in the
 * League is told so rather than «nothing here».
 */
export function sceneOf(
  invitation: LeagueInvitation | null, deviceNow: number, offset: number, inLeague: boolean,
): InvitationScene {
  if (!invitation) return inLeague ? 'alreadyIn' : 'none';
  if (invitation.state === 'open') return isAnswerable(invitation, deviceNow, offset) ? 'open' : 'expired';
  if (invitation.state === 'accepted') {
    if (invitation.member_status === 'enrolled' || invitation.member_status === 'completed') return 'enrolled';
    return invitation.member_status === 'dropped' ? 'ended' : 'seatRequested';
  }
  return invitation.state;
}

/** The dashboard card: for an open invitation, and quietly for a seat still being confirmed; otherwise nothing. */
export function cardKind(invitation: LeagueInvitation | null, deviceNow: number, offset: number): 'open' | 'pending' | null {
  if (!invitation) return null;
  const scene = sceneOf(invitation, deviceNow, offset, false);
  return scene === 'open' ? 'open' : scene === 'seatRequested' ? 'pending' : null;
}

/** Keep asking while an accepted seat waits for the CRM, for a while after the answer. */
export function shouldPollEnrolment(invitation: LeagueInvitation | null, sinceMs: number): boolean {
  return invitation?.state === 'accepted' && invitation.member_status === null && sinceMs < ENROL_POLL_LIMIT_MS;
}

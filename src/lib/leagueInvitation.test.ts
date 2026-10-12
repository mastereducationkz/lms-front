import { describe, expect, it, vi } from 'vitest';

// The bell's type list lives next to the API client, which touches localStorage when it loads.
vi.mock('../services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { hasMessage } from './i18n';
import {
  cardKind, chosenOption, clockOffset, deadlineCountdown, deadlineLabel, examLabel, examMonth, invitationNotificationPath,
  isAnswerable, LEAGUE_INVITATION_NOTIFICATION_TYPES, LEAGUE_INVITATION_PATH, localizeSchedule, msLeft, sceneOf, scheduleChips,
  seatsNote, shouldPollEnrolment, squadName, tickEvery, ENROL_POLL_LIMIT_MS,
} from './leagueInvitation';
import { BELL_NOTIFICATION_TYPES } from '../services/api/notifications';
import type { LeagueInvitation } from '../services/api/leagueInvitation';

// Wed 14 Oct 2026, 17:00 in Almaty (12:00 UTC). The invitation closes Fri 16 Oct, 16:00 Almaty (11:00 UTC).
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
const HOUR = 3_600_000;
const MIN = 60_000;
const plain = (text: string) => text.replace(/ /g, ' ');

const invitation = (over: Partial<LeagueInvitation> = {}): LeagueInvitation => ({
  id: 5,
  state: 'open',
  cohort_name: 'Ноябрь 2026',
  exam_date: '2026-11-07',
  expires_at: '2026-10-16T11:00:00Z',
  responded_at: null,
  server_now: '2026-10-14T12:00:00Z',
  options: [
    { group_id: 376, label: 'Master League Dreamville', schedule_text: 'Пн, Ср 18:00; Сб 11:00', seats_left: 3 },
    { group_id: 377, label: 'Master League KOD', schedule_text: 'Ср, Пт 20:00; Сб 12:00', seats_left: 8 },
  ],
  chosen_group_id: null,
  member_status: null,
  ...over,
});

describe('the deadline on the server clock', () => {
  it('ignores a wrong clock on the device', () => {
    const offset = clockOffset('2026-10-14T12:00:00Z', NOW - 3 * HOUR); // the device is 3 h behind
    expect(offset).toBe(3 * HOUR);
    expect(msLeft(invitation(), NOW - 3 * HOUR, offset)).toBe(47 * HOUR);
    expect(clockOffset(null, NOW)).toBe(0);
    expect(clockOffset('garbage', NOW)).toBe(0);
  });

  it('is answerable only while open and before the deadline', () => {
    expect(isAnswerable(invitation(), NOW)).toBe(true);
    expect(isAnswerable(invitation(), Date.parse('2026-10-16T11:00:00Z'))).toBe(false); // the second it closes
    expect(isAnswerable(invitation({ state: 'accepted' }), NOW)).toBe(false);
  });

  it('redraws often only when the end is near, and stops when it has come', () => {
    expect(tickEvery(47 * HOUR)).toBe(30_000);
    expect(tickEvery(4 * MIN)).toBe(5_000);
    expect(tickEvery(0)).toBeNull();
    expect(tickEvery(-5)).toBeNull();
  });
});

describe('the countdown', () => {
  it('reads in days, hours and minutes, rounded down', () => {
    expect(plain(deadlineCountdown(47 * HOUR + 12 * MIN + 59_000, 'en'))).toBe('1 d 23 h');
    expect(plain(deadlineCountdown(48 * HOUR, 'en'))).toBe('2 d');
    expect(plain(deadlineCountdown(5 * HOUR + 20 * MIN, 'en'))).toBe('5 h 20 min');
    expect(plain(deadlineCountdown(2 * HOUR, 'en'))).toBe('2 h');
    expect(plain(deadlineCountdown(42 * MIN + 30_000, 'en'))).toBe('42 min');
    expect(deadlineCountdown(40_000, 'en')).toBe('under a minute');
    expect(deadlineCountdown(0, 'en')).toBe('closed');
  });

  it('speaks Russian to a Russian reader', () => {
    expect(plain(deadlineCountdown(47 * HOUR, 'ru'))).toBe('1 дн. 23 ч');
    expect(plain(deadlineCountdown(42 * MIN, 'ru'))).toBe('42 мин');
    expect(deadlineCountdown(-1, 'ru')).toBe('закрыто');
  });

  it('never wraps a number from its unit', () => {
    expect(deadlineCountdown(5 * HOUR + 20 * MIN, 'en')).toContain(' ');
  });
});

describe('the dates', () => {
  it('writes the deadline and the Final on the school clock', () => {
    expect(deadlineLabel(invitation(), 'en')).toBe('Fri 16 Oct, 16:00');
    expect(examLabel('2026-11-07', 'en')).toBe('Sat 7 Nov');
    expect(examMonth('2026-11-07', 'en')).toBe('November 2026');
    expect(examMonth('2026-11-07', 'ru')).toMatch(/^ноябрь 2026$/);
  });
});

describe('the squad cards', () => {
  it('shows an English reader the CRM\'s Russian schedule in English', () => {
    expect(localizeSchedule('Пн, Ср 18:00; Сб 11:00', 'en')).toBe('Mon, Wed 18:00; Sat 11:00');
    expect(localizeSchedule('Вт 09:00; Чт, Пт 19:30; Вс 10:00', 'en')).toBe('Tue 09:00; Thu, Fri 19:30; Sun 10:00');
    expect(localizeSchedule('Пн, Ср 18:00; Сб 11:00', 'ru')).toBe('Пн, Ср 18:00; Сб 11:00');
  });

  it('does not touch words that merely contain a day\'s letters, and says when there is no schedule', () => {
    expect(localizeSchedule('Пятница в Сбербанке', 'en')).toBe('Пятница в Сбербанке');
    expect(localizeSchedule('Расписание уточняется', 'en')).toBe('Schedule to be confirmed');
    expect(localizeSchedule('', 'en')).toBe('Schedule to be confirmed');
    expect(localizeSchedule('Расписание уточняется', 'ru')).toBe('Расписание уточняется');
  });

  it('splits the schedule into one chip per day-group', () => {
    expect(scheduleChips('Пн, Ср 18:00; Сб 11:00', 'en')).toEqual(['Mon, Wed 18:00', 'Sat 11:00']);
    expect(scheduleChips('', 'en')).toEqual(['Schedule to be confirmed']);
  });

  it('names the squad without the programme', () => {
    expect(squadName({ label: 'Master League Dreamville' })).toBe('Dreamville');
    expect(squadName({ label: 'Master League KOD' })).toBe('KOD');
  });

  it('mentions seats only when they are about to run out', () => {
    expect(seatsNote(8, 'en')).toBeNull();
    expect(seatsNote(4, 'en')).toBeNull();
    expect(seatsNote(null, 'en')).toBeNull();
    expect(seatsNote(0, 'en')).toBeNull();
    expect(seatsNote(3, 'en')).toBe('Only 3 seats left');
    expect(seatsNote(1, 'en')).toBe('Last seat');
    expect(seatsNote(1, 'ru')).toBe('Последнее место');
    expect(seatsNote(2, 'ru')).toBe('Осталось 2 места');
  });

  it('finds the squad the student chose', () => {
    expect(chosenOption(invitation({ chosen_group_id: 377 }))?.label).toBe('Master League KOD');
    expect(chosenOption(invitation({ chosen_group_id: 999 }))).toBeNull();
    expect(chosenOption(invitation())).toBeNull();
  });
});

describe('which scene plays', () => {
  const scene = (inv: LeagueInvitation | null, now = NOW, inLeague = false) => sceneOf(inv, now, 0, inLeague);

  it('plays the offer while it is open and before the deadline', () => {
    expect(scene(invitation())).toBe('open');
  });

  it('turns an open offer into «closed» when the deadline passes with the page up', () => {
    expect(scene(invitation(), Date.parse('2026-10-16T11:00:00Z'))).toBe('expired');
  });

  it('follows the server for everything else', () => {
    expect(scene(invitation({ state: 'declined' }))).toBe('declined');
    expect(scene(invitation({ state: 'expired' }))).toBe('expired');
    expect(scene(invitation({ state: 'withdrawn' }))).toBe('withdrawn');
  });

  it('waits for the CRM after «I\'m in», then welcomes, or says the place ended', () => {
    expect(scene(invitation({ state: 'accepted', chosen_group_id: 376 }))).toBe('seatRequested');
    expect(scene(invitation({ state: 'accepted', member_status: 'enrolled' }))).toBe('enrolled');
    expect(scene(invitation({ state: 'accepted', member_status: 'completed' }))).toBe('enrolled');
    expect(scene(invitation({ state: 'accepted', member_status: 'dropped' }))).toBe('ended');
  });

  it('tells a student already in the League so, and otherwise that there is nothing', () => {
    expect(scene(null, NOW, true)).toBe('alreadyIn');
    expect(scene(null, NOW, false)).toBe('none');
  });
});

describe('the dashboard card', () => {
  it('shows for an open offer and, quietly, for a seat being confirmed; never otherwise', () => {
    expect(cardKind(invitation(), NOW, 0)).toBe('open');
    expect(cardKind(invitation({ state: 'accepted' }), NOW, 0)).toBe('pending');
    for (const state of ['declined', 'expired', 'withdrawn'] as const) expect(cardKind(invitation({ state }), NOW, 0)).toBeNull();
    expect(cardKind(invitation({ state: 'accepted', member_status: 'enrolled' }), NOW, 0)).toBeNull();
    expect(cardKind(invitation(), Date.parse('2026-10-17T00:00:00Z'), 0)).toBeNull();
    expect(cardKind(null, NOW, 0)).toBeNull();
  });
});

describe('waiting for the enrolment', () => {
  it('polls an accepted seat for ten minutes and stops once enrolled', () => {
    const accepted = invitation({ state: 'accepted' });
    expect(shouldPollEnrolment(accepted, 0)).toBe(true);
    expect(shouldPollEnrolment(accepted, ENROL_POLL_LIMIT_MS)).toBe(false);
    expect(shouldPollEnrolment(invitation({ state: 'accepted', member_status: 'enrolled' }), 0)).toBe(false);
    expect(shouldPollEnrolment(invitation(), 0)).toBe(false);
    expect(shouldPollEnrolment(null, 0)).toBe(false);
  });
});

describe('the bell', () => {
  it('opens the page for the invitation and its reminder, and for nothing else', () => {
    expect(LEAGUE_INVITATION_PATH).toBe('/league-invitation');
    expect(invitationNotificationPath('master_league_invitation')).toBe('/league-invitation');
    expect(invitationNotificationPath('master_league_reminder')).toBe('/league-invitation');
    expect(invitationNotificationPath('class_materials')).toBeNull();
    expect(invitationNotificationPath('child_master_league_invitation')).toBeNull();
  });

  it('shows those two types (the backend\'s notification_type values)', () => {
    for (const type of LEAGUE_INVITATION_NOTIFICATION_TYPES) expect(BELL_NOTIFICATION_TYPES).toContain(type);
  });
});

describe('the copy', () => {
  it('has every sentence the page can show, in both languages', () => {
    const keys = [
      'page', 'hero.title', 'hero.sub', 'what.one', 'what.two', 'slots.title', 'slots.sub', 'in', 'inFor', 'notNow', 'decline.title',
      'decline.body', 'decline.yes', 'decline.keep', 'teaser.title', 'teaser.sub', 'error.changed', 'error.retry', 'requested.title',
      'requested.body', 'enrolled.title', 'ended.title', 'declined.title', 'expired.title', 'withdrawn.title', 'alreadyIn.title',
      'none.title', 'failed.title', 'card.title', 'card.sub', 'card.cta', 'card.pendingTitle',
    ];
    for (const key of keys) expect(hasMessage(`studentHome.leagueInvite.${key}`), key).toBe(true);
  });
});

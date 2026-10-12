import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The i18n hooks read the signed-in user's language from AuthContext, whose import chain reaches the
// API client (it touches localStorage at load). A bare context is the signed-out device: the active locale.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: unknown }) => createElement('a', { href: to, ...rest }, children as never),
}));
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { setActiveLocale } from '@/lib/i18n';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import InvitationView, { type InvitationViewProps } from './InvitationView';
import { LeagueInvitationCardView } from '../LeagueInvitationCard';

// Wed 14 Oct 2026, 17:00 in Almaty. The invitation closes Fri 16 Oct, 16:00.
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);
/** The countdown glues a number to its unit with a non-breaking space; the tests read it as a plain one. */
const plain = (text: string) => text.replace(/\u00a0/g, ' ');

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

const render = (props: Partial<InvitationViewProps> & Pick<InvitationViewProps, 'scene'>, locale: 'en' | 'ru' = 'en') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(InvitationView, { invitation: invitation(), now: NOW, offset: 0, locale, ...props }));
};

afterEach(() => setActiveLocale('en'));

describe('the offer', () => {
  it('is one page with one h1, a hero, the two squads and a quiet «Not this time»', () => {
    const html = render({ scene: 'open' });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('You’ve been picked.');
    expect(html).toContain('November 2026');
    expect(html).toContain('Dreamville');
    expect(html).toContain('KOD');
    expect(html).toContain('Mon, Wed 18:00');
    expect(html).toContain('Sat 7 Nov');
    expect(html).toContain('Fri 16 Oct, 16:00');
    expect(html).toContain('Not this time');
    expect(html).toContain('This could be you');
  });

  it('puts the answer on one button per squad, named for a screen reader', () => {
    const html = render({ scene: 'open' });
    expect(html).toContain('aria-label="I’m in: Dreamville"');
    expect(html).toContain('aria-label="I’m in: KOD"');
    expect(html.match(/>I’m in</g)).toHaveLength(2);
  });

  it('has a timer that is silent to screen readers and the deadline written out beside it', () => {
    const html = render({ scene: 'open' });
    expect(html).toContain('role="timer"');
    expect(html).toContain('aria-live="off"');
    expect(plain(html)).toContain('1 d 23 h left');
  });

  it('warns about seats only when they are about to run out', () => {
    const html = render({ scene: 'open' });
    expect(html).toContain('Only 3 seats left');
    expect(html).not.toContain('8 seats');
  });

  it('keeps the six goals locked and says so', () => {
    const html = render({ scene: 'open' });
    for (const goal of ['Signed to the League', 'First Whistle', 'Hat-trick', 'Full Squad', 'Ever-Present', 'No Loose Ends']) expect(html).toContain(goal);
    expect(html.match(/>Locked</g)).toHaveLength(6);
  });

  it('speaks Russian, «вы», and shows the schedule as the CRM wrote it', () => {
    const html = render({ scene: 'open' }, 'ru');
    expect(html).toContain('Вас выбрали.');
    expect(html).toContain('Я в деле');
    expect(html).toContain('В другой раз');
    expect(html).toContain('Это можете быть вы');
    expect(html).toContain('Пн, Ср 18:00');
    expect(html).toContain('ноябрь 2026');
  });

  it('says what a single squad is, instead of asking to choose', () => {
    const one = invitation({ options: [invitation().options[0]] });
    expect(render({ scene: 'open', invitation: one })).toContain('Your squad');
    expect(render({ scene: 'open', invitation: invitation({ options: [] }) })).toContain('Ask your curator');
  });

  it('stops every button while an answer is being saved', () => {
    const html = render({ scene: 'open', saving: { kind: 'accept', groupId: 376 } });
    expect(html.match(/<button[^>]*disabled/g)?.length).toBeGreaterThanOrEqual(3); // both squads and «Not this time»
    expect(html).toContain('Saving…');
  });

  it('asks once before a «no» that cannot be taken back, without guilt', () => {
    const html = render({ scene: 'open', declining: true });
    expect(html).toContain('Pass on this invitation?');
    expect(html).toContain('That’s completely fine');
    expect(html).toContain('Keep my seat');
    expect(html).toContain('Yes, not this time');
  });

  it('says plainly when an answer did not go through', () => {
    expect(render({ scene: 'open', notice: 'retry' })).toContain('role="alert"');
    expect(render({ scene: 'open', notice: 'retry' })).toContain('Nothing was changed');
    expect(render({ scene: 'open', notice: 'changed' })).toContain('the invitation changed');
    expect(render({ scene: 'open' })).not.toContain('role="alert"');
  });
});

describe('the other scenes', () => {
  const accepted = invitation({ state: 'accepted', chosen_group_id: 376 });

  it('confirms a seat that is being enrolled, in a live region, and what to do if it was the wrong squad', () => {
    const html = render({ scene: 'seatRequested', invitation: accepted });
    expect(html).toContain('role="status"');
    expect(html).toContain('Seat requested');
    expect(html).toContain('Dreamville · Mon, Wed 18:00; Sat 11:00');
    expect(html).toContain('within minutes');
    expect(html).toContain('Tapped the wrong squad?');
    expect(html).toContain('href="/dashboard"');
  });

  it('welcomes an enrolled student', () => {
    const html = render({ scene: 'enrolled', invitation: { ...accepted, member_status: 'enrolled' } });
    expect(html).toContain('You’re in the squad');
    expect(html).toContain('Welcome to Dreamville');
  });

  it.each([
    ['declined', 'Thanks for letting us know', 'nothing changes there'],
    ['expired', 'This invitation has closed', 'Fri 16 Oct, 16:00'],
    ['withdrawn', 'This invitation is no longer open', 'regular group isn’t affected'],
    ['ended', 'Your Master League place has ended', 'ask your curator'],
    ['alreadyIn', 'You’re already in the League', 'dashboard'],
    ['none', 'No invitation right now', 'dashboard'],
  ] as const)('is honest about %s', (scene, title, line) => {
    const html = render({ scene, invitation: scene === 'none' || scene === 'alreadyIn' ? null : invitation({ state: scene === 'ended' ? 'accepted' : scene as never }) });
    expect(html).toContain(title);
    expect(html).toContain(line);
    expect(html).not.toContain('I’m in');
    expect(html).not.toContain('Decide');
  });

  it('offers a retry when the invitation could not be loaded', () => {
    const html = render({ scene: 'failed', invitation: null });
    expect(html).toContain('We couldn’t load your invitation');
    expect(html).toContain('Try again');
  });

  it('never blames the student', () => {
    for (const scene of ['declined', 'expired', 'withdrawn', 'ended', 'none'] as const) {
      const html = render({ scene, invitation: invitation({ state: scene === 'declined' ? 'declined' : 'expired' }) }).toLowerCase();
      for (const word of ['unfortunately', 'missed', 'too late', 'your fault', 'failed to']) expect(html).not.toContain(word);
    }
  });
});

describe('the dashboard card', () => {
  const card = (kind: 'open' | 'pending', locale: 'en' | 'ru' = 'en') => {
    setActiveLocale(locale);
    return renderToStaticMarkup(createElement(LeagueInvitationCardView, { kind, invitation: invitation(), now: NOW, offset: 0, locale }));
  };

  it('nudges, with the time left and a way in', () => {
    const html = card('open');
    expect(html).toContain('You’ve been picked');
    expect(plain(html)).toContain('1 d 23 h left to answer');
    expect(html).toContain('href="/league-invitation"');
    expect(html).toContain('See your invitation');
  });

  it('is quieter for a seat still being confirmed', () => {
    const html = card('pending');
    expect(html).toContain('Seat requested');
    expect(html).not.toContain('left to answer');
  });

  it('reads in Russian', () => {
    expect(card('open', 'ru')).toContain('Вас выбрали');
  });
});

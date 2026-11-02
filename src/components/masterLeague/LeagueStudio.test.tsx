import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Same harness as LeagueBanner.test.tsx: a bare AuthContext, a plain Link, no API.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: unknown }) => createElement('a', { href: to, ...rest }, children as never),
}));
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import AuthContext from '@/contexts/AuthContext';
import { setActiveLocale } from '@/lib/i18n';
import type { Achievement } from '@/services/api/achievementsUi';
import type { LeagueInvitation } from '@/services/api/leagueInvitation';
import type { MyLeague } from '@/services/api/masterLeague';
import { LeagueBannerView } from './LeagueBanner';
import { LeagueWelcomeBody } from './LeagueWelcome';
import { FOOTBALL_LOOK, invitationLook, leagueLook } from './leagueLook';
import InvitationView from './invitation/InvitationView';

const NOW = Date.UTC(2026, 10, 20, 6, 0, 0);

const league = (over: Partial<MyLeague> = {}): MyLeague => ({
  group: { id: 402, name: 'Master League Section.80' },
  exam_date: '2026-12-05',
  days_to_exam: 15,
  phase: 'season',
  score_release: '2026-12-18',
  result_due: '2027-01-01',
  lessons: {
    total: 11,
    played: 3,
    items: [1, 2, 3, 4, 5].map((n) => ({
      id: n, number: n, starts_at: `2026-11-${16 + n}T13:00:00Z`, state: n < 4 ? 'attended' : n === 4 ? 'today' : 'upcoming',
    })) as MyLeague['lessons']['items'],
  },
  next_lesson: { id: 4, number: 4, starts_at: '2026-11-20T13:00:00Z', title: 'Lesson 4' },
  attendance: { attended: 3, marked: 3, percent: 100 },
  homework: { on_time: 2, due: 2 },
  squad_size: 9,
  achievements: [{ key: 'ml_signed', unlocked: true, progress: null }],
  theme: 'studio',
  ...over,
});

const banner = (l: MyLeague, locale: 'en' | 'ru' = 'en') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueBannerView, { league: l, userId: 7, now: NOW, locale, defaultOpen: true }));
};

afterEach(() => setActiveLocale('en'));

describe('the studio season banner', () => {
  it('reads as a tracklist in studio words', () => {
    const html = banner(league());
    expect(html).toContain('Track 4 of 11');
    expect(html).toContain('15 days to Release Day');
    expect(html).toContain('<ol aria-label="Your tracklist"');
    expect(html).toContain('Track 1: attended');
    expect(html).toContain('Release Day · 5 Dec');
    expect(html).toContain('Producer’s note');
    expect(html).toContain('9 artists in your lineup');
    expect(html).toContain('>Signed<'); // the goal chip, by its studio name
    expect(html).not.toMatch(/Matchday|The Final|Coach/);
  });

  it('speaks Russian for a Russian student', () => {
    const html = banner(league(), 'ru');
    expect(html).toContain('Трек 4 из 11');
    expect(html).toContain('До релиза 15 дней');
    expect(html).toContain('Слово продюсера');
    expect(html).toContain('9 артистов в вашем составе');
  });

  it('wears its group’s palette: Section.80 purple, Off-Season burnt orange, anything else charcoal', () => {
    expect(banner(league())).toContain('#1F0F3D');
    const off = banner(league({ group: { id: 401, name: 'Master League Off-Season' } }));
    expect(off).toContain('#F7A56B');
    expect(off).not.toContain('#1F0F3D');
    expect(banner(league({ group: { id: 499, name: 'Master League Encore' } }))).toContain('#1A1B1F');
  });

  it('puts Kasatik in the studio look, never the football kit', () => {
    const html = banner(league());
    expect(html).toContain('Kasatik in the Master League studio look');
    expect(html).not.toContain('#0B1B4D'); // no navy anywhere
  });

  it('leaves the football banner exactly as it was when the theme is football or missing', () => {
    const football = league({ group: { id: 376, name: 'Master League Dreamville' }, theme: 'football' });
    const html = banner(football);
    expect(html).toContain('Matchday 4 of 11');
    expect(html).toContain('Coach’s note');
    expect(banner({ ...football, theme: undefined })).toBe(html);
    expect(leagueLook(undefined, 'Master League Section.80')).toBe(FOOTBALL_LOOK);
  });
});

describe('the studio welcome', () => {
  const ach = (key: string, title: string): Achievement => ({
    key, title, description: null, how_to: null, tier: 'league', category: 'master_league', secret: false, unlocked: true,
    unlocked_at: null, seen: false, progress: null, count: 1, rewards: [], unlock_id: null,
  });

  it('welcomes a studio student into the studio, from the server’s words alone', () => {
    setActiveLocale('en');
    const html = renderToStaticMarkup(createElement(LeagueWelcomeBody, {
      items: [ach('ml_signed', 'Signed'), ach('ml_first_whistle', 'First Take')], league: null, saving: false, onClose: () => undefined, Title: 'h2', Description: 'p',
    }));
    expect(html).toContain('Welcome to the Master League studio');
    expect(html).toContain('Put on the studio look');
    expect(html).toContain('First Take');
  });

  it('names the release day and the tracks in Russian', () => {
    setActiveLocale('ru');
    const html = renderToStaticMarkup(createElement(LeagueWelcomeBody, {
      items: [ach('ml_signed', 'x')], league: league(), saving: false, onClose: () => undefined, theme: 'studio', Title: 'h2', Description: 'p',
    }));
    expect(html).toContain('11 треков. Одна цель. Студийный образ готов.');
    expect(html).toContain('Section.80 · релиз 5 декабря');
    expect(html).toContain('Надеть студийный образ');
  });
});

describe('the studio invitation', () => {
  const invitation = (over: Partial<LeagueInvitation> = {}): LeagueInvitation => ({
    id: 9, state: 'open', cohort_name: 'Декабрь 2026', exam_date: '2026-12-05', expires_at: '2026-11-06T18:59:59Z',
    responded_at: null, server_now: '2026-11-03T10:00:00Z', chosen_group_id: null, member_status: null,
    options: [
      { group_id: 401, label: 'Master League Off-Season', schedule_text: 'Пн, Ср 18:00', seats_left: null },
      { group_id: 402, label: 'Master League Section.80', schedule_text: 'Вт, Чт 18:00', seats_left: null },
    ],
    theme: 'studio',
    ...over,
  });
  // The invitation speaks the student's own language (Russian unless they chose English): a student who chose it.
  const view = (inv: LeagueInvitation, locale: 'en' | 'ru' = 'en') => {
    setActiveLocale(locale);
    return renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: { id: 7, role: 'student', ui_language: locale } } as never },
      createElement(InvitationView, { scene: 'open', invitation: inv, now: Date.parse('2026-11-03T10:00:00Z'), offset: 0, locale })));
  };

  it('offers a lineup with Release Day, each card in its own group’s colours', () => {
    const html = view(invitation());
    expect(html).toContain('Release Day');
    expect(html).toContain('Choose your lineup');
    expect(html).toContain('First Take'); // the teaser's goals by their studio names
    expect(html).toContain('#F7A56B'); // Off-Season's card
    expect(html).toContain('#F5C451'); // Section.80's card
  });

  it('takes the chosen or only group’s look for the page, the shared studio look otherwise', () => {
    expect(invitationLook(invitation()).id).toBe('studio');
    expect(invitationLook(invitation({ chosen_group_id: 401 })).id).toBe('offSeason');
    expect(invitationLook(invitation({ options: [invitation().options[1]] })).id).toBe('section80');
    expect(invitationLook(invitation({ theme: 'football' })).id).toBe('football');
  });

  it('is in Russian too', () => {
    const html = view(invitation(), 'ru');
    expect(html).toContain('День релиза');
    expect(html).toContain('Выберите свой состав');
    expect(html).toContain('Первый дубль');
  });
});

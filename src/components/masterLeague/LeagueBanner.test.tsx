import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The i18n hooks read the signed-in user's language from AuthContext, whose import chain reaches the
// API client (it touches localStorage at load). A bare context is the signed-out device: the active locale.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
// Link only needs to be a link: a router is not what is under test.
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }: { to: string; children: unknown }) => createElement('a', { href: to, ...rest }, children as never),
}));
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { setActiveLocale } from '@/lib/i18n';
import type { LeaguePhase, MyLeague } from '@/services/api/masterLeague';
import { LeagueBannerView } from './LeagueBanner';

const NOW = Date.UTC(2026, 9, 13, 10, 0, 0);

const league = (over: Partial<MyLeague> = {}): MyLeague => ({
  group: { id: 376, name: 'Master League Dreamville' },
  exam_date: '2026-11-07',
  days_to_exam: 25,
  phase: 'season',
  score_release: '2026-11-20',
  result_due: '2026-12-04',
  lessons: {
    total: 3,
    played: 2,
    items: [
      { id: 1, number: 1, starts_at: '2026-10-12T13:00:00Z', state: 'attended' },
      { id: 2, number: 2, starts_at: '2026-10-13T13:00:00Z', state: 'missed' },
      { id: 3, number: 3, starts_at: '2026-10-14T13:00:00Z', state: 'upcoming' },
    ],
  },
  next_lesson: { id: 3, number: 3, starts_at: '2026-10-14T13:00:00Z', title: 'Master League Dreamville: Lesson 3' },
  attendance: { attended: 1, marked: 2, percent: 50 },
  homework: { on_time: 2, due: 3 },
  squad_size: 8,
  achievements: [
    { key: 'ml_signed', unlocked: true, progress: null },
    { key: 'ml_hat_trick', unlocked: false, progress: { current: 1, target: 3 } },
  ],
  ...over,
});

const render = (l: MyLeague, open = false, locale: 'en' | 'ru' = 'en') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueBannerView, { league: l, userId: 7, now: NOW, locale, defaultOpen: open }));
};

afterEach(() => setActiveLocale('en'));

describe('the season banner', () => {
  it('is a labelled region named by its headline', () => {
    const html = render(league());
    const id = /<section aria-labelledby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`<h2 id="${id}"`);
    expect(html).toContain('Matchday 3 of 3');
  });

  it('names the squad, the countdown, the numbers and the coach', () => {
    const html = render(league());
    expect(html).toContain('Master League · Dreamville');
    expect(html).toContain('25 days to The Final');
    expect(html).toContain('50%');
    expect(html).toContain('2/3');
    expect(html).toContain('8 players in your squad');
    expect(html).toContain('Coach’s note');
  });

  it('gives every pip words for a screen reader', () => {
    const html = render(league());
    expect(html).toContain('<ol aria-label="Your matchdays"');
    expect(html).toContain('Matchday 1: attended');
    expect(html).toContain('Matchday 2: missed');
    expect(html).toContain('Matchday 3: upcoming');
    expect((html.match(/<li /g) || []).length).toBe(4); // three lessons and The Final
  });

  it('ends the track with a trophy for The Final: quiet before, gold after the exam', () => {
    const before = render(league());
    expect(before).toContain('The Final · 7 Nov');
    expect(before).not.toContain('bg-amber-300 text-blue-950 shadow-[0_0_12px');
    expect(render(league({ phase: 'after' }))).toContain('shadow-[0_0_12px_rgba(252,211,77,0.7)]');
    expect(render(league({ phase: 'exam_day' }))).toContain('The Final · 7 Nov');
    expect(render(league({ exam_date: null }))).toContain('>The Final<');
    expect(render(league({ phase: 'final_week' }), false, 'ru')).toContain('Финал · 7 нояб.');
  });

  it('starts with the goals closed, and opens them on request', () => {
    const closed = render(league());
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('Signed to the League');
    const open = render(league(), true);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('Signed to the League');
    expect(open).toContain('Hat-trick');
    expect(open).toContain('1/3');
    expect(open).toContain('Done');
  });

  it('speaks Russian to a Russian student', () => {
    const html = render(league(), true, 'ru');
    expect(html).toContain('Тур 3 из 3');
    expect(html).toContain('Ваши туры');
    expect(html).toContain('Тур 1: посещён');
    expect(html).toContain('Слово тренера');
    expect(html).toContain('В Лиге');
  });

  it('has a dash for the numbers nothing has produced yet', () => {
    const html = render(league({ attendance: { attended: 0, marked: 0, percent: 0 }, homework: { on_time: 0, due: 0 } }));
    expect(html.match(/>—</g)?.length).toBe(2);
  });

  it('renders every phase, and never draws a pulsing ring without the reduced-motion escape', () => {
    const phases: LeaguePhase[] = ['warmup', 'season', 'final_week', 'eve', 'exam_day', 'after'];
    for (const phase of phases) {
      const html = render(league({ phase }));
      expect(html.length, phase).toBeGreaterThan(500);
    }
    const today = league({ lessons: { total: 3, played: 2, items: [{ id: 3, number: 3, starts_at: '2026-10-13T13:00:00Z', state: 'today' }] } });
    expect(render(today)).toContain('motion-reduce:animate-none');
  });

  it('has a quiet slot between the figures and the coach for the result question and the Telegram offer', () => {
    setActiveLocale('en');
    const html = renderToStaticMarkup(
      createElement(LeagueBannerView, { league: league(), userId: 7, now: NOW, locale: 'en' }, createElement('p', { id: 'slot' }, 'notice')),
    );
    expect(html.indexOf('id="slot"')).toBeGreaterThan(html.indexOf('8 players in your squad'));
    expect(html.indexOf('id="slot"')).toBeLessThan(html.indexOf('Coach’s note'));
    expect(render(league())).not.toContain('id="slot"');
  });

  it('tells the student when the scores come out, then asks for the score report', () => {
    const waiting = render(league({ phase: 'after', score_release: '2026-10-16', result_due: '2026-10-30' }));
    expect(waiting).toContain('Final whistle');
    expect(waiting).toContain('College Board publishes the scores on 16 October');
    expect(waiting).toContain('within 14 days');
    const out = render(league({ phase: 'after', score_release: '2026-10-13', result_due: '2026-10-27' }));
    expect(out).not.toContain('publishes the scores');
    expect(out).toContain('within 14 days');
    expect(render(league({ phase: 'after', score_release: '2026-10-13', result_due: '2026-10-20' }))).toContain('within 7 days');
  });

  it('still renders after an older backend: no release date, the days are counted to the due day', () => {
    const html = render(league({ phase: 'after', score_release: null, result_due: '2026-10-20' }));
    expect(html).toContain('Final whistle');
    expect(html).toContain('within 7 days');
  });

  it('speaks Russian before the release too', () => {
    const html = render(league({ phase: 'after', score_release: '2026-10-16', result_due: '2026-10-30' }), false, 'ru');
    expect(html).toContain('Баллы College Board выйдут 16 октября. Потом пришлите отчёт куратору в течение 14 дней.');
  });
});

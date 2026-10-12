import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The i18n hooks read the signed-in user's language from AuthContext, whose import chain reaches the
// API client (it touches localStorage at load). A bare context is the signed-out device: the active locale.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { setActiveLocale } from '@/lib/i18n';
import type { Achievement } from '@/services/api/achievementsUi';
import type { MyLeague } from '@/services/api/masterLeague';
import { LeagueWelcomeBody } from './LeagueWelcome';

const ach = (key: string, title: string): Achievement => ({
  key, title, description: null, how_to: null, tier: 'league', category: 'master_league', secret: false, unlocked: true,
  unlocked_at: null, seen: false, progress: null, count: 1, rewards: [], unlock_id: null,
});

const league = {
  group: { id: 376, name: 'Master League Dreamville' },
  exam_date: '2026-11-07',
  lessons: { total: 11, played: 0, items: [] },
} as unknown as MyLeague;

const render = (items: Achievement[], l: MyLeague | null, locale: 'en' | 'ru' = 'en') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueWelcomeBody, {
    items, league: l, saving: false, onClose: () => undefined, Title: 'h2', Description: 'p',
  }));
};

afterEach(() => setActiveLocale('en'));

describe('the welcome scene', () => {
  it('welcomes the student with the squad, the Final’s date and the matchday count', () => {
    const html = render([ach('ml_signed', 'Signed to the League')], league);
    expect(html).toContain('Welcome to the Master League');
    expect(html).toContain('11 matchdays. One goal. Your kit is ready.');
    expect(html).toContain('Dreamville · The Final on 7 November');
    expect(html).toContain('Put on the kit');
    expect(html).toContain('Let’s go');
  });

  it('still welcomes without the season’s numbers when they could not be loaded', () => {
    const html = render([ach('ml_signed', 'Signed to the League')], null);
    expect(html).toContain('One squad. One goal. Your kit is ready.');
    expect(html).not.toContain('The Final on');
  });

  it('lists what else was unlocked alongside, never the headline itself', () => {
    const html = render([ach('ml_signed', 'Signed to the League'), ach('ml_first_whistle', 'First Whistle')], league);
    expect(html).toContain('Also unlocked');
    expect(html).toContain('First Whistle');
    expect(html.match(/Signed to the League/g)).toHaveLength(1); // the eyebrow only
    expect(render([ach('ml_signed', 'Signed to the League')], league)).not.toContain('Also unlocked');
  });

  it('is in Russian for a Russian student, and keeps its motion off for reduced-motion', () => {
    const html = render([ach('ml_signed', 'x')], league, 'ru');
    expect(html).toContain('Добро пожаловать в Master League');
    expect(html).toContain('11 туров. Одна цель. Форма готова.');
    expect(html).toContain('Надеть форму');
    expect(html).toContain('prefers-reduced-motion:reduce');
  });
});

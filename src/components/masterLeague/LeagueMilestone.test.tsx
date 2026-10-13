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
import LeagueMilestoneHeader, { GOLDEN_CONFETTI, MILESTONE_CSS } from './LeagueMilestone';

const golden = (key: string, title: string, description: string, reward: Achievement['rewards'][number]): Achievement => ({
  key, title, description, how_to: null, tier: 'league', category: 'master_league', secret: false, unlocked: true,
  unlocked_at: '2026-11-20T08:00:00Z', seen: false, progress: null, count: 1, rewards: [reward], unlock_id: 1,
});

const render = (a: Achievement, locale: 'en' | 'ru' = 'en') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueMilestoneHeader, {
    code: 'v2.h5.g0.e2.p14.b5.f0', userId: 7, achievement: a, reward: a.rewards[0], Title: 'h2', Description: 'p',
  }));
};

afterEach(() => setActiveLocale('en'));

describe('the golden moment', () => {
  const perfect = golden('ml_perfect', 'Perfect', 'A perfect 1600', { layer: 'h', index: 28, name: 'Golden Laurel' });
  const club = golden('ml_1500', '1500 Club', '1500 or higher', { layer: 'f', index: 6, name: '1500 Club frame' });

  it('names the achievement and the reward the orca is wearing', () => {
    const html = render(perfect);
    expect(html).toContain('Master League · One of the rarest');
    expect(html).toContain('>Perfect</h2>');
    expect(html).toContain('Golden Laurel');
    expect(html).toContain('aria-label="Orca with Golden Laurel"');
  });

  it('draws the orca in the new part: the laurel for Perfect, the frame for the 1500 Club', () => {
    expect(render(perfect)).not.toBe(render(club));
    expect(render(club)).toContain('viewBox="-18 -18 236 236"'); // the framed orca
    expect(render(perfect)).toContain('viewBox="0 0 200 200"');
  });

  it('speaks Russian: the catalog words win over the server’s English', () => {
    const html = render(perfect, 'ru');
    expect(html).toContain('Master League · Одна из самых редких');
    expect(html).toContain('>Идеал</h2>');
    expect(html).toContain('Идеальные 1600 на Финале');
    expect(html).toContain('Золотой лавр');
    expect(render(club, 'ru')).toContain('Рамка «Клуб 1500»');
  });

  it('moves only for people who allow motion, and keeps its sparks and rays out of the reading order', () => {
    expect(MILESTONE_CSS).toContain('@media (prefers-reduced-motion:reduce)');
    const reduced = MILESTONE_CSS.slice(MILESTONE_CSS.indexOf('@media'));
    for (const cls of ['.ml-gold-rays', '.ml-gold-glow', '.ml-gold-twinkle']) expect(reduced).toContain(`${cls}`);
    expect(reduced).toContain('animation:none');
    const html = render(perfect);
    expect((html.match(/aria-hidden="true"/g) || []).length).toBeGreaterThanOrEqual(7); // rays + six sparks
  });

  it('throws gold confetti only', () => {
    expect(GOLDEN_CONFETTI.every((c) => /^#[0-9A-F]{6}$/i.test(c))).toBe(true);
    expect(GOLDEN_CONFETTI).toContain('#F7C948');
  });
});

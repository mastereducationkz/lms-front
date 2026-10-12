import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The i18n hooks read the signed-in user's language from AuthContext, whose import chain reaches the
// API client (it touches localStorage at load). A bare context is the signed-out device: the active locale.
vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import Orca from './Orca';
import OrcaPartGrid from './OrcaPartGrid';
import {
  CATEGORY_PARTS, FREE_COUNTS, isLeaguePart, isRewardPart, LEAGUE_ACHIEVEMENTS, parseMascot, REWARD_PARTS, serializeMascot,
  type MascotCategory,
} from './config';
import { leagueKitCode, leagueKitConfig } from './leagueKit';
import { setActiveLocale } from '../../lib/i18n';

const draw = (cfg: Partial<Record<MascotCategory, number>>) =>
  renderToStaticMarkup(createElement(Orca, { config: { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0, ...cfg }, idPrefix: 'x' }));

describe('the Master League kit parts', () => {
  const LEAGUE = [
    ['hat', 26, 'league_jersey', 'ml_signed'], ['hat', 27, 'hat_trick_topper', 'ml_hat_trick'],
    ['prop', 27, 'silver_whistle', 'ml_first_whistle'], ['prop', 28, 'squad_pennant', 'ml_full_squad'], ['prop', 29, 'gold_clipboard', 'ml_no_loose_ends'],
    ['background', 14, 'stadium_lights', 'ml_ever_present'], ['frame', 5, 'league_crest', 'ml_signed'],
  ] as const;

  it('sit at the end of their lists, as rewards, each tied to a league achievement', () => {
    for (const [category, index, key, achievement] of LEAGUE) {
      expect(CATEGORY_PARTS[category][index].key).toBe(key);
      expect(isRewardPart(category, index)).toBe(true);
      expect(isLeaguePart(category, index)).toBe(true);
      expect(REWARD_PARTS.find((r) => r.key === key)?.achievement).toBe(achievement);
      expect(LEAGUE_ACHIEVEMENTS.has(achievement)).toBe(true);
    }
  });

  it('leave every older part, free or earned, outside the league', () => {
    expect(isLeaguePart('hat', 25)).toBe(false); // the gold-star cape
    expect(isLeaguePart('frame', 4)).toBe(false);
    expect(isLeaguePart('hat', 3)).toBe(false); // a free hat
    expect(isLeaguePart('prop', 99)).toBe(false);
    expect(FREE_COUNTS).toEqual({ hat: 17, eyewear: 8, expression: 8, prop: 16, background: 11, frame: 1 });
  });

  it('are drawn: every part changes the picture, and the frame widens the box', () => {
    const plain = draw({});
    for (const [category, index] of LEAGUE) {
      const svg = draw({ [category]: index });
      expect(svg, `${category}${index}`).not.toBe(plain);
      expect(svg.length).toBeGreaterThan(plain.length);
    }
    expect(draw({ frame: 5 })).toContain('viewBox="-18 -18 236 236"');
  });

  it('draw the Master emblem on the jersey, the pennant and the crest', () => {
    const emblem = (svg: string) => (svg.match(/d="M556 1221/g) || []).length;
    expect(emblem(draw({ hat: 26 }))).toBe(1); // the crest on the chest
    expect(emblem(draw({ prop: 28 }))).toBe(1);
    expect(emblem(draw({ frame: 5 }))).toBe(1);
  });
});

describe('the kit look', () => {
  it('is a valid look with the five kit parts, so the banner can always draw it', () => {
    const kit = leagueKitConfig();
    expect(kit).toMatchObject({ hat: 26, prop: 27, background: 14, frame: 5 });
    expect(parseMascot(serializeMascot(kit))).toEqual(kit);
  });

  it('puts the jersey and the crest on a student’s own look in ONE code and touches nothing else', () => {
    expect(leagueKitCode('v2.h5.g3.e2.p14.b5.f0', 9)).toBe('v2.h26.g3.e2.p14.b5.f5');
    expect(leagueKitCode('v1.h5.g3.e2.p14.b5', 9)).toBe('v2.h26.g3.e2.p14.b5.f5');
  });

  it('starts from the automatic orca when nothing is saved', () => {
    const code = leagueKitCode(null, 4321);
    expect(parseMascot(code)).toMatchObject({ hat: 26, frame: 5 });
  });
});

describe('the wardrobe', () => {
  const grid = (leagueAccess: boolean, tab: MascotCategory) =>
    renderToStaticMarkup(createElement(OrcaPartGrid, {
      tab, config: { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 }, locked: {}, leagueAccess, onPick: () => undefined,
    }));

  it('hides the league parts from students outside the league and shows them to those in it', () => {
    setActiveLocale('en');
    for (const [tab, name] of [['hat', 'League Jersey'], ['prop', 'Silver Whistle'], ['background', 'Stadium Lights'], ['frame', 'League Crest frame']] as const) {
      expect(grid(false, tab), name).not.toContain(name);
      expect(grid(true, tab), name).toContain(name);
    }
  });

  it('keeps every other reward visible either way', () => {
    setActiveLocale('en');
    expect(grid(false, 'hat')).toContain('Gold-star cape');
    expect(grid(false, 'frame')).toContain('Star ring frame');
  });

  it('names the parts in Russian too', () => {
    setActiveLocale('ru');
    expect(grid(true, 'hat')).toContain('Форма Лиги');
    expect(grid(true, 'frame')).toContain('Рамка «Герб Лиги»');
    setActiveLocale('en');
  });
});

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
  CATEGORY_PARTS, FREE_COUNTS, isLeaguePart, isLockedPart, isRewardPart, LEAGUE_ACHIEVEMENTS, parseMascot, partLabel, REWARD_PARTS,
  serializeMascot, withUnlistedRewardsLocked, type MascotCategory,
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
    // phase 2: the mock climb and the official result
    ['hat', 28, 'golden_laurel', 'ml_perfect'], ['prop', 30, 'summit_flag', 'ml_mock_climb'],
    ['background', 15, 'breakthrough_dawn', 'ml_breakthrough'], ['frame', 6, 'club_1500_frame', 'ml_1500'],
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
    expect(isLeaguePart('hat', 29)).toBe(false); // nothing beyond the catalogue
    expect(isLeaguePart('prop', 99)).toBe(false);
    expect(FREE_COUNTS).toEqual({ hat: 17, eyewear: 8, expression: 8, prop: 16, background: 11, frame: 1 });
  });

  it('count ten league achievements, all of them behind league access', () => {
    expect([...LEAGUE_ACHIEVEMENTS].sort()).toEqual([
      'ml_1500', 'ml_breakthrough', 'ml_ever_present', 'ml_first_whistle', 'ml_full_squad', 'ml_hat_trick',
      'ml_mock_climb', 'ml_no_loose_ends', 'ml_perfect', 'ml_signed',
    ]);
    expect(REWARD_PARTS.filter((r) => LEAGUE_ACHIEVEMENTS.has(r.achievement))).toHaveLength(11);
  });

  it('read as locked while the server does not list their achievement (the front end ships first)', () => {
    const old = withUnlistedRewardsLocked({ h: [17], f: [] }, [
      'graduate_gold', 'top_score', 'ml_signed', 'ml_first_whistle', 'ml_hat_trick', 'ml_full_squad', 'ml_ever_present', 'ml_no_loose_ends',
    ].concat(REWARD_PARTS.filter((r) => !r.achievement.startsWith('ml_')).map((r) => r.achievement)));
    expect(isLockedPart('hat', 28, old)).toBe(true); // golden laurel: the old backend has no ml_perfect
    expect(isLockedPart('prop', 30, old)).toBe(true);
    expect(isLockedPart('background', 15, old)).toBe(true);
    expect(isLockedPart('frame', 6, old)).toBe(true);
    expect(isLockedPart('hat', 17, old)).toBe(true); // what the server said is kept
    expect(isLockedPart('hat', 26, old)).toBe(false); // listed, and not in locked_parts: earned
    expect(isLockedPart('frame', 5, old)).toBe(false);
  });

  it('leave the server’s word alone once it lists the achievement', () => {
    const listed = REWARD_PARTS.map((r) => r.achievement);
    expect(withUnlistedRewardsLocked({ f: [6] }, listed)).toEqual({ f: [6] });
    expect(withUnlistedRewardsLocked({}, listed)).toEqual({});
  });

  it('are drawn: every part changes the picture, and the frame widens the box', () => {
    const plain = draw({});
    for (const [category, index] of LEAGUE) {
      const svg = draw({ [category]: index });
      expect(svg, `${category}${index}`).not.toBe(plain);
      expect(svg.length).toBeGreaterThan(plain.length);
    }
    expect(draw({ frame: 5 })).toContain('viewBox="-18 -18 236 236"');
    expect(draw({ frame: 6 })).toContain('viewBox="-18 -18 236 236"');
  });

  it('draw the Master emblem on the summit flag as well', () => {
    const emblem = (svg: string) => (svg.match(/d="M556 1221/g) || []).length;
    expect(emblem(draw({ prop: 30 }))).toBe(1);
  });

  it('keep two orcas with the new parts on one page apart (no shared gradient ids)', () => {
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(Orca, { config: { hat: 28, eyewear: 0, expression: 0, prop: 30, background: 15, frame: 6 } }),
      createElement(Orca, { config: { hat: 28, eyewear: 0, expression: 0, prop: 30, background: 15, frame: 6 } })));
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(html).not.toContain('undefined');
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
    for (const [tab, name] of [
      ['hat', 'League Jersey'], ['prop', 'Silver Whistle'], ['background', 'Stadium Lights'], ['frame', 'League Crest frame'],
      ['hat', 'Golden Laurel'], ['prop', 'Summit Flag'], ['background', 'Breakthrough Dawn'], ['frame', '1500 Club frame'],
    ] as const) {
      expect(grid(false, tab), name).not.toContain(name);
      expect(grid(true, tab), name).toContain(name);
    }
  });

  it('names the four new parts in both languages, in the catalogue', () => {
    for (const [category, index, en, ru] of [
      ['hat', 28, 'Golden Laurel', 'Золотой лавр'], ['prop', 30, 'Summit Flag', 'Флаг вершины'],
      ['background', 15, 'Breakthrough Dawn', 'Рассвет рывка'], ['frame', 6, '1500 Club frame', 'Рамка «Клуб 1500»'],
    ] as const) {
      expect(partLabel(category, index, 'en')).toBe(en);
      expect(partLabel(category, index, 'ru')).toBe(ru);
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
    expect(grid(true, 'hat')).toContain('Золотой лавр');
    expect(grid(true, 'prop')).toContain('Флаг вершины');
    expect(grid(true, 'background')).toContain('Рассвет рывка');
    expect(grid(true, 'frame')).toContain('Рамка «Клуб 1500»');
    expect(grid(false, 'frame')).not.toContain('Клуб 1500');
    setActiveLocale('en');
  });
});

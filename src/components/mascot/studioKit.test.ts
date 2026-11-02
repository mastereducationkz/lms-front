import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import Orca from './Orca';
import OrcaPartGrid from './OrcaPartGrid';
import {
  CATEGORY_PARTS, isLeaguePart, isLockedPart, isPartOffered, leaguePartTheme, parseMascot, partLabel, REWARD_PARTS,
  serializeMascot, withUnlistedRewardsLocked, type MascotCategory,
} from './config';
import { leagueKitCode, leagueKitConfig } from './leagueKit';
import { teaserLooks } from '../masterLeague/invitation/teaserKit';
import { setActiveLocale } from '../../lib/i18n';

// SEASON-STUDIO.md: appended at exactly these indices, each the studio twin of a football part
const STUDIO = [
  ['hat', 29, 'studio_headphones', 'ml_signed', 'Studio Headphones'],
  ['hat', 30, 'vinyl_snapback', 'ml_hat_trick', 'Vinyl Snapback'],
  ['hat', 31, 'diamond_headphones', 'ml_perfect', 'Diamond Headphones'],
  ['prop', 31, 'vintage_mic', 'ml_first_whistle', 'Vintage Mic'],
  ['prop', 32, 'mixing_fader', 'ml_full_squad', 'Mixing Fader'],
  ['prop', 33, 'master_tape', 'ml_no_loose_ends', 'Master Tape'],
  ['prop', 34, 'chart_arrow', 'ml_mock_climb', 'Chart Arrow'],
  ['background', 16, 'studio_booth', 'ml_ever_present', 'Studio Booth'],
  ['background', 17, 'stage_spotlight', 'ml_breakthrough', 'Stage Spotlight'],
  ['frame', 7, 'gold_record', 'ml_signed', 'Gold Record frame'],
  ['frame', 8, 'platinum_record', 'ml_1500', 'Platinum Record frame'],
] as const;

const draw = (cfg: Partial<Record<MascotCategory, number>>) =>
  renderToStaticMarkup(createElement(Orca, { config: { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0, ...cfg }, idPrefix: 'x' }));

describe('the studio parts', () => {
  it('sit at the spec’s indices, last in their lists (h32 p35 b18 f9), as studio league rewards', () => {
    for (const [category, index, key, achievement] of STUDIO) {
      expect(CATEGORY_PARTS[category][index].key, `${category}${index}`).toBe(key);
      expect(isLeaguePart(category, index)).toBe(true);
      expect(leaguePartTheme(category, index)).toBe('studio');
      expect(REWARD_PARTS.find((r) => r.key === key)).toMatchObject({ achievement, theme: 'studio' });
    }
    expect([CATEGORY_PARTS.hat.length, CATEGORY_PARTS.prop.length, CATEGORY_PARTS.background.length, CATEGORY_PARTS.frame.length]).toEqual([32, 35, 18, 9]);
    expect(leaguePartTheme('hat', 26)).toBe('football');
    expect(leaguePartTheme('hat', 5)).toBeNull();
  });

  it('are named in both languages', () => {
    for (const [category, index, , , en] of STUDIO) {
      expect(partLabel(category, index, 'en')).toBe(en);
      expect(partLabel(category, index, 'ru')).not.toBe(en);
    }
  });

  it('are drawn: every part changes the picture, frames widen the box, ids stay unique', () => {
    const plain = draw({});
    for (const [category, index] of STUDIO) {
      const svg = draw({ [category]: index });
      expect(svg, `${category}${index}`).not.toBe(plain);
      expect(svg).not.toContain('undefined');
      expect(svg).not.toContain('NaN');
    }
    expect(draw({ frame: 7 })).toContain('viewBox="-18 -18 236 236"');
    const html = renderToStaticMarkup(createElement('div', null,
      createElement(Orca, { config: { hat: 29, eyewear: 0, expression: 4, prop: 31, background: 16, frame: 7 } }),
      createElement(Orca, { config: { hat: 31, eyewear: 0, expression: 0, prop: 34, background: 17, frame: 8 } })));
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('a part of the other season is never earnable', () => {
  const listed = REWARD_PARTS.map((r) => r.achievement);

  it('locks the football parts for a studio student and the studio parts for a football one', () => {
    const studio = withUnlistedRewardsLocked({}, listed, 'studio');
    expect(isLockedPart('hat', 26, studio)).toBe(true); // jersey
    expect(isLockedPart('frame', 5, studio)).toBe(true); // crest
    expect(isLockedPart('hat', 29, studio)).toBe(false); // headphones: earned
    const football = withUnlistedRewardsLocked({}, listed, 'football');
    expect(isLockedPart('hat', 29, football)).toBe(true);
    expect(isLockedPart('frame', 8, football)).toBe(true);
    expect(isLockedPart('hat', 26, football)).toBe(false);
    expect(isLockedPart('hat', 17, football)).toBe(false); // non-league rewards are untouched
  });

  it('shows each student only their own season’s parts in the wardrobe', () => {
    expect(isPartOffered('hat', 29, true, 'studio')).toBe(true);
    expect(isPartOffered('hat', 29, true, 'football')).toBe(false);
    expect(isPartOffered('hat', 26, true, 'studio')).toBe(false);
    expect(isPartOffered('hat', 29, false, 'studio')).toBe(false);
    expect(isPartOffered('hat', 20, false)).toBe(true);
    setActiveLocale('en');
    const grid = (leagueTheme: 'football' | 'studio') => renderToStaticMarkup(createElement(OrcaPartGrid, {
      tab: 'hat', config: { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 }, locked: {}, leagueAccess: true, leagueTheme, onPick: () => undefined,
    }));
    expect(grid('studio')).toContain('Studio Headphones');
    expect(grid('studio')).not.toContain('League Jersey');
    expect(grid('football')).toContain('League Jersey');
    expect(grid('football')).not.toContain('Studio Headphones');
  });
});

describe('the studio kit', () => {
  it('is headphones, a vintage mic, the booth and a gold record, with a determined face', () => {
    const kit = leagueKitConfig('studio');
    expect(kit).toEqual({ hat: 29, eyewear: 0, expression: 4, prop: 31, background: 16, frame: 7 });
    expect(parseMascot(serializeMascot(kit))).toEqual(kit);
    expect(leagueKitConfig()).toMatchObject({ hat: 26, prop: 27, background: 14, frame: 5 }); // football as before
  });

  it('puts on the two «Signed» rewards of the season in ONE code', () => {
    expect(leagueKitCode('v2.h5.g3.e2.p14.b5.f0', 9, 'studio')).toBe('v2.h29.g3.e2.p14.b5.f7');
    expect(leagueKitCode('v2.h5.g3.e2.p14.b5.f0', 9)).toBe('v2.h26.g3.e2.p14.b5.f5');
  });

  it('teases the studio look on a studio invitation', () => {
    expect(teaserLooks('studio').map((l) => l.key)).toEqual([
      'studio_headphones', 'vinyl_snapback', 'vintage_mic', 'mixing_fader', 'master_tape', 'studio_booth',
    ]);
    expect(teaserLooks()[0].key).toBe('league_jersey');
  });
});

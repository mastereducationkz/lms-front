import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { hasMessage, t } from '../../lib/i18n';
import Orca from './Orca';
import UserAvatar, { initialsOf } from './UserAvatar';
import {
  applyPart,
  CATEGORY_PARTS,
  FREE_COUNTS,
  isLockedPart,
  isRewardPart,
  makeRng,
  parseMascot,
  partLabel,
  randomMascot,
  resolveMascot,
  rewardLabel,
  seedMascot,
  REWARD_PARTS,
  serializeMascot,
  usesLockedPart,
  type MascotCategory,
  type MascotConfig,
} from './config';
import { PRESETS } from './presets';

describe('mascot codes', () => {
  it('round-trips every random look', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const c = randomMascot(rng);
      expect(parseMascot(serializeMascot(c))).toEqual(c);
    }
  });

  it('mirrors the backend catalogue sizes (lms-backend src/auth/mascot.py PART_COUNTS)', () => {
    expect({
      h: CATEGORY_PARTS.hat.length,
      g: CATEGORY_PARTS.eyewear.length,
      e: CATEGORY_PARTS.expression.length,
      p: CATEGORY_PARTS.prop.length,
      b: CATEGORY_PARTS.background.length,
      f: CATEGORY_PARTS.frame.length,
    }).toEqual({ h: 26, g: 9, e: 8, p: 27, b: 14, f: 5 });
  });

  it('writes v2 and still reads v1 codes as frame 0', () => {
    expect(serializeMascot({ hat: 3, eyewear: 0, expression: 2, prop: 5, background: 4, frame: 1 })).toBe('v2.h3.g0.e2.p5.b4.f1');
    expect(parseMascot('v1.h16.g7.e7.p15.b10')).toEqual({ hat: 16, eyewear: 7, expression: 7, prop: 15, background: 10, frame: 0 });
    expect(parseMascot('v2.h25.g8.e7.p26.b13.f4')).toEqual({ hat: 25, eyewear: 8, expression: 7, prop: 26, background: 13, frame: 4 });
  });

  it('refuses anything that is not a valid v1 or v2 code', () => {
    for (const bad of [
      '', 'v1.h1.g0.e0.p0', 'v1.h1.g0.e0.p0.b0.f0', 'v2.h1.g0.e0.p0.b0', 'v3.h1.g0.e0.p0.b0.f0',
      'v1.h26.g0.e0.p0.b0', 'v2.h0.g0.e0.p0.b14.f0', 'v2.h0.g0.e0.p0.b0.f5', 'v2.h0.g9.e0.p0.b0.f0',
      'v1.g0.h1.e0.p0.b0', 'v2.h1.g0.e0.p0.b0.f0.x', 'nonsense',
    ]) {
      expect(parseMascot(bad)).toBeNull();
    }
    expect(parseMascot(null)).toBeNull();
  });
});

describe('automatic orcas', () => {
  it('gives the same id the same orca, for ever', () => {
    expect(seedMascot(4321)).toEqual(seedMascot(4321));
    expect(seedMascot('4321')).toEqual(seedMascot(4321));
  });

  it('spreads students across every FREE part, and never hands out a reward', () => {
    const seen: Record<MascotCategory, Set<number>> = {
      hat: new Set(), eyewear: new Set(), expression: new Set(), prop: new Set(), background: new Set(), frame: new Set(),
    };
    for (let id = 1; id <= 3000; id++) {
      const c = seedMascot(id);
      (Object.keys(seen) as MascotCategory[]).forEach((k) => seen[k].add(c[k]));
      expect(usesLockedPart(c, null)).toBe(false);
    }
    (Object.keys(seen) as MascotCategory[]).forEach((k) => expect(seen[k].size).toBe(FREE_COUNTS[k]));
  });

  it('keeps every automatic orca exactly as it was before rewards were appended', () => {
    // captured from the pre-achievements catalogue (origin/master e1d0fe8)
    const before: [number, Omit<MascotConfig, 'frame'>][] = [
      [1, { hat: 14, eyewear: 0, expression: 3, prop: 2, background: 7 }],
      [7, { hat: 15, eyewear: 0, expression: 3, prop: 0, background: 2 }],
      [42, { hat: 1, eyewear: 0, expression: 7, prop: 3, background: 9 }],
      [1000, { hat: 14, eyewear: 0, expression: 3, prop: 1, background: 8 }],
      [2160, { hat: 9, eyewear: 0, expression: 7, prop: 13, background: 6 }],
      [4321, { hat: 1, eyewear: 0, expression: 5, prop: 0, background: 1 }],
      [7053, { hat: 10, eyewear: 2, expression: 2, prop: 0, background: 9 }],
    ];
    before.forEach(([id, look]) => expect(seedMascot(id)).toEqual({ ...look, frame: 0 }));
  });

  it('shuffles free parts only', () => {
    const rng = makeRng(99);
    for (let i = 0; i < 2000; i++) expect(usesLockedPart(randomMascot(rng), null)).toBe(false);
  });

  it('prefers the saved look, falling back to the automatic one', () => {
    expect(resolveMascot('v1.h5.g0.e2.p14.b5', 9)).toEqual({ hat: 5, eyewear: 0, expression: 2, prop: 14, background: 5, frame: 0 });
    expect(resolveMascot('garbage', 9)).toEqual(seedMascot(9));
    expect(resolveMascot(null, 9)).toEqual(seedMascot(9));
  });
});

describe('presets', () => {
  it('are all valid, named once, and distinct looks', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(40);
    const codes = new Set(PRESETS.map((p) => serializeMascot(p.config)));
    for (const locale of ['en', 'ru'] as const) {
      expect(new Set(PRESETS.map((p) => t(p.nameKey, undefined, locale))).size).toBe(PRESETS.length);
    }
    expect(codes.size).toBe(PRESETS.length);
    PRESETS.forEach((p) => expect(parseMascot(serializeMascot(p.config))).toEqual(p.config));
  });

  it('use free parts only, with no frame', () => {
    PRESETS.forEach((p) => {
      expect(usesLockedPart(p.config, null)).toBe(false);
      expect(p.config.frame).toBe(0);
    });
  });
});

describe('wardrobe names', () => {
  it('names every part in both languages', () => {
    (Object.keys(CATEGORY_PARTS) as MascotCategory[]).forEach((cat) => {
      CATEGORY_PARTS[cat].forEach((part, i) => {
        expect(hasMessage(part.labelKey), part.labelKey).toBe(true);
        expect(partLabel(cat, i, 'ru')).not.toBe(partLabel(cat, i, 'en'));
      });
    });
    expect(partLabel('hat', 5, 'en')).toBe('Crown');
    expect(partLabel('hat', 5, 'ru')).toBe('Корона');
    expect(partLabel('hat', 99, 'en')).toBe('');
  });

  it('names a reward by the part it puts on, falling back to the server name', () => {
    expect(rewardLabel({ layer: 'h', index: 18, name: 'Diamond crown' }, 'ru')).toBe('Бриллиантовая корона');
    expect(rewardLabel({ layer: 'p', index: 20, name: 'Golden clock' }, 'en')).toBe('Golden clock');
    expect(rewardLabel({ layer: 'h', index: 99, name: 'Future hat' }, 'ru')).toBe('Future hat');
  });
});

describe('drawing', () => {
  it('renders every part of every layer', () => {
    const base = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 };
    (Object.keys(CATEGORY_PARTS) as MascotCategory[]).forEach((cat) => {
      CATEGORY_PARTS[cat].forEach((_, i) => {
        const svg = renderToStaticMarkup(createElement(Orca, { config: { ...base, [cat]: i }, size: 40 }));
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).not.toContain('undefined');
      });
    });
  });

  it('keeps gradient ids of two orcas on one page apart', () => {
    const html = renderToStaticMarkup(
      createElement('div', null,
        createElement(Orca, { config: PRESETS[0].config }),
        createElement(Orca, { config: PRESETS[1].config })),
    );
    const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('UserAvatar', () => {
  const html = (props: Parameters<typeof UserAvatar>[0]) => renderToStaticMarkup(createElement(UserAvatar, props));

  it('shows a real photo first', () => {
    expect(html({ userId: 1, name: 'A B', avatarUrl: 'https://x/p.png', isStudent: true })).toContain('<img');
  });

  it('gives a student their orca', () => {
    expect(html({ userId: 1, name: 'Aru Sat', isStudent: true })).toContain('<svg');
  });

  it('keeps initials for staff', () => {
    const out = html({ userId: 2, name: 'Oskenbay Nur', isStudent: false });
    expect(out).not.toContain('<svg');
    expect(out).toContain('ON');
  });

  it('makes initials from up to two words', () => {
    expect(initialsOf('aru')).toBe('A');
    expect(initialsOf('  Oskenbay   Nur Bek ')).toBe('ON');
    expect(initialsOf('')).toBe('U');
  });
});

describe('Master Education branding', () => {
  it('appends the Master hoodie and Master blue last, so older codes keep their meaning', () => {
    expect(CATEGORY_PARTS.hat[16].key).toBe('master-hoodie');
    expect(CATEGORY_PARTS.background[10].key).toBe('master');
    expect(CATEGORY_PARTS.hat[15].key).toBe('bandana');
    expect(CATEGORY_PARTS.background[9].key).toBe('lilac');
  });

  it('opens the presets with Master Kasatik: hoodie, laptop, Master blue', () => {
    expect(t(PRESETS[0].nameKey, undefined, 'en')).toBe('Master Kasatik');
    expect(PRESETS[0].config).toEqual({ hat: 16, eyewear: 0, expression: 0, prop: 1, background: 10, frame: 0 });
  });

  it('draws the emblem from the one shared path set on every branded part', () => {
    const emblem = (svg: string) => (svg.match(/d="M556 1221/g) || []).length;
    const draw = (cfg: Partial<Record<MascotCategory, number>>) =>
      renderToStaticMarkup(createElement(Orca, { config: { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0, ...cfg } }));
    expect(emblem(draw({}))).toBe(0);
    expect(emblem(draw({ hat: 16 }))).toBe(1); // hoodie chest
    expect(emblem(draw({ prop: 1 }))).toBe(1); // laptop lid
    expect(emblem(draw({ hat: 2 }))).toBe(2); // both ear cups
    expect(emblem(draw({ background: 10 }))).toBeGreaterThan(4); // tonal pattern
  });
});

describe('achievement rewards', () => {
  // ACHIEVEMENTS_CONTRACT.md §1 — the binding table, layer + index → key → achievement
  const CONTRACT: [string, number, string, string][] = [
    ['h', 17, 'gold_master_hoodie', 'graduate_gold'], ['h', 18, 'diamond_crown', 'top_score'],
    ['h', 19, 'golden_kalpak', 'nauryz'], ['h', 20, 'explorer_hat', 'checkpoint_pro'],
    ['h', 21, 'warrior_headband', 'weekly_warrior'], ['h', 22, 'quiz_cap', 'live_ace'],
    ['h', 23, 'garland_scarf', 'winter_lights'], ['h', 24, 'team_scarf', 'team_spirit'],
    ['h', 25, 'star_cape', 'star_of_week'], ['g', 8, 'gold_star_glasses', 'full_marks_3'],
    ['p', 16, 'swim_ring', 'first_splash'], ['p', 17, 'fin_pencil', 'hand_in_hero'],
    ['p', 18, 'compass', 'first_checkpoint'], ['p', 19, 'clock_pin', 'on_time_5'],
    ['p', 20, 'golden_clock', 'on_time_20'], ['p', 21, 'bronze_medal', 'perfect_month'],
    ['p', 22, 'jetpack', 'score_climber'], ['p', 23, 'boomerang', 'comeback'],
    ['p', 24, 'diploma', 'verified_score'], ['p', 25, 'lucky_charm', 'test_day_ready'],
    ['p', 26, 'lightning_badge', 'live_wire'], ['b', 11, 'sparkle', 'hello_kasatik'],
    ['b', 12, 'sunrise', 'early_bird'], ['b', 13, 'aurora', 'streak_100'],
    ['f', 1, 'flame', 'streak_7'], ['f', 2, 'blue_flame', 'streak_30'],
    ['f', 3, 'gold_laurel', 'graduate_gold'], ['f', 4, 'star_ring', 'star_of_week_3'],
  ];

  it('match the contract table exactly', () => {
    expect(REWARD_PARTS.map((r) => [r.layer, r.index, r.key, r.achievement])).toEqual(CONTRACT);
  });

  it('keep every free part free and lock rewards until earned', () => {
    expect(isLockedPart('hat', 16, null)).toBe(false);
    expect(isLockedPart('expression', 7, null)).toBe(false);
    expect(isLockedPart('frame', 0, null)).toBe(false);
    expect(isLockedPart('hat', 17, null)).toBe(true); // no API data → locked
    expect(isLockedPart('hat', 17, { h: [17, 18] })).toBe(true);
    expect(isLockedPart('hat', 19, { h: [17, 18] })).toBe(false); // earned → not in locked_parts
    expect(isLockedPart('frame', 3, { f: [] })).toBe(false);
    expect(isRewardPart('prop', 15)).toBe(false);
    expect(isRewardPart('prop', 16)).toBe(true);
  });

  it('spots a look that uses a locked part', () => {
    const look = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 13, frame: 0 };
    expect(usesLockedPart(look, { b: [13] })).toBe(true);
    expect(usesLockedPart(look, { b: [11, 12] })).toBe(false);
  });

  it('swaps one reward into the current look (Wear it now)', () => {
    expect(applyPart('v1.h5.g0.e2.p14.b5', 9, 'f', 1)).toBe('v2.h5.g0.e2.p14.b5.f1');
    expect(applyPart(null, 4321, 'h', 18)).toBe(serializeMascot({ ...seedMascot(4321), hat: 18 }));
  });

  it('draws a frame outside the circle and leaves unframed orcas untouched', () => {
    const draw = (frame: number) =>
      renderToStaticMarkup(createElement(Orca, { config: { ...PRESETS[0].config, frame }, size: 40 }));
    expect(draw(0)).toContain('viewBox="0 0 200 200"');
    for (let f = 1; f < CATEGORY_PARTS.frame.length; f++) expect(draw(f)).toContain('viewBox="-18 -18 236 236"');
  });
});

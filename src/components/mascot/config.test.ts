import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Orca from './Orca';
import UserAvatar, { initialsOf } from './UserAvatar';
import {
  CATEGORY_PARTS,
  makeRng,
  parseMascot,
  randomMascot,
  resolveMascot,
  seedMascot,
  serializeMascot,
  type MascotCategory,
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
    }).toEqual({ h: 16, g: 8, e: 8, p: 16, b: 10 });
  });

  it('refuses anything that is not a valid v1 code', () => {
    for (const bad of ['', 'v2.h1.g0.e0.p0.b0', 'v1.h1.g0.e0.p0', 'v1.h16.g0.e0.p0.b0', 'v1.g0.h1.e0.p0.b0', 'v1.h1.g0.e0.p0.b0.x', 'nonsense']) {
      expect(parseMascot(bad)).toBeNull();
    }
    expect(parseMascot(null)).toBeNull();
    expect(parseMascot('v1.h15.g7.e7.p15.b9')).toEqual({ hat: 15, eyewear: 7, expression: 7, prop: 15, background: 9 });
  });
});

describe('automatic orcas', () => {
  it('gives the same id the same orca, for ever', () => {
    expect(seedMascot(4321)).toEqual(seedMascot(4321));
    expect(seedMascot('4321')).toEqual(seedMascot(4321));
  });

  it('spreads students across every part', () => {
    const seen: Record<MascotCategory, Set<number>> = {
      hat: new Set(), eyewear: new Set(), expression: new Set(), prop: new Set(), background: new Set(),
    };
    for (let id = 1; id <= 3000; id++) {
      const c = seedMascot(id);
      (Object.keys(seen) as MascotCategory[]).forEach((k) => seen[k].add(c[k]));
    }
    (Object.keys(seen) as MascotCategory[]).forEach((k) => expect(seen[k].size).toBe(CATEGORY_PARTS[k].length));
  });

  it('prefers the saved look, falling back to the automatic one', () => {
    expect(resolveMascot('v1.h5.g0.e2.p14.b5', 9)).toEqual({ hat: 5, eyewear: 0, expression: 2, prop: 14, background: 5 });
    expect(resolveMascot('garbage', 9)).toEqual(seedMascot(9));
    expect(resolveMascot(null, 9)).toEqual(seedMascot(9));
  });
});

describe('presets', () => {
  it('are all valid, named once, and distinct looks', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(40);
    const names = new Set(PRESETS.map((p) => p.name));
    const codes = new Set(PRESETS.map((p) => serializeMascot(p.config)));
    expect(names.size).toBe(PRESETS.length);
    expect(codes.size).toBe(PRESETS.length);
    PRESETS.forEach((p) => expect(parseMascot(serializeMascot(p.config))).toEqual(p.config));
  });
});

describe('drawing', () => {
  it('renders every part of every layer', () => {
    const base = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0 };
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

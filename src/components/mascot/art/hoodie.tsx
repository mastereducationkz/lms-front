/**
 * Master hoodies: «Master hoodie» (owner, 2026-10-04 — brand blue, white emblem) and the legendary
 * «Gold Master hoodie» (achievement reward — midnight navy, gold trim, gold emblem with a glow).
 * One cut for both; the free one renders exactly as it always has.
 */
import type { ReactNode } from 'react';
import { BODY_PATH } from './base';
import type { Piece } from './hats';
import { BRAND_BLUE, MasterMark } from './MasterMark';

interface HoodieStyle {
  fabric: string;
  shade: string;
  light: string;
  edge: string;
  strings: string;
  mark: string;
  /** Legendary extras: a gold piping line, a glow behind the emblem and sparkles. */
  extra?: (uid: string) => ReactNode;
  markGlow?: string;
}

function makeHoodie(s: HoodieStyle): Piece {
  return {
    // the hood covers the back, so the dorsal fin is tucked away
    noDorsal: true,
    back: () => (
      <g>
        {/* the hood, up: a soft peak at the crown, a centre seam, darker inside where the head sits */}
        <path d="M18 162 C 8 96 44 40 100 32 C 156 40 192 96 182 162 Z" fill={s.fabric} stroke={s.edge} strokeWidth="4" strokeLinejoin="round" />
        <path d="M32 158 C 26 104 58 52 100 48 C 142 52 174 104 168 158 Z" fill={s.shade} />
        <path d="M100 34 L100 48" stroke={s.shade} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    ),
    front: (uid) => (
      <g>
        <clipPath id={`${uid}hoodie`}>
          <path d={BODY_PATH} />
        </clipPath>
        <g clipPath={`url(#${uid}hoodie)`}>
          <path d="M0 214 L0 166 Q36 150 72 158 Q100 166 128 158 Q164 150 200 166 L200 214 Z" fill={s.fabric} />
          <path d="M2 170 Q36 155 72 162" stroke={s.light} strokeWidth="3" fill="none" opacity="0.8" />
        </g>
        <path d="M58 160 Q100 178 142 160" stroke={s.shade} strokeWidth="7" fill="none" strokeLinecap="round" />
        <g stroke={s.strings} strokeWidth="2.6" strokeLinecap="round" fill="none">
          <path d="M80 168 Q78 176 79 184" />
          <path d="M120 168 Q122 176 121 184" />
        </g>
        <rect x="76.5" y="183" width="5" height="7" rx="2" fill={s.strings} />
        <rect x="118.5" y="183" width="5" height="7" rx="2" fill={s.strings} />
        {s.markGlow && <circle cx="100" cy="185" r="17" fill={s.markGlow} opacity="0.35" />}
        <MasterMark x={100} y={185} size={26} color={s.mark} />
        {s.extra?.(uid)}
      </g>
    ),
  };
}

export const masterHoodie: Piece = makeHoodie({
  fabric: BRAND_BLUE, shade: '#1D4ED8', light: '#3B82F6', edge: '#fff', strings: '#fff', mark: '#fff',
});

const GOLD = '#FFC531';

function Glint({ x, y, r }: { x: number; y: number; r: number }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill="#FFF6C8" />;
}

export const goldMasterHoodie: Piece = makeHoodie({
  fabric: '#1E2A6E',
  shade: '#141C4F',
  light: '#3A4CA8',
  edge: GOLD,
  strings: GOLD,
  mark: GOLD,
  markGlow: '#FFD84D',
  extra: () => (
    <g>
      {/* gold piping along the neckline */}
      <path d="M58 156 Q100 174 142 156" stroke={GOLD} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Glint x={122} y={176} r={4.5} />
      <Glint x={76} y={196} r={3} />
    </g>
  ),
});

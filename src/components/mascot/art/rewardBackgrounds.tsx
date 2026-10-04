/**
 * Reward backgrounds (achievements), appended after the free ones in contract order:
 * Sparkle (b11), Sunrise (b12), Aurora (b13 — legendary).
 */
import type { ReactNode } from 'react';

type Bg = (uid: string) => ReactNode;

function Glint({ x, y, r, fill = '#fff', opacity = 1 }: { x: number; y: number; r: number; fill?: string; opacity?: number }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} opacity={opacity} />;
}

/** Seeded positions, so a background looks the same on every render. */
function scatter(n: number, seed: number, yMax = 120) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: 8 + rnd() * 184, y: 6 + rnd() * yMax, r: rnd() }));
}

export const REWARD_BACKGROUNDS: Bg[] = [
  // Sparkle — deep violet with gold and white glitter (Hello, Kasatik)
  (uid) => (
    <g>
      <radialGradient id={`${uid}bg`} cx="0.5" cy="0.35" r="0.8">
        <stop offset="0" stopColor="#7C5CFF" />
        <stop offset="1" stopColor="#3A1F9E" />
      </radialGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      {scatter(16, 11, 140).map((p, i) => (
        <Glint key={i} x={p.x} y={p.y} r={2 + p.r * 5} fill={i % 3 ? '#fff' : '#FFD84D'} opacity={0.55 + p.r * 0.45} />
      ))}
    </g>
  ),
  // Sunrise — warm dawn over a horizon, soft rays (Early Bird)
  (uid) => (
    <g>
      <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8EC5FF" />
        <stop offset="0.45" stopColor="#FFC2A8" />
        <stop offset="1" stopColor="#FF8A65" />
      </linearGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      <g fill="#FFF3C4" opacity="0.35">
        {[-60, -35, -12, 12, 35, 60].map((deg) => (
          <path key={deg} d="M100 150 L94 40 L106 40 Z" transform={`rotate(${deg} 100 150)`} />
        ))}
      </g>
      <circle cx="100" cy="150" r="46" fill="#FFE27A" opacity="0.55" />
      <circle cx="100" cy="150" r="34" fill="#FFD35A" />
      <path d="M0 150 Q50 140 100 148 Q150 156 200 146 L200 200 L0 200 Z" fill="#FF9E7A" opacity="0.6" />
    </g>
  ),
  // Aurora — night sky with green-violet ribbons of light and stars (Streak 100, legendary)
  (uid) => (
    <g>
      <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#071A3A" />
        <stop offset="1" stopColor="#0E3B52" />
      </linearGradient>
      <linearGradient id={`${uid}au1`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#3DFFB0" stopOpacity="0" />
        <stop offset="0.5" stopColor="#3DFFB0" stopOpacity="0.85" />
        <stop offset="1" stopColor="#7B5CFF" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id={`${uid}au2`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#B26BFF" stopOpacity="0.1" />
        <stop offset="0.5" stopColor="#59D9FF" stopOpacity="0.75" />
        <stop offset="1" stopColor="#3DFFB0" stopOpacity="0" />
      </linearGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      {scatter(14, 23, 150).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={0.8 + p.r * 1.6} fill="#fff" opacity={0.5 + p.r * 0.5} />
      ))}
      <path d="M-10 70 C 30 30 70 100 110 56 C 140 26 170 60 210 34 L210 64 C 170 92 140 58 110 88 C 70 130 30 62 -10 102 Z" fill={`url(#${uid}au1)`} />
      <path d="M-10 112 C 40 82 80 132 120 100 C 150 78 180 104 210 86 L210 108 C 180 124 150 100 120 122 C 80 152 40 106 -10 132 Z" fill={`url(#${uid}au2)`} />
      <Glint x={30} y={24} r={4.5} fill="#E8FFF6" />
      <Glint x={172} y={20} r={3.5} fill="#E8FFF6" />
    </g>
  ),
];

/**
 * Master League season 2 «Studio» backgrounds (owner, 2026-11-02), appended after Breakthrough Dawn:
 * b16 Studio Booth (Every Session): a warm vocal booth, acoustic foam on the walls, the recording lamp
 * lit; b17 Stage Spotlight (Breakout Single): a dark stage, one spotlight cone, haze and gold flecks.
 */
import type { ReactNode } from 'react';
import { STUDIO } from './StudioEmblem';

type Bg = (uid: string) => ReactNode;

/** One acoustic foam tile: four wedges, lit from the top left. */
function Foam({ x, y, s }: { x: number; y: number; s: number }) {
  const h = s / 2;
  return (
    <g>
      <path d={`M${x} ${y} L${x + s} ${y} L${x + h} ${y + h} Z`} fill="#3B3530" />
      <path d={`M${x} ${y} L${x + h} ${y + h} L${x} ${y + s} Z`} fill="#332E2A" />
      <path d={`M${x + s} ${y} L${x + s} ${y + s} L${x + h} ${y + h} Z`} fill="#25211E" />
      <path d={`M${x} ${y + s} L${x + h} ${y + h} L${x + s} ${y + s} Z`} fill="#1E1B18" />
    </g>
  );
}

export const STUDIO_BACKGROUNDS: Bg[] = [
  // Studio Booth (Every Session)
  (uid) => {
    const tiles: [number, number][] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) tiles.push([col * 25, row * 25]);
    }
    return (
      <g>
        <radialGradient id={`${uid}bth`} cx="0.5" cy="0.18" r="0.8">
          <stop offset="0" stopColor="#FFD9A8" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#F08A4B" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <rect width="200" height="200" fill="#211D1A" />
        {tiles.map(([x, y]) => <Foam key={`${x}-${y}`} x={x} y={y} s={25} />)}
        <rect width="200" height="200" fill={`url(#${uid}bth)`} />
        {/* the recording lamp, lit */}
        <circle cx="160" cy="26" r="18" fill="#FF5A4E" opacity="0.22" />
        <rect x="145" y="19" width="30" height="14" rx="4" fill="#FF5A4E" stroke="#B8213A" strokeWidth="1.2" />
        <rect x="149" y="22" width="22" height="3" rx="1.5" fill="#fff" opacity="0.45" />
        {/* the pendant lamp over the mic spot */}
        <path d="M100 0 V18" stroke={STUDIO.ink} strokeWidth="2" />
        <path d="M88 30 Q100 16 112 30 Z" fill={STUDIO.gold} stroke={STUDIO.goldDark} strokeWidth="1" />
        <ellipse cx="100" cy="31" rx="7" ry="2.4" fill="#FFF6C8" />
        {/* a warm rug on the floor */}
        <path d="M0 176 Q100 166 200 176 L200 200 L0 200 Z" fill="#7A3A1A" opacity="0.85" />
        <path d="M0 182 Q100 172 200 182" stroke="#F08A4B" strokeWidth="1.6" fill="none" opacity="0.6" />
      </g>
    );
  },
  // Stage Spotlight (Breakout Single)
  (uid) => (
    <g>
      <linearGradient id={`${uid}stg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0E0A1A" />
        <stop offset="1" stopColor={STUDIO.purple} />
      </linearGradient>
      <linearGradient id={`${uid}cone`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF4D6" stopOpacity="0.75" />
        <stop offset="1" stopColor="#FFE08A" stopOpacity="0.18" />
      </linearGradient>
      <radialGradient id={`${uid}pool`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#FFF4D6" stopOpacity="0.9" />
        <stop offset="1" stopColor="#FFE08A" stopOpacity="0" />
      </radialGradient>
      <rect width="200" height="200" fill={`url(#${uid}stg)`} />
      {/* the cone from one lamp above, a pool of light on the stage floor */}
      <path d="M86 0 L114 0 L176 184 L24 184 Z" fill={`url(#${uid}cone)`} />
      <ellipse cx="100" cy="184" rx="86" ry="16" fill={`url(#${uid}pool)`} />
      <rect x="84" y="-6" width="32" height="12" rx="4" fill={STUDIO.ink} stroke={STUDIO.gold} strokeWidth="1.4" />
      {/* the stage edge */}
      <path d="M0 186 Q100 178 200 186 L200 200 L0 200 Z" fill="#0E0A1A" />
      <path d="M0 186 Q100 178 200 186" stroke={STUDIO.gold} strokeWidth="1.6" fill="none" opacity="0.8" />
      {/* haze and gold flecks */}
      {[[30, 40, 1.6], [168, 30, 1.3], [16, 112, 1.2], [184, 120, 1.6], [52, 150, 1.1], [150, 76, 1.2]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.7" />
      ))}
      {[[40, 70, 20], [162, 58, -30], [26, 160, 45], [176, 150, -15]].map(([x, y, a]) => (
        <rect key={`c${x}`} x={x - 3} y={y - 1.5} width="6" height="3" rx="0.8" fill={STUDIO.gold} transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </g>
  ),
];

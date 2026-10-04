/** Hats & outfits, one per HATS entry. `back` draws behind the orca, `front` over its face. */
import type { ReactNode } from 'react';
import { BODY_PATH } from './base';

export interface Piece {
  back?: (uid: string) => ReactNode;
  front?: (uid: string) => ReactNode;
  /** Hide the dorsal fin (it would poke through a helmet). */
  noDorsal?: boolean;
}

const GOLD = '#FFC531';
const GOLD_DARK = '#E39A00';

function Star5({ x, y, r, fill = '#FFE066' }: { x: number; y: number; r: number; fill?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

/** A head-hugging cap dome (covers the top of the head down to `bottom`). */
const dome = (bottom: number, spread = 38, top = 46) =>
  `M${100 - spread} ${bottom} C ${100 - spread} ${top} ${100 + spread} ${top} ${100 + spread} ${bottom} Q100 ${bottom - 8} ${100 - spread} ${bottom} Z`;

export const HAT_ART: Piece[] = [
  {},
  // graduate cap
  {
    front: () => (
      <g>
        <path d="M62 78 C 62 58 80 50 100 50 C 120 50 138 58 138 78 Q100 87 62 78 Z" fill="#2C3A63" />
        <polygon points="36,52 100,31 164,52 100,73" fill="#33467A" stroke="#5B72B3" strokeWidth="2" strokeLinejoin="round" />
        <polygon points="50,51 100,35 114,40 58,57" fill="#fff" opacity="0.12" />
        <path d="M100 52 L154 58 L156 84" stroke={GOLD} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <rect x="151" y="82" width="10" height="16" rx="3" fill={GOLD} />
        <circle cx="100" cy="52" r="3.6" fill={GOLD} />
      </g>
    ),
  },
  // headphones
  {
    front: () => (
      <g>
        <path d="M34 112 C 30 34 170 34 166 112" stroke="#FF5C8A" strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M40 90 C 44 48 156 48 160 90" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.5" strokeLinecap="round" />
        <rect x="20" y="94" width="25" height="38" rx="11" fill="#FF5C8A" />
        <rect x="41" y="100" width="8" height="26" rx="4" fill="#FFE1EA" />
        <rect x="155" y="94" width="25" height="38" rx="11" fill="#FF5C8A" />
        <rect x="151" y="100" width="8" height="26" rx="4" fill="#FFE1EA" />
        <ellipse cx="29" cy="104" rx="3" ry="6" fill="#fff" opacity="0.45" />
        <ellipse cx="164" cy="104" rx="3" ry="6" fill="#fff" opacity="0.45" />
      </g>
    ),
  },
  // astronaut — glass helmet, «1600» mission patch
  {
    noDorsal: true,
    front: (uid) => (
      <g>
        <radialGradient id={`${uid}glass`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#BFE3FF" stopOpacity="0.08" />
        </radialGradient>
        <circle cx="100" cy="110" r="76" fill={`url(#${uid}glass)`} stroke="#EEF3FB" strokeWidth="7" />
        <path d="M44 82 A62 62 0 0 1 88 42" stroke="#fff" strokeWidth="6" fill="none" opacity="0.75" strokeLinecap="round" />
        <circle cx="38" cy="98" r="3.5" fill="#fff" opacity="0.75" />
        <path d="M30 172 Q100 200 170 172 L172 192 Q100 222 28 192 Z" fill="#E9EEF6" stroke="#C3CEE0" strokeWidth="2" />
        <rect x="82" y="181" width="36" height="15" rx="4" fill="#1F57F5" />
        <text x="100" y="192.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="Arial, Helvetica, sans-serif">1600</text>
      </g>
    ),
  },
  // superhero cape
  {
    back: () => (
      <g>
        <path d="M46 128 C 18 158 8 190 2 214 L198 214 C 192 190 182 158 154 128 Q100 146 46 128 Z" fill="#E8364F" />
        <path d="M30 168 C 24 186 20 200 18 214 M170 168 C 176 186 180 200 182 214" stroke="#B8213A" strokeWidth="4" fill="none" />
      </g>
    ),
    front: () => (
      <g>
        <path d="M40 152 Q100 180 160 152" stroke="#E8364F" strokeWidth="6" fill="none" strokeLinecap="round" />
        <circle cx="44" cy="153" r="6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.5" />
        <circle cx="156" cy="153" r="6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.5" />
        <circle cx="100" cy="190" r="15" fill="#E8364F" />
        <Star5 x={100} y={191} r={10} fill="#FFE066" />
      </g>
    ),
  },
  // crown
  {
    front: (uid) => (
      <g transform="rotate(-6 100 60)">
        <linearGradient id={`${uid}gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE680" />
          <stop offset="1" stopColor="#F2A400" />
        </linearGradient>
        <path d="M66 76 L60 38 L82 56 L100 30 L118 56 L140 38 L134 76 Z" fill={`url(#${uid}gold)`} stroke={GOLD_DARK} strokeWidth="2" strokeLinejoin="round" />
        <rect x="64" y="64" width="72" height="13" rx="3" fill="#F2A400" />
        <circle cx="100" cy="70.5" r="4.5" fill="#FF4D6D" />
        <circle cx="80" cy="70.5" r="3.2" fill="#4DA3FF" />
        <circle cx="120" cy="70.5" r="3.2" fill="#4DA3FF" />
        <circle cx="60" cy="38" r="4" fill="#FFE680" />
        <circle cx="100" cy="30" r="4.5" fill="#FFE680" />
        <circle cx="140" cy="38" r="4" fill="#FFE680" />
      </g>
    ),
  },
  // wizard hat
  {
    front: (uid) => (
      <g>
        <linearGradient id={`${uid}wiz`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8E63FF" />
          <stop offset="1" stopColor="#4A22C4" />
        </linearGradient>
        <path d="M54 72 C 76 52 92 24 124 4 C 116 32 126 54 146 72 Z" fill={`url(#${uid}wiz)`} />
        <ellipse cx="100" cy="72" rx="60" ry="11" fill="#5B30E0" />
        <path d="M58 66 Q100 76 142 66 L144 72 Q100 82 56 72 Z" fill={GOLD} />
        <Star5 x={104} y={44} r={6} />
        <Star5 x={118} y={24} r={4} fill="#fff" />
        <path d="M86 58 A6 6 0 1 0 92 50 A4.5 4.5 0 1 1 86 58 Z" fill="#FFE066" />
      </g>
    ),
  },
  // detective deerstalker
  {
    front: (uid) => (
      <g>
        <clipPath id={`${uid}deer`}>
          <path d={dome(80, 47, 42)} />
        </clipPath>
        <path d={dome(80, 47, 42)} fill="#B07A44" />
        <g clipPath={`url(#${uid}deer)`} stroke="#8A5A2E" strokeWidth="3" opacity="0.8">
          <path d="M70 40 L70 90 M86 40 L86 90 M102 40 L102 90 M118 40 L118 90 M134 40 L134 90" />
          <path d="M50 58 L150 58 M50 70 L150 70" />
        </g>
        <path d="M58 78 Q100 100 142 78 Q100 86 58 78 Z" fill="#8A5A2E" />
        <path d="M90 48 Q100 40 110 48 M92 44 L100 50 L108 44" stroke="#6B4423" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>
    ),
  },
  // ninja headband
  {
    front: (uid) => (
      <g>
        <clipPath id={`${uid}band`}>
          <path d={BODY_PATH} />
        </clipPath>
        <path d="M20 84 Q100 64 180 84 L180 97 Q100 77 20 97 Z" fill="#E5383B" clipPath={`url(#${uid}band)`} />
        <path d="M20 88 Q100 69 180 88" stroke="#fff" strokeWidth="1.6" opacity="0.45" fill="none" clipPath={`url(#${uid}band)`} />
        <path d="M150 84 C 164 76 176 72 190 74 C 182 80 174 84 164 88 Z" fill="#E5383B" />
        <path d="M150 88 C 164 92 174 100 184 112 C 172 108 162 102 154 96 Z" fill="#C81E2B" />
        <circle cx="152" cy="87" r="5.5" fill="#C81E2B" />
      </g>
    ),
  },
  // pirate hat with an anchor
  {
    front: () => (
      <g>
        <path d="M30 80 C 44 44 72 50 100 26 C 128 50 156 44 170 80 C 134 64 66 64 30 80 Z" fill="#4A3426" />
        <path d="M30 80 C 66 64 134 64 170 80" stroke={GOLD} strokeWidth="4" fill="none" strokeLinecap="round" />
        <g stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round">
          <circle cx="100" cy="44" r="3.2" />
          <path d="M100 47 L100 64 M93 52 L107 52 M90 58 Q100 70 110 58" />
        </g>
      </g>
    ),
  },
  // party hat
  {
    front: (uid) => (
      <g transform="rotate(14 100 66)">
        <clipPath id={`${uid}party`}>
          <path d="M76 68 L100 10 L124 68 Z" />
        </clipPath>
        <path d="M76 68 L100 10 L124 68 Z" fill="#FF5C8A" />
        <g clipPath={`url(#${uid}party)`} stroke="#FFD84D" strokeWidth="7">
          <path d="M70 30 L130 50 M70 50 L130 70 M70 10 L130 30" />
        </g>
        <circle cx="100" cy="10" r="8" fill="#7FE0FF" />
        <circle cx="97" cy="7" r="2.5" fill="#fff" opacity="0.7" />
      </g>
    ),
  },
  // тақия — Kazakh skullcap with a gold ram-horn band
  {
    front: () => (
      <g>
        <path d={dome(80, 48, 38)} fill="#A31D36" />
        <path d="M56 76 Q100 65 144 76" stroke={GOLD} strokeWidth="2.4" fill="none" />
        <g stroke={GOLD} strokeWidth="2.2" fill="none" strokeLinecap="round">
          <path d="M66 72 c -2 -6 5 -8 6 -3 M80 68 c -2 -6 5 -8 6 -3 M94 66 c -2 -6 5 -8 6 -3 M108 66 c -2 -6 5 -8 6 -3 M122 68 c -2 -6 5 -8 6 -3 M136 72 c -2 -6 5 -8 6 -3" />
          <path d="M100 54 c -7 -2 -10 -10 -5 -12 c 3 -1 4 3 2 4 M100 54 c 7 -2 10 -10 5 -12 c -3 -1 -4 3 -2 4" />
        </g>
        <ellipse cx="86" cy="56" rx="9" ry="4" fill="#fff" opacity="0.14" transform="rotate(-20 86 56)" />
      </g>
    ),
  },
  // beanie & scarf
  {
    front: (uid) => (
      <g>
        <clipPath id={`${uid}beanie`}>
          <path d="M52 86 C 52 40 148 40 148 86 Z" />
        </clipPath>
        <path d="M52 86 C 52 40 148 40 148 86 Z" fill="#FF8A3D" />
        <g clipPath={`url(#${uid}beanie)`} stroke="#FFD166" strokeWidth="6">
          <path d="M50 58 L150 58 M50 70 L150 70" />
        </g>
        <path d="M49 80 Q100 70 151 80 L152 94 Q100 85 48 94 Z" fill="#E8692A" />
        <g stroke="#C9531D" strokeWidth="1.6">
          <path d="M58 80 L58 91 M70 78 L70 89 M82 77 L82 88 M94 76 L94 87 M106 76 L106 87 M118 77 L118 88 M130 78 L130 89 M142 80 L142 91" />
        </g>
        <circle cx="100" cy="38" r="11" fill="#FFD166" />
        <circle cx="96" cy="35" r="3" fill="#fff" opacity="0.5" />
        <clipPath id={`${uid}scarf`}>
          <path d={BODY_PATH} />
        </clipPath>
        <path d="M10 160 Q100 184 190 160 L190 178 Q100 202 10 178 Z" fill="#2EC4B6" clipPath={`url(#${uid}scarf)`} />
        <path d="M10 167 Q100 191 190 167" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" clipPath={`url(#${uid}scarf)`} />
        <path d="M128 176 L146 176 L150 212 L130 212 Z" fill="#26A89C" />
        <path d="M132 196 L148 196" stroke="#fff" strokeWidth="3" opacity="0.7" />
      </g>
    ),
  },
  // nightcap
  {
    front: () => (
      <g>
        <path d="M56 82 C 58 48 96 36 124 42 C 154 48 174 76 180 108 C 164 90 152 80 144 82 Q100 70 56 82 Z" fill="#3E5BD9" />
        <g fill="#fff" opacity="0.9">
          <circle cx="96" cy="58" r="2.2" />
          <circle cx="122" cy="56" r="2.6" />
          <circle cx="146" cy="70" r="2.2" />
          <circle cx="110" cy="70" r="1.8" />
        </g>
        <path d="M52 82 Q100 68 148 82 L148 92 Q100 78 52 92 Z" fill="#fff" />
        <circle cx="180" cy="110" r="9" fill="#fff" />
      </g>
    ),
  },
  // backwards cap
  {
    front: () => (
      <g>
        <path d="M70 54 Q100 34 130 54 Q100 45 70 54 Z" fill="#118F76" />
        <path d={dome(82, 46, 42)} fill="#19C2A0" />
        <path d="M86 82 Q100 63 114 82 Z" fill="#1B2236" />
        <rect x="83" y="79" width="34" height="5" rx="2" fill="#fff" />
        <circle cx="100" cy="47" r="3.5" fill="#118F76" />
        <ellipse cx="82" cy="62" rx="9" ry="4" fill="#fff" opacity="0.18" transform="rotate(-25 82 62)" />
      </g>
    ),
  },
  // rockstar bandana
  {
    front: (uid) => (
      <g>
        <clipPath id={`${uid}bandana`}>
          <path d="M50 90 C 48 44 152 44 150 90 Q100 77 50 90 Z" />
        </clipPath>
        <path d="M50 90 C 48 44 152 44 150 90 Q100 77 50 90 Z" fill="#4C6FFF" />
        <g clipPath={`url(#${uid}bandana)`} fill="#fff">
          {[[66, 64], [86, 56], [106, 54], [126, 58], [142, 70], [76, 78], [96, 70], [116, 70], [134, 82], [60, 84]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" />
          ))}
        </g>
        <path d="M148 82 C 162 74 174 72 186 76 C 178 82 168 86 158 90 Z" fill="#4C6FFF" />
        <path d="M148 86 C 160 92 168 100 174 112 C 164 106 156 100 150 94 Z" fill="#3653D9" />
        <circle cx="150" cy="86" r="5" fill="#3653D9" />
      </g>
    ),
  },
];

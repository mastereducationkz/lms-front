/** Eyewear, one per EYEWEAR entry, centred on the eyes. Frames are bright so they read on black. */
import type { ReactNode } from 'react';
import { BODY_PATH, EYE_L, EYE_R } from './base';

const EYES = [EYE_L, EYE_R];

function heart(x: number, y: number, s: number) {
  return `M${x} ${y + s * 0.9} C ${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.9} ${y - s * 1.3} ${x} ${y - s * 0.45} C ${x + s * 0.9} ${y - s * 1.3} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9} Z`;
}

function star(x: number, y: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.5;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const Temples = ({ color, y = 104 }: { color: string; y?: number }) => (
  <path d={`M${EYE_L.x - 15} ${y} L46 ${y - 6} M${EYE_R.x + 15} ${y} L154 ${y - 6}`} stroke={color} strokeWidth="3.2" strokeLinecap="round" />
);

export const EYEWEAR_ART: ((uid: string) => ReactNode)[] = [
  () => null,
  // round glasses
  () => (
    <g>
      <Temples color="#FFC531" />
      {EYES.map((e) => (
        <circle key={e.x} cx={e.x} cy={e.y} r="15" fill="#fff" fillOpacity="0.14" stroke="#FFC531" strokeWidth="3.8" />
      ))}
      <path d="M92 104 Q100 98 108 104" stroke="#FFC531" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </g>
  ),
  // sunglasses
  (uid) => (
    <g>
      <linearGradient id={`${uid}shade`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3B2F8F" />
        <stop offset="1" stopColor="#0E1230" />
      </linearGradient>
      <Temples color="#fff" y={100} />
      {EYES.map((e) => (
        <path
          key={e.x}
          d={`M${e.x - 17} ${e.y - 9} L${e.x + 17} ${e.y - 9} Q${e.x + 18} ${e.y + 11} ${e.x + 3} ${e.y + 12} L${e.x - 3} ${e.y + 12} Q${e.x - 18} ${e.y + 11} ${e.x - 17} ${e.y - 9} Z`}
          fill={`url(#${uid}shade)`}
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      ))}
      <path d={`M${EYE_L.x + 17} ${EYE_L.y - 7} Q100 ${EYE_L.y - 11} ${EYE_R.x - 17} ${EYE_R.y - 7}`} stroke="#fff" strokeWidth="3" fill="none" />
      {EYES.map((e) => (
        <path key={`g${e.x}`} d={`M${e.x - 10} ${e.y - 4} L${e.x - 3} ${e.y - 4}`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
      ))}
    </g>
  ),
  // star glasses
  () => (
    <g>
      <Temples color="#FF5CA8" />
      {EYES.map((e) => (
        <polygon key={e.x} points={star(e.x, e.y + 1, 19)} fill="#FFD6EC" fillOpacity="0.4" stroke="#FF5CA8" strokeWidth="3.4" strokeLinejoin="round" />
      ))}
      <path d="M94 104 L106 104" stroke="#FF5CA8" strokeWidth="3.4" strokeLinecap="round" />
    </g>
  ),
  // heart glasses
  () => (
    <g>
      <Temples color="#D81E5B" />
      {EYES.map((e) => (
        <path key={e.x} d={heart(e.x, e.y, 13)} fill="#FF4D7A" fillOpacity="0.9" stroke="#D81E5B" strokeWidth="2.6" strokeLinejoin="round" />
      ))}
      {EYES.map((e) => (
        <ellipse key={`h${e.x}`} cx={e.x - 6} cy={e.y - 5} rx="3.2" ry="2" fill="#fff" opacity="0.7" transform={`rotate(-30 ${e.x - 6} ${e.y - 5})`} />
      ))}
      <path d="M93 102 Q100 98 107 102" stroke="#D81E5B" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
  // monocle
  () => (
    <g>
      <circle cx={EYE_R.x} cy={EYE_R.y} r="15" fill="#fff" fillOpacity="0.15" stroke="#F2B705" strokeWidth="3.8" />
      <path d={`M${EYE_R.x + 10} ${EYE_R.y + 11} C 150 140 156 150 150 166`} stroke="#F2B705" strokeWidth="2" fill="none" strokeDasharray="3 2.5" />
    </g>
  ),
  // eyepatch
  () => (
    <g>
      <path d="M58 96 L34 82 M90 98 L152 80" stroke="#8B5A33" strokeWidth="3.4" strokeLinecap="round" />
      <ellipse cx={EYE_L.x} cy={EYE_L.y} rx="15" ry="13" fill="#0B0F1C" stroke="#4A5470" strokeWidth="1.6" />
      <ellipse cx={EYE_L.x - 4} cy={EYE_L.y - 5} rx="4" ry="2" fill="#fff" opacity="0.18" />
    </g>
  ),
  // goggles
  (uid) => (
    <g>
      <linearGradient id={`${uid}gog`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#7DF9FF" />
        <stop offset="1" stopColor="#7B5CFF" />
      </linearGradient>
      <clipPath id={`${uid}strap`}>
        <path d={BODY_PATH} />
      </clipPath>
      <rect x="10" y="100" width="180" height="13" fill="#FF8A3D" clipPath={`url(#${uid}strap)`} />
      <rect x="55" y="91" width="90" height="34" rx="15" fill="#2B2F45" stroke="#fff" strokeWidth="2.6" />
      <rect x="60" y="96" width="37" height="24" rx="11" fill={`url(#${uid}gog)`} />
      <rect x="103" y="96" width="37" height="24" rx="11" fill={`url(#${uid}gog)`} />
      <path d="M66 103 L76 99 M109 103 L119 99" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity="0.85" />
    </g>
  ),
];

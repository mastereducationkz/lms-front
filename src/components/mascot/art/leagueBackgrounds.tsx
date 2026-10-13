/**
 * Master League backgrounds (owner, 2026-10-13), appended after Aurora: b14 Stadium Lights, the
 * floodlit night of a final: crossing beams, two light rigs, bokeh, a faint pitch at the bottom;
 * and from phase 2 b15 Breakthrough Dawn: the night sky cracks and a gold sunrise comes through.
 */
import type { ReactNode } from 'react';
import { LEAGUE } from './LeagueCrest';

type Bg = (uid: string) => ReactNode;

function Rig({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  const lamps = [-9, 0, 9];
  return (
    <g transform={`translate(${x} ${y}) rotate(${flip ? 14 : -14})`}>
      <rect x="-15" y="-7" width="30" height="14" rx="3" fill="#1B2A5E" stroke="#3B4F94" strokeWidth="1" />
      {lamps.map((dx) => (
        <g key={dx}>
          <circle cx={dx} cy="0" r="7.5" fill="#FFF6C8" opacity="0.22" />
          <circle cx={dx} cy="0" r="3.4" fill="#FFFBE6" />
        </g>
      ))}
    </g>
  );
}

export const LEAGUE_BACKGROUNDS: Bg[] = [
  // Stadium Lights (Ever-Present)
  (uid) => (
    <g>
      <linearGradient id={`${uid}bg`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={LEAGUE.night} />
        <stop offset="0.7" stopColor="#0E2A6B" />
        <stop offset="1" stopColor="#0B4A52" />
      </linearGradient>
      <linearGradient id={`${uid}beam`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFBE6" stopOpacity="0.42" />
        <stop offset="1" stopColor="#FFFBE6" stopOpacity="0.02" />
      </linearGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      {/* beams crossing over the pitch */}
      <path d="M34 36 L8 200 L124 200 Z" fill={`url(#${uid}beam)`} />
      <path d="M166 36 L192 200 L76 200 Z" fill={`url(#${uid}beam)`} />
      {/* bokeh */}
      {[[56, 20, 6, 0.18], [146, 14, 4.5, 0.16], [100, 40, 9, 0.1], [18, 86, 5, 0.14], [184, 92, 6, 0.14], [122, 66, 3.5, 0.2]].map(([x, y, r, o]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#FFF6C8" opacity={o} />
      ))}
      <Rig x={34} y={34} />
      <Rig x={166} y={34} flip />
      {/* the pitch, seen low: grass band, touchline, centre arc */}
      <path d="M0 150 Q100 138 200 150 L200 200 L0 200 Z" fill="#0E6B4A" opacity="0.7" />
      <path d="M0 150 Q100 138 200 150" stroke="#fff" strokeWidth="1.8" fill="none" opacity="0.5" />
      <path d="M52 200 Q100 150 148 200" stroke="#fff" strokeWidth="1.6" fill="none" opacity="0.28" />
      {/* a few stars above the roof line */}
      {[[84, 12], [120, 24], [70, 52], [150, 54]].map(([x, y]) => (
        <circle key={`s${x}`} cx={x} cy={y} r="1.1" fill="#fff" opacity="0.7" />
      ))}
    </g>
  ),
  // Breakthrough Dawn (Breakthrough): the night sky breaks along a jagged seam, gold light behind it
  (uid) => (
    <g>
      <radialGradient id={`${uid}dw`} cx="0.5" cy="0.62" r="0.8">
        <stop offset="0" stopColor="#FFF4BF" />
        <stop offset="0.3" stopColor={LEAGUE.goldHi} />
        <stop offset="0.62" stopColor={LEAGUE.gold} />
        <stop offset="1" stopColor="#F2833B" />
      </radialGradient>
      <linearGradient id={`${uid}nt`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={LEAGUE.night} />
        <stop offset="0.6" stopColor={LEAGUE.navy} />
        <stop offset="1" stopColor={LEAGUE.navy2} />
      </linearGradient>
      <linearGradient id={`${uid}ar`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#fff" />
      </linearGradient>
      <rect width="200" height="200" fill={`url(#${uid}dw)`} />
      {/* rays from a sun that is still below the horizon of the avatar */}
      <g fill="#fff" opacity="0.2">
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M100 118 L90 -20 L110 -20 Z" transform={`rotate(${i * 30 + 15} 100 118)`} />
        ))}
      </g>
      {/* the night, still hanging in the top left, with a jagged broken edge */}
      <path d="M-4 -4 L112 -4 L104 14 L116 24 L100 40 L110 58 L88 66 L92 84 L66 80 L52 98 L34 88 L-4 104 Z" fill={`url(#${uid}nt)`} />
      <path d="M112 -4 L104 14 L116 24 L100 40 L110 58 L88 66 L92 84 L66 80 L52 98 L34 88 L-4 104" stroke="#FFF4BF" strokeWidth="5" opacity="0.55" fill="none" strokeLinejoin="round" />
      <path d="M112 -4 L104 14 L116 24 L100 40 L110 58 L88 66 L92 84 L66 80 L52 98 L34 88 L-4 104" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
      {[[22, 20, 1.5], [48, 40, 1.1], [74, 14, 1.3], [30, 66, 1], [86, 44, 0.9], [60, 62, 1.1]].map(([x, y, r]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.85" />
      ))}
      {/* an arrow of light rising out of the crack */}
      <g>
        <path d="M152 62 L152 36 M141 47 L152 32 L163 47" stroke="#FFF4BF" strokeWidth="9" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M152 62 L152 36 M141 47 L152 32 L163 47" stroke={`url(#${uid}ar)`} strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {[[145, 70, 1.8], [159, 74, 1.4], [152, 80, 1.1]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#fff" opacity="0.8" />
        ))}
      </g>
    </g>
  ),
];

/**
 * Master League background (owner, 2026-10-13), appended after Aurora: b14 Stadium Lights, the
 * floodlit night of a final: crossing beams, two light rigs, bokeh, a faint pitch at the bottom.
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
];

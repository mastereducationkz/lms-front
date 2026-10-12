/**
 * The League Crest frame (owner, 2026-10-13), f5: a navy ring with a gold edge and twelve little
 * floodlights, the crest hanging at the bottom. Drawn in the margin the Orca adds when a frame is
 * worn (FRAME_PAD). The ring is a rarity signal: navy + gold reads even at 32 px.
 */
import type { ReactNode } from 'react';
import { LEAGUE, LeagueCrest } from './LeagueCrest';

const C = 100;

export function leagueCrestFrame(uid: string): ReactNode {
  const lights = Array.from({ length: 12 }, (_, i) => {
    const deg = i * 30 - 90;
    const a = (deg * Math.PI) / 180;
    return { x: C + 106 * Math.cos(a), y: C + 106 * Math.sin(a), key: i };
  }).filter((p) => p.key !== 6); // the crest hangs where the bottom light would be
  return (
    <g>
      <linearGradient id={`${uid}lcr`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={LEAGUE.sky} />
        <stop offset="0.45" stopColor={LEAGUE.navy2} />
        <stop offset="1" stopColor={LEAGUE.navy} />
      </linearGradient>
      <circle cx={C} cy={C} r="114" fill="none" stroke={LEAGUE.gold} strokeWidth="3.4" />
      <circle cx={C} cy={C} r="106.5" fill="none" stroke={`url(#${uid}lcr)`} strokeWidth="11" />
      <circle cx={C} cy={C} r="100.8" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
      {lights.map((p) => (
        <g key={p.key}>
          <circle cx={p.x} cy={p.y} r="4.6" fill="#FFF6C8" opacity="0.3" />
          <circle cx={p.x} cy={p.y} r="2.5" fill={p.key % 3 === 0 ? '#FFFFFF' : LEAGUE.goldHi} />
        </g>
      ))}
      <LeagueCrest x={C} y={202} size={26} />
    </g>
  );
}

/**
 * Master League frames (owner, 2026-10-13), drawn in the margin the Orca adds when a frame is worn
 * (FRAME_PAD). Both are rarity signals that read even at 32 px.
 * f5 League Crest: a navy ring with a gold edge and twelve little floodlights, the crest hanging at the bottom.
 * f6 1500 Club (phase 2, the rarest): a solid gold ring with a navy channel, laurel sprigs and a «1500» plaque.
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

const at = (deg: number, r: number) => ({ x: C + r * Math.cos((deg * Math.PI) / 180), y: C + r * Math.sin((deg * Math.PI) / 180) });

/** One laurel leaf of the sprig: a pointed almond lying along the ring, turned `lean` degrees off it. */
function Leaf({ deg, r, lean }: { deg: number; r: number; lean: number }) {
  const p = at(deg, r);
  return (
    <path
      d="M0 -8.4 C 4.4 -4.6 4.4 4.4 0 8.4 C -4.4 4.4 -4.4 -4.6 0 -8.4 Z"
      transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(deg + lean).toFixed(1)})`}
      fill={LEAGUE.gold}
      stroke={LEAGUE.navy}
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  );
}

/** «1500» in four strokes a digit, so it draws the same on every device (no font to load). */
function Digits({ x, y }: { x: number; y: number }) {
  const five = (dx: number) =>
    `M${dx + 6.2} ${y} H${dx + 1.4} L${dx + 0.9} ${y + 4.3} C${dx + 2.2} ${y + 3.4} ${dx + 3.8} ${y + 3.2} ${dx + 5} ${y + 3.9} C${dx + 6.8} ${y + 4.9} ${dx + 6.8} ${y + 8.1} ${dx + 4.8} ${y + 9.1} C${dx + 3.4} ${y + 9.7} ${dx + 1.7} ${y + 9.3} ${dx + 0.6} ${y + 8.3}`;
  return (
    <g stroke={LEAGUE.goldHi} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d={`M${x + 1.2} ${y + 2.6} L${x + 4} ${y} V${y + 9.4}`} />
      <path d={five(x + 10)} />
      <ellipse cx={x + 24.5} cy={y + 4.7} rx="3.1" ry="4.6" />
      <ellipse cx={x + 34.5} cy={y + 4.7} rx="3.1" ry="4.6" />
    </g>
  );
}

export function club1500Frame(uid: string): ReactNode {
  const sprig = [14, 25, 36, 47, 58, 69];
  const studs = Array.from({ length: 24 }, (_, i) => i * 15 - 90).filter((d) => (d > -80 && d < 60) || (d > 120 && d < 260));
  return (
    <g>
      <linearGradient id={`${uid}c15`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF1A8" />
        <stop offset="0.4" stopColor={LEAGUE.gold} />
        <stop offset="1" stopColor={LEAGUE.goldDark} />
      </linearGradient>
      <linearGradient id={`${uid}c15p`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFE07A" />
        <stop offset="1" stopColor="#E3A008" />
      </linearGradient>
      {/* the ring: gold, with a navy channel down its middle, a thin navy edge round the outside */}
      <circle cx={C} cy={C} r="114.4" fill="none" stroke={LEAGUE.navy} strokeWidth="2.6" />
      <circle cx={C} cy={C} r="107.4" fill="none" stroke={`url(#${uid}c15)`} strokeWidth="11" />
      <circle cx={C} cy={C} r="107.4" fill="none" stroke={LEAGUE.navy} strokeWidth="4.2" />
      <circle cx={C} cy={C} r="101" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
      {studs.map((d) => {
        const p = at(d, 107.4);
        return <circle key={d} cx={p.x} cy={p.y} r="1.15" fill={LEAGUE.goldHi} />;
      })}
      {/* laurel sprigs climbing both sides from the plaque */}
      {sprig.map((a, i) => (
        <g key={a}>
          <Leaf deg={90 + 14 + a} r={i % 2 ? 110 : 104.6} lean={i % 2 ? 32 : -32} />
          <Leaf deg={90 - 14 - a} r={i % 2 ? 110 : 104.6} lean={i % 2 ? -32 : 32} />
        </g>
      ))}
      {/* the jewel at the top */}
      <path d="M100 -13 L108 -4.5 L100 5 L92 -4.5 Z" fill={`url(#${uid}c15p)`} stroke={LEAGUE.navy} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M96.4 -6 L100 -10.4 L103.6 -6" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.9" />
      {/* the plaque */}
      <rect x="74" y="190.6" width="52" height="24.4" rx="7" fill={`url(#${uid}c15p)`} stroke={LEAGUE.navy} strokeWidth="1.6" />
      <rect x="78" y="194.6" width="44" height="16.8" rx="4.5" fill={LEAGUE.navy} />
      <Digits x={81.3} y={198.2} />
      <path d="M80 197 H112" stroke="#fff" strokeWidth="0.9" opacity="0.28" strokeLinecap="round" />
      <path d="M33 21 L35.6 28 L42.6 30.6 L35.6 33.2 L33 40.2 L30.4 33.2 L23.4 30.6 L30.4 28 Z" fill="#fff" opacity="0.95" />
      <path d="M182 50 L183.8 54.4 L188.2 56 L183.8 57.6 L182 62 L180.2 57.6 L175.8 56 L180.2 54.4 Z" fill={LEAGUE.goldHi} />
    </g>
  );
}

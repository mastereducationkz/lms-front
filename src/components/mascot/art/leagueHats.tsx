/**
 * Master League hats & outfits (owner, 2026-10-13), appended after the gold-star cape:
 * h26 League Jersey (the kit, for joining the squad), h27 Hat-trick Topper (three lessons in a row),
 * and from phase 2 h28 Golden Laurel (a perfect 1600). Navy, gold and white — a notch richer than
 * the free parts, like every reward.
 */
import { BODY_PATH } from './base';
import type { Piece } from './hats';
import { LEAGUE, LeagueCrest } from './LeagueCrest';

function Glint({ x, y, r, fill = '#FFF6C8' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

function Star5({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} />;
}

/** A navy football kit over the chest: a V neck with gold ribbing, pinstripes, white-and-gold shoulder bands and the crest. */
const leagueJersey: Piece = {
  front: (uid) => (
    <g>
      <clipPath id={`${uid}jersey`}>
        <path d={BODY_PATH} />
      </clipPath>
      <linearGradient id={`${uid}jfab`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={LEAGUE.navy2} />
        <stop offset="1" stopColor={LEAGUE.navy} />
      </linearGradient>
      <g clipPath={`url(#${uid}jersey)`}>
        <path d="M0 214 L0 168 Q28 152 62 152 L100 190 L138 152 Q172 152 200 168 L200 214 Z" fill={`url(#${uid}jfab)`} />
        {[18, 36, 54, 72, 128, 146, 164, 182].map((x) => (
          <path key={x} d={`M${x} 160 L${x} 214`} stroke="#fff" strokeWidth="2.4" opacity="0.1" />
        ))}
        {/* shoulder bands */}
        <path d="M0 176 Q28 160 54 160" stroke="#fff" strokeWidth="4" fill="none" opacity="0.95" />
        <path d="M0 184 Q28 168 58 168" stroke={LEAGUE.gold} strokeWidth="3.4" fill="none" />
        <path d="M200 176 Q172 160 146 160" stroke="#fff" strokeWidth="4" fill="none" opacity="0.95" />
        <path d="M200 184 Q172 168 142 168" stroke={LEAGUE.gold} strokeWidth="3.4" fill="none" />
        {/* a faint chest hoop, like a kit's band */}
        <path d="M10 206 Q100 224 190 206" stroke={LEAGUE.blue} strokeWidth="9" fill="none" opacity="0.5" />
      </g>
      {/* V collar ribbing */}
      <path d="M62 152 L100 190 L138 152" stroke={LEAGUE.gold} strokeWidth="6.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M64 155 L100 188 L136 155" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
      <LeagueCrest x={72} y={193} size={21} />
      <Glint x={134} y={186} r={4.5} />
      <Glint x={162} y={178} r={3} />
    </g>
  ),
};

/** A small tilted top hat with a gold band and three stars: one for each lesson of the run. */
const hatTrickTopper: Piece = {
  front: (uid) => (
    <g transform="rotate(-11 98 62)">
      <linearGradient id={`${uid}tophat`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={LEAGUE.navy2} />
        <stop offset="0.55" stopColor={LEAGUE.navy} />
        <stop offset="1" stopColor={LEAGUE.night} />
      </linearGradient>
      {/* brim */}
      <ellipse cx="98" cy="64" rx="36" ry="8.5" fill={LEAGUE.night} />
      <ellipse cx="98" cy="62" rx="36" ry="8" fill={LEAGUE.navy2} stroke={LEAGUE.gold} strokeWidth="1.6" />
      {/* the stack */}
      <path d="M76 62 L79 24 Q98 18 117 24 L120 62 Q98 70 76 62 Z" fill={`url(#${uid}tophat)`} />
      <ellipse cx="98" cy="24" rx="19" ry="6.2" fill={LEAGUE.navy2} stroke={LEAGUE.gold} strokeWidth="1.2" />
      {/* gold band */}
      <path d="M77 52 Q98 60 119 52 L119.6 60 Q98 68 76.4 60 Z" fill={LEAGUE.gold} stroke={LEAGUE.goldDark} strokeWidth="1" strokeLinejoin="round" />
      {/* three stars: the hat-trick */}
      <Star5 x={87} y={38} r={5.2} fill={LEAGUE.gold} />
      <Star5 x={98} y={34} r={6.4} fill={LEAGUE.goldHi} />
      <Star5 x={109} y={38} r={5.2} fill={LEAGUE.gold} />
      <path d="M82 28 C 80 38 80 46 82 52" stroke="#fff" strokeWidth="3" opacity="0.25" fill="none" strokeLinecap="round" />
      <Glint x={122} y={20} r={4.5} />
    </g>
  ),
};

const LAUREL_RX = 59;
const LAUREL_RY = 48.5;

/** A point on the wreath's centre line: `a` degrees round the head from the top, to the left (−) or right (+). */
function wreathAt(a: number, rx = LAUREL_RX, ry = LAUREL_RY) {
  const r = (a * Math.PI) / 180;
  return { x: 100 + rx * Math.sin(r), y: 100 - ry * Math.cos(r) };
}

/** A pointed leaf on the branch at `a`, growing towards the top; `out` leans it away from the head, otherwise over it. */
function WreathLeaf({ a, out, size, fill }: { a: number; out: boolean; size: number; fill: string }) {
  const r = (a * Math.PI) / 180;
  const grow = a < 0 ? 1 : -1; // towards the top: the left branch grows with increasing angle, the right with decreasing
  const bend = (out ? 1 : -1) * (a < 0 ? -1 : 1) * 34;
  const heading = (Math.atan2(grow * LAUREL_RX * Math.cos(r), -grow * LAUREL_RY * Math.sin(r)) * 180) / Math.PI;
  const p = wreathAt(a, LAUREL_RX + (out ? 2 : -2), LAUREL_RY + (out ? 2 : -2));
  const k = size / 8;
  return (
    <path
      d="M0 -8 C 4.6 -4.4 4.6 4.2 0 8 C -4.6 4.2 -4.6 -4.4 0 -8 Z"
      transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${(heading + bend).toFixed(1)}) scale(${k})`}
      fill={fill}
      stroke={LEAGUE.goldDark}
      strokeWidth={0.9 / k}
      strokeLinejoin="round"
    />
  );
}

/** A gold laurel wreath worn as a crown, a tiny sunburst where the two branches meet: the perfect score. */
const goldenLaurel: Piece = {
  front: (uid) => {
    const angles = [66, 55, 44, 33, 22, 11];
    const burst: string[] = [];
    for (let i = 0; i < 16; i++) {
      const rr = i % 2 === 0 ? 11.6 : 5.2;
      const ang = (Math.PI / 8) * i - Math.PI / 2;
      burst.push(`${(100 + rr * Math.cos(ang)).toFixed(1)},${(46 + rr * Math.sin(ang)).toFixed(1)}`);
    }
    return (
      <g>
        <linearGradient id={`${uid}lau`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LEAGUE.goldHi} />
          <stop offset="0.55" stopColor={LEAGUE.gold} />
          <stop offset="1" stopColor="#E2A300" />
        </linearGradient>
        <radialGradient id={`${uid}sun`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor={LEAGUE.goldHi} />
          <stop offset="1" stopColor={LEAGUE.gold} />
        </radialGradient>
        {/* the branches, left and right of the top */}
        {[-1, 1].map((side) => {
          const from = wreathAt(side * 70);
          const to = wreathAt(side * 4);
          return (
            <path
              key={side}
              d={`M${from.x.toFixed(1)} ${from.y.toFixed(1)} A ${LAUREL_RX} ${LAUREL_RY} 0 0 ${side < 0 ? 1 : 0} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`}
              stroke={LEAGUE.goldDark}
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
        {/* leaves, in pairs along each branch, growing towards the sun */}
        {angles.map((a, i) => {
          const big = i < 2 ? 10.5 : 9.2;
          return [-1, 1].map((side) => (
            <g key={`${a}${side}`}>
              <WreathLeaf a={side * a} out size={big} fill={`url(#${uid}lau)`} />
              <WreathLeaf a={side * (a - 5.5)} out={false} size={7.4} fill={`url(#${uid}lau)`} />
            </g>
          ));
        })}
        {/* berries where the branches begin */}
        {[-1, 1].map((side) => {
          const p = wreathAt(side * 72);
          return (
            <g key={`b${side}`} fill={LEAGUE.gold} stroke={LEAGUE.goldDark} strokeWidth="0.9">
              <circle cx={p.x} cy={p.y + 1} r="2.8" />
              <circle cx={p.x - side * 3.6} cy={p.y + 4.6} r="2.2" />
            </g>
          );
        })}
        {/* the sunburst */}
        <polygon points={burst.join(' ')} fill={LEAGUE.gold} stroke={LEAGUE.goldDark} strokeWidth="1" strokeLinejoin="round" />
        <circle cx="100" cy="46" r="5.4" fill={`url(#${uid}sun)`} stroke={LEAGUE.goldDark} strokeWidth="0.9" />
        <Glint x={128} y={40} r={4.5} />
        <Glint x={68} y={50} r={3} />
      </g>
    );
  },
};

/** Appended after the gold-star cape (h26, h27, h28). */
export const LEAGUE_HATS: Piece[] = [leagueJersey, hatTrickTopper, goldenLaurel];

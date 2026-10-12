/**
 * Master League hats & outfits (owner, 2026-10-13), appended after the gold-star cape:
 * h26 League Jersey (the kit, for joining the squad), h27 Hat-trick Topper (three lessons in a row).
 * Navy, gold and white — a notch richer than the free parts, like every reward.
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

/** Appended after the gold-star cape (h26, h27). */
export const LEAGUE_HATS: Piece[] = [leagueJersey, hatTrickTopper];

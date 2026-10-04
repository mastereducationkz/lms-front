/**
 * Reward hats & outfits (achievements), appended after the free ones in contract order:
 * diamond crown, golden kalpak, explorer hat, warrior headband, quiz cap, light-garland scarf,
 * team scarf, gold-star cape. (The Gold Master hoodie lives with its free sibling in hoodie.tsx.)
 * Rewards look a notch richer than free parts: gold, gems, glints.
 */
import { BODY_PATH } from './base';
import type { Piece } from './hats';
import { BRAND_BLUE, MasterMark, MERCH_GOLD } from './MasterMark';

const GOLD = '#FFC531';
const GOLD_DARK = '#C98A00';

function Glint({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

function Star5({ x, y, r, fill = GOLD, stroke }: { x: number; y: number; r: number; fill?: string; stroke?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={stroke ? 1.2 : 0} strokeLinejoin="round" />;
}

/** A faceted diamond (the crown's gems). */
function Gem({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g>
      <path d={`M${x - s} ${y} L${x - s * 0.55} ${y - s * 0.7} L${x + s * 0.55} ${y - s * 0.7} L${x + s} ${y} L${x} ${y + s * 1.15} Z`} fill="#8FE3FF" stroke="#2E9BD6" strokeWidth="1.1" strokeLinejoin="round" />
      <path d={`M${x - s} ${y} L${x + s} ${y} M${x - s * 0.55} ${y - s * 0.7} L${x} ${y + s * 1.15} L${x + s * 0.55} ${y - s * 0.7}`} stroke="#2E9BD6" strokeWidth="0.8" fill="none" />
      <path d={`M${x - s * 0.45} ${y - s * 0.55} L${x - s * 0.1} ${y - s * 0.55} L${x - s * 0.5} ${y - s * 0.05} Z`} fill="#fff" opacity="0.85" />
    </g>
  );
}

const diamondCrown: Piece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}plat`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.5" stopColor="#D6E2F2" />
        <stop offset="1" stopColor="#8EA3C2" />
      </linearGradient>
      <path d="M58 80 L50 34 L76 56 L100 22 L124 56 L150 34 L142 80 Z" fill={`url(#${uid}plat)`} stroke="#6E84A8" strokeWidth="2" strokeLinejoin="round" />
      <rect x="56" y="66" width="88" height="15" rx="4" fill="#B9C8DD" stroke="#6E84A8" strokeWidth="1.6" />
      <Gem x={100} y={70} s={8} />
      <Gem x={76} y={71} s={5} />
      <Gem x={124} y={71} s={5} />
      <Gem x={100} y={24} s={6} />
      <Gem x={50} y={34} s={4.5} />
      <Gem x={150} y={34} s={4.5} />
      <Glint x={66} y={44} r={5} />
      <Glint x={138} y={50} r={4} />
      <Glint x={112} y={10} r={3.5} />
    </g>
  ),
};

/** The Kazakh kalpak: tall white felt, an upturned brim split at the front — here in festive gold. */
const goldenKalpak: Piece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}felt`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#E9E1D2" />
      </linearGradient>
      <linearGradient id={`${uid}brim`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFE07A" />
        <stop offset="1" stopColor="#E3A008" />
      </linearGradient>
      {/* crown of the hat: white felt, a soft rounded point */}
      <path d="M64 78 C 62 52 78 26 100 18 C 122 26 138 52 136 78 Z" fill={`url(#${uid}felt)`} stroke="#D8CDB9" strokeWidth="1.6" />
      <path d="M100 20 C 96 40 96 60 98 76 M84 30 C 78 46 76 62 78 76 M116 30 C 122 46 124 62 122 76" stroke="#E6DCCB" strokeWidth="1.3" fill="none" />
      {/* the upturned gold brim, flaring at the sides, split at the front */}
      <path d="M50 94 C 48 82 52 70 58 64 Q78 70 96 70 L100 82 L104 70 Q122 70 142 64 C 148 70 152 82 150 94 Q124 86 100 90 Q76 86 50 94 Z" fill={`url(#${uid}brim)`} stroke={GOLD_DARK} strokeWidth="1.6" strokeLinejoin="round" />
      <g stroke="#9A5B00" strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d="M60 84 c -1 -5 5 -7 6 -3 c 1 4 6 2 5 -3 M76 80 c -1 -5 5 -7 6 -3 c 1 4 6 2 5 -3" />
        <path d="M118 77 c -1 5 5 7 6 3 c 1 -4 6 -2 5 3 M134 81 c -1 5 5 7 6 3 c 1 -4 6 -2 5 3" />
      </g>
      <circle cx="100" cy="17" r="4" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" />
      <Glint x={80} y={42} r={4.5} />
      <Glint x={140} y={66} r={3.5} fill="#FFF6C8" />
    </g>
  ),
};

/** A khaki pith helmet with a band — for the checkpoint explorer. */
const explorerHat: Piece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}khaki`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#E9D3A1" />
        <stop offset="1" stopColor="#C7A86A" />
      </linearGradient>
      <ellipse cx="100" cy="80" rx="62" ry="12" fill="#B8955A" />
      <path d="M58 80 C 58 36 142 36 142 80 Q100 70 58 80 Z" fill={`url(#${uid}khaki)`} stroke="#A8864E" strokeWidth="1.6" />
      <path d="M60 74 Q100 64 140 74 L140 80 Q100 70 60 80 Z" fill="#6B4E2E" />
      <circle cx="100" cy="46" r="4" fill="#A8864E" />
      <path d="M78 52 C 86 44 96 41 104 41" stroke="#fff" strokeWidth="3" opacity="0.35" fill="none" strokeLinecap="round" />
      {/* a little brass compass badge on the band */}
      <circle cx="122" cy="72" r="6" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.2" />
      <path d="M122 67.5 L123.8 72 L122 76.5 L120.2 72 Z" fill="#C81E2B" />
    </g>
  ),
};

/** Warrior headband: deep blue band, gold forehead plate with the Master emblem, flying tails. */
const warriorHeadband: Piece = {
  front: (uid) => (
    <g>
      <clipPath id={`${uid}wband`}>
        <path d={BODY_PATH} />
      </clipPath>
      <path d="M20 82 Q100 62 180 82 L180 96 Q100 76 20 96 Z" fill="#1E3A8A" clipPath={`url(#${uid}wband)`} />
      <path d="M150 82 C 166 70 182 66 196 70 C 186 78 176 82 164 88 Z" fill="#1E3A8A" />
      <path d="M150 88 C 166 92 178 102 188 116 C 174 112 162 104 154 96 Z" fill="#16296A" />
      <rect x="82" y="66" width="36" height="18" rx="4" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.6" transform="rotate(0 100 75)" />
      <MasterMark x={100} y={75} size={14} color="#1E3A8A" />
      <Glint x={88} y={69} r={3} />
    </g>
  ),
};

/** Quiz cap: a forward cap with a big gold «?» — for the live-lesson ace. */
const quizCap: Piece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}qcap`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8B5CF6" />
        <stop offset="1" stopColor="#6D28D9" />
      </linearGradient>
      <path d="M56 80 C 54 38 146 38 144 80 Q100 70 56 80 Z" fill={`url(#${uid}qcap)`} />
      <path d="M56 80 Q100 70 144 80 Q150 88 134 92 Q100 84 66 92 Q50 88 56 80 Z" fill="#5B21B6" />
      <circle cx="100" cy="42" r="4" fill="#5B21B6" />
      <text x="100" y="72" textAnchor="middle" fontSize="28" fontWeight="900" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1" fontFamily="Arial Black, Arial, Helvetica, sans-serif">?</text>
      <path d="M72 52 C 78 46 86 43 94 42" stroke="#fff" strokeWidth="3" opacity="0.3" fill="none" strokeLinecap="round" />
    </g>
  ),
};

const BULBS = ['#FF4D6D', '#FFD166', '#4DD0FF', '#7CE38B', '#C084FC'];

/** A cosy scarf with a string of glowing lights — the New Year «Winter lights». */
const garlandScarf: Piece = {
  front: (uid) => (
    <g>
      <clipPath id={`${uid}gscarf`}>
        <path d={BODY_PATH} />
      </clipPath>
      <path d="M10 158 Q100 182 190 158 L190 178 Q100 202 10 178 Z" fill="#C81E4A" clipPath={`url(#${uid}gscarf)`} />
      <path d="M10 165 Q100 189 190 165" stroke="#fff" strokeWidth="2.6" fill="none" opacity="0.6" clipPath={`url(#${uid}gscarf)`} />
      <path d="M58 174 L76 174 L72 212 L54 212 Z" fill="#A3173B" />
      <path d="M56 200 L74 200" stroke="#fff" strokeWidth="2.6" opacity="0.6" />
      <path d="M20 150 Q100 172 180 150" stroke="#2F3B52" strokeWidth="1.6" fill="none" />
      {[30, 50, 70, 90, 110, 130, 150, 170].map((x, i) => {
        const y = 150 + 22 * (1 - ((x - 100) / 80) ** 2) - 2;
        const c = BULBS[i % BULBS.length];
        return (
          <g key={x}>
            <circle cx={x} cy={y + 5} r="6.5" fill={c} opacity="0.35" />
            <ellipse cx={x} cy={y + 5} rx="3.4" ry="4.6" fill={c} />
            <rect x={x - 2} y={y - 1} width="4" height="3" rx="1" fill="#59647A" />
          </g>
        );
      })}
    </g>
  ),
};

/** A fan scarf in Master colours, the end hanging down with the emblem — «Team spirit». */
const teamScarf: Piece = {
  front: (uid) => (
    <g>
      <clipPath id={`${uid}tscarf`}>
        <path d={BODY_PATH} />
      </clipPath>
      <g clipPath={`url(#${uid}tscarf)`}>
        <path d="M10 158 Q100 182 190 158 L190 180 Q100 204 10 180 Z" fill={BRAND_BLUE} />
        {[28, 60, 92, 124, 156].map((x) => (
          <path key={x} d={`M${x} 160 L${x + 14} 164 L${x + 14} 186 L${x} 182 Z`} fill="#fff" opacity="0.92" />
        ))}
      </g>
      <path d="M104 170 L128 168 L130 200 L106 202 Z" fill={BRAND_BLUE} stroke="#fff" strokeWidth="1.6" />
      <path d="M105 194 L130 192" stroke="#fff" strokeWidth="2.6" />
      <MasterMark x={117} y={182} size={16} color="#fff" />
      <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
        <path d="M109 202 L109 207 M114 202 L114 207 M119 201 L119 206 M124 201 L124 206" />
      </g>
    </g>
  ),
};

/** Royal purple cape sprinkled with gold stars, gold star clasp — «Star of the Week». */
const starCape: Piece = {
  back: () => (
    <g>
      <path d="M46 128 C 18 158 8 190 2 214 L198 214 C 192 190 182 158 154 128 Q100 146 46 128 Z" fill="#6D28D9" />
      <path d="M30 168 C 24 186 20 200 18 214 M170 168 C 176 186 180 200 182 214" stroke="#4C1D95" strokeWidth="4" fill="none" />
      {[[22, 186, 6], [178, 182, 6], [12, 206, 4.5], [190, 204, 4.5], [34, 160, 4], [166, 156, 4]].map(([x, y, r]) => (
        <Star5 key={`${x}-${y}`} x={x} y={y} r={r} />
      ))}
    </g>
  ),
  front: () => (
    <g>
      <path d="M40 152 Q100 180 160 152" stroke="#6D28D9" strokeWidth="6" fill="none" strokeLinecap="round" />
      <Star5 x={44} y={152} r={8} fill={MERCH_GOLD} stroke={GOLD_DARK} />
      <Star5 x={156} y={152} r={8} fill={MERCH_GOLD} stroke={GOLD_DARK} />
      <circle cx="100" cy="188" r="18" fill="#6D28D9" stroke={MERCH_GOLD} strokeWidth="2.6" />
      <Star5 x={100} y={188} r={12} fill={MERCH_GOLD} stroke={GOLD_DARK} />
      <Glint x={114} y={174} r={4} fill="#FFF6C8" />
    </g>
  ),
};

/** In contract order after the Gold Master hoodie (h18 … h25). */
export const REWARD_HATS: Piece[] = [
  diamondCrown,
  goldenKalpak,
  explorerHat,
  warriorHeadband,
  quizCap,
  garlandScarf,
  teamScarf,
  starCape,
];

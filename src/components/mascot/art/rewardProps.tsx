/**
 * Reward props (achievements), appended after the free ones in contract order (p16 … p26):
 * swim ring, pencil behind the fin, compass, clock pin, golden clock, bronze medal, jetpack,
 * boomerang, diploma, lucky charm, lightning badge. Held ones sit above the resting right fin.
 */
import type { PropPiece } from './props';
import { BRAND_BLUE, MasterMark } from './MasterMark';

const GOLD = '#FFC531';
const GOLD_DARK = '#C98A00';

function Glint({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

/** Clock hands at ten past ten, the friendliest time. */
function Hands({ x, y, r, color = '#1B2236' }: { x: number; y: number; r: number; color?: string }) {
  return (
    <g stroke={color} strokeLinecap="round">
      <path d={`M${x} ${y} L${x - r * 0.42} ${y - r * 0.32}`} strokeWidth={r * 0.16} />
      <path d={`M${x} ${y} L${x + r * 0.52} ${y - r * 0.42}`} strokeWidth={r * 0.12} />
      <circle cx={x} cy={y} r={r * 0.1} fill={color} stroke="none" />
    </g>
  );
}

/** A pink-and-white inflatable ring around the orca's waist: back half behind, front half in front. */
const RING_FRONT = 'M18 160 A 82 28 0 0 0 182 160 L 158 160 A 58 13 0 0 1 42 160 Z';
const RING_BACK = 'M18 160 A 82 28 0 0 1 182 160 L 158 160 A 58 13 0 0 0 42 160 Z';
const swimRing: PropPiece = {
  back: () => <path d={RING_BACK} fill="#E04E7E" />,
  front: (uid) => (
    <g>
      <clipPath id={`${uid}ring`}>
        <path d={RING_FRONT} />
      </clipPath>
      <path d={RING_FRONT} fill="#FF6B9A" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
      <g clipPath={`url(#${uid}ring)`} fill="#fff">
        <path d="M40 150 L60 150 L54 200 L34 200 Z" />
        <path d="M90 150 L110 150 L110 200 L90 200 Z" />
        <path d="M140 150 L160 150 L166 200 L146 200 Z" />
      </g>
      <path d="M34 172 C 56 182 80 185 100 185" stroke="#fff" strokeWidth="3" fill="none" opacity="0.6" strokeLinecap="round" />
    </g>
  ),
};

/** A gold pencil tucked behind the head, like behind an ear. */
const finPencil: PropPiece = {
  front: () => (
    <g transform="rotate(38 158 78)">
      <rect x="152" y="40" width="12" height="62" rx="2" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.2" />
      <rect x="152" y="40" width="4" height="62" fill="#FFE07A" />
      <rect x="152" y="32" width="12" height="10" rx="3" fill="#FF8FB1" />
      <rect x="152" y="40" width="12" height="4" fill="#D9DEE8" />
      <path d="M152 102 L158 116 L164 102 Z" fill="#F4D9B0" />
      <path d="M156.5 110 L158 116 L159.5 110 Z" fill="#2B2F45" />
      <MasterMark x={158} y={72} size={9} color="#9A5B00" />
    </g>
  ),
};

/** A brass pocket compass held up. */
const compass: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}brass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFE07A" />
        <stop offset="1" stopColor="#C98A00" />
      </linearGradient>
      <circle cx="164" cy="104" r="5" fill="none" stroke={GOLD_DARK} strokeWidth="2.6" />
      <circle cx="164" cy="128" r="20" fill={`url(#${uid}brass)`} stroke="#9A6A00" strokeWidth="1.6" />
      <circle cx="164" cy="128" r="15" fill="#FFFDF5" />
      <path d="M164 115 L168 128 L164 141 L160 128 Z" fill="#E5383B" />
      <path d="M164 128 L168 128 L164 141 L160 128 Z" fill="#2B4DBF" />
      <circle cx="164" cy="128" r="2" fill="#1B2236" />
      <text x="164" y="120" textAnchor="middle" fontSize="5" fontWeight="800" fill="#1B2236" fontFamily="Arial, Helvetica, sans-serif">N</text>
      <Glint x={152} y={116} r={3.5} />
    </g>
  ),
};

/** An enamel clock pin on the chest — five homeworks on time. */
const clockPin: PropPiece = {
  front: () => (
    <g>
      <circle cx="128" cy="172" r="13" fill={BRAND_BLUE} stroke={GOLD} strokeWidth="2.4" />
      <circle cx="128" cy="172" r="9" fill="#fff" />
      <Hands x={128} y={172} r={8} />
      <Glint x={137} y={163} r={3} fill="#FFF6C8" />
    </g>
  ),
};

/** A shining golden alarm clock — twenty homeworks on time. */
const goldenClock: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}gclock`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFF1A8" />
        <stop offset="0.5" stopColor={GOLD} />
        <stop offset="1" stopColor="#D08C00" />
      </linearGradient>
      <circle cx="152" cy="110" r="7" fill={`url(#${uid}gclock)`} stroke={GOLD_DARK} strokeWidth="1.2" />
      <circle cx="178" cy="110" r="7" fill={`url(#${uid}gclock)`} stroke={GOLD_DARK} strokeWidth="1.2" />
      <path d="M154 152 L148 160 M176 152 L182 160" stroke={GOLD_DARK} strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="165" cy="132" r="21" fill={`url(#${uid}gclock)`} stroke={GOLD_DARK} strokeWidth="1.8" />
      <circle cx="165" cy="132" r="15.5" fill="#FFFDF5" />
      <Hands x={165} y={132} r={13} />
      <Glint x={150} y={118} r={4} />
      <Glint x={190} y={96} r={3.5} fill="#FFF6C8" />
    </g>
  ),
};

/** A bronze medal on a ribbon — a perfect month of lessons. */
const bronzeMedal: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}bronze`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#F6C08A" />
        <stop offset="0.5" stopColor="#CD7F32" />
        <stop offset="1" stopColor="#8C4F18" />
      </linearGradient>
      <path d="M76 142 L94 182 L104 178 L88 140 Z" fill="#2563EB" />
      <path d="M124 142 L106 182 L96 178 L112 140 Z" fill="#E5383B" />
      <circle cx="100" cy="190" r="15" fill={`url(#${uid}bronze)`} stroke="#7A4214" strokeWidth="1.6" />
      <circle cx="100" cy="190" r="10.5" fill="none" stroke="#FCE1C2" strokeWidth="1.2" opacity="0.7" />
      <MasterMark x={100} y={190} size={14} color="#7A4214" />
      <Glint x={91} y={181} r={3} />
    </g>
  ),
};

/** Twin-tank jetpack: tanks peek over the shoulders, jets fire at the sides. */
const jetpack: PropPiece = {
  back: (uid) => (
    <g>
      <linearGradient id={`${uid}tank`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#9AA6BC" />
        <stop offset="0.45" stopColor="#F4F7FC" />
        <stop offset="1" stopColor="#8D99B0" />
      </linearGradient>
      {[{ x: 14, flip: -1 }, { x: 160, flip: 1 }].map(({ x, flip }) => (
        <g key={x}>
          <path d={`M${x + 5} 154 L${x + 21} 154 Q${x + 13 + flip * 20} 184 ${x + 13 + flip * 34} 206 Q${x + 13 + flip * 6} 184 ${x + 5} 154 Z`} fill="#FF7A1A" />
          <path d={`M${x + 8} 155 L${x + 18} 155 Q${x + 13 + flip * 14} 178 ${x + 13 + flip * 24} 194 Q${x + 13 + flip * 4} 178 ${x + 8} 155 Z`} fill="#FFC531" />
          <path d={`M${x + 11} 156 L${x + 15} 156 Q${x + 13 + flip * 8} 170 ${x + 13 + flip * 13} 180 Q${x + 13 + flip * 2} 170 ${x + 11} 156 Z`} fill="#FFF3B0" />
          <rect x={x} y="62" width="26" height="90" rx="12" fill={`url(#${uid}tank)`} stroke="#fff" strokeWidth="2.4" />
          <rect x={x + 2} y="62" width="22" height="14" rx="7" fill="#E5383B" />
          <rect x={x + 6} y="148" width="14" height="8" rx="2" fill="#59647A" />
          <MasterMark x={x + 13} y={108} size={14} color={BRAND_BLUE} />
        </g>
      ))}
    </g>
  ),
  // shoulder straps and a chest buckle, so the pack reads as worn
  front: () => (
    <g>
      <path d="M58 138 Q66 170 74 210" stroke="#4A5468" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M142 138 Q134 170 126 210" stroke="#4A5468" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M68 178 L132 178" stroke="#4A5468" strokeWidth="6" strokeLinecap="round" />
      <rect x="91" y="171" width="18" height="14" rx="3" fill="#E5383B" stroke="#fff" strokeWidth="1.6" />
    </g>
  ),
};

/** A wooden boomerang, mid-catch, with motion swooshes. */
const boomerang: PropPiece = {
  front: () => (
    <g>
      <path d="M140 92 C 154 82 170 84 182 92" stroke="#fff" strokeWidth="2.6" fill="none" opacity="0.75" strokeLinecap="round" />
      <path d="M134 102 C 146 94 158 94 168 98" stroke="#fff" strokeWidth="2" fill="none" opacity="0.55" strokeLinecap="round" />
      <g transform="rotate(-18 166 128)">
        <path d="M144 124 C 150 104 166 100 186 112 C 190 116 188 122 182 121 C 170 114 160 116 156 128 C 154 136 140 134 144 124 Z" fill="#D9893B" stroke="#8C4F18" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M156 128 C 162 136 166 150 162 164 C 160 170 154 168 154 162 C 156 150 152 142 146 136 Z" fill="#C2732A" stroke="#8C4F18" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M150 122 C 156 110 168 108 180 114" stroke="#FFD7A3" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
      </g>
    </g>
  ),
};

/** A rolled diploma with a red ribbon and a gold Master seal. */
const diploma: PropPiece = {
  front: () => (
    <g transform="rotate(-28 164 130)">
      <rect x="136" y="120" width="58" height="20" rx="10" fill="#FFF8E6" stroke="#D9C8A0" strokeWidth="1.6" />
      <ellipse cx="190" cy="130" rx="5" ry="10" fill="#F0E2BF" stroke="#D9C8A0" strokeWidth="1.4" />
      <path d="M160 118 L160 142 M168 118 L168 142" stroke="#E5383B" strokeWidth="4" />
      <path d="M160 142 L154 156 L160 152 L164 158 Z M168 142 L172 158 L168 152 L164 158 Z" fill="#C81E2B" />
      <circle cx="164" cy="144" r="9" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.4" />
      <MasterMark x={164} y={144} size={11} color="#9A5B00" />
    </g>
  ),
};

/** A four-leaf clover pendant on a gold chain — luck for test day. */
const luckyCharm: PropPiece = {
  front: () => (
    <g>
      <path d="M72 146 Q100 176 128 146" stroke={GOLD} strokeWidth="2.2" fill="none" strokeDasharray="3 2" />
      <circle cx="100" cy="182" r="14" fill={GOLD} stroke={GOLD_DARK} strokeWidth="1.6" />
      <circle cx="100" cy="182" r="11" fill="#E9FBEF" />
      <g fill="#2DB55D" stroke="#1E8A44" strokeWidth="0.8">
        <circle cx="95.5" cy="177.5" r="4.6" />
        <circle cx="104.5" cy="177.5" r="4.6" />
        <circle cx="95.5" cy="186.5" r="4.6" />
        <circle cx="104.5" cy="186.5" r="4.6" />
      </g>
      <path d="M100 182 Q103 189 106 192" stroke="#1E8A44" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Glint x={110} y={172} r={3} fill="#FFF6C8" />
    </g>
  ),
};

/** A lightning-bolt badge on the chest — the first live-lesson answer. */
const lightningBadge: PropPiece = {
  front: () => (
    <g>
      <circle cx="128" cy="172" r="14" fill="#1B2A6B" stroke={GOLD} strokeWidth="2.4" />
      <path d="M131 160 L120 175 L127 175 L124 185 L136 169 L129 169 Z" fill="#FFD84D" stroke="#E3A008" strokeWidth="0.8" strokeLinejoin="round" />
      <Glint x={138} y={162} r={3} fill="#FFF6C8" />
    </g>
  ),
};

export const REWARD_PROPS: PropPiece[] = [
  swimRing,
  finPencil,
  compass,
  clockPin,
  goldenClock,
  bronzeMedal,
  jetpack,
  boomerang,
  diploma,
  luckyCharm,
  lightningBadge,
];

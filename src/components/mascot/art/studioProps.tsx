/**
 * Master League season 2 «Studio» props (owner, 2026-11-02), appended after the Summit Flag:
 * p31 Vintage Mic (First Take), p32 Mixing Fader (Full Lineup), p33 Master Tape (Final Mix),
 * p34 Chart Arrow (Climbing the Charts). They sit under the resting right fin so the fin reads as
 * holding them.
 */
import type { PropPiece } from './props';
import { MasterMark } from './MasterMark';
import { STUDIO } from './StudioEmblem';

function Glint({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

/** A chrome capsule microphone with a ribbed grille and a gold band, on a stand that runs behind the fin. */
const vintageMic: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}mic`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8D9BB3" />
        <stop offset="0.35" stopColor="#FFFFFF" />
        <stop offset="0.7" stopColor="#D5DDEA" />
        <stop offset="1" stopColor="#6E7C95" />
      </linearGradient>
      {/* the stand and its yoke */}
      <rect x="160" y="146" width="5" height="70" rx="2.5" fill={STUDIO.ink2} />
      <path d="M148 132 Q148 152 162.5 152 Q177 152 177 132" stroke={STUDIO.ink2} strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* the capsule */}
      <rect x="146" y="98" width="33" height="48" rx="16.5" fill={`url(#${uid}mic)`} stroke="#6E7C95" strokeWidth="1.6" />
      <g stroke="#6E7C95" strokeWidth="1.5" strokeLinecap="round" opacity="0.85">
        {[106, 111, 116, 128, 133, 138].map((y) => (
          <path key={y} d={`M${y < 120 ? 152 : 151} ${y} H${y < 120 ? 173 : 174}`} />
        ))}
      </g>
      {/* gold band round the middle */}
      <rect x="145" y="119" width="35" height="6" rx="2" fill={STUDIO.gold} stroke={STUDIO.goldDark} strokeWidth="1" />
      <path d="M152 102 C 150 110 150 116 151 120" stroke="#fff" strokeWidth="2.6" opacity="0.8" fill="none" strokeLinecap="round" />
      <Glint x={184} y={98} r={3.8} fill="#FFF6C8" />
    </g>
  ),
};

/** A slice of a mixing console: three channel faders at different heights, level lights on top. */
const mixingFader: PropPiece = {
  front: () => (
    <g transform="rotate(-8 162 130)">
      <rect x="134" y="88" width="58" height="84" rx="8" fill={STUDIO.ink2} stroke={STUDIO.ink} strokeWidth="2" />
      <rect x="137" y="91" width="52" height="4" rx="2" fill="#fff" opacity="0.12" />
      {/* level lights: green, green, gold, orange */}
      {[146, 163, 180].map((x, i) => (
        <g key={x}>
          {[0, 1, 2, 3].slice(0, 4 - i).map((j) => (
            <rect key={j} x={x - 4} y={114 - j * 5.5} width="8" height="3.8" rx="1" fill={j === 3 ? STUDIO.orange : j === 2 ? STUDIO.gold : '#4ADE80'} />
          ))}
        </g>
      ))}
      {/* the fader slots and caps, above the fin */}
      {[[146, 140], [163, 126], [180, 134]].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 1.6} y="120" width="3.2" height="44" rx="1.6" fill="#0B0C0E" />
          <rect x={x - 7.5} y={y - 5} width="15" height="10" rx="2.2" fill={x === 163 ? STUDIO.gold : '#E8EBF0'} stroke={x === 163 ? STUDIO.goldDark : '#8D9BB3'} strokeWidth="1" />
          <path d={`M${x - 5} ${y} H${x + 5}`} stroke={x === 163 ? STUDIO.goldDark : '#6E7C95'} strokeWidth="1.2" />
        </g>
      ))}
      <Glint x={194} y={86} r={3.8} fill="#FFF6C8" />
    </g>
  ),
};

/** A cassette with a cream-and-gold label, two reels and the Master emblem: the final mix, on tape. */
const masterTape: PropPiece = {
  front: () => (
    <g transform="translate(-6 -30) rotate(-10 164 150)">
      <rect x="128" y="124" width="72" height="48" rx="6" fill={STUDIO.ink} stroke="#000" strokeOpacity="0.4" strokeWidth="1.4" />
      <rect x="133" y="129" width="62" height="28" rx="3.5" fill="#F6EBD3" />
      <rect x="133" y="129" width="62" height="7" rx="3" fill={STUDIO.gold} />
      <MasterMark x={146} y={147} size={10} color={STUDIO.ink} />
      <path d="M155 150 H186" stroke="#C9B48A" strokeWidth="1.6" strokeLinecap="round" />
      {/* the two reels */}
      {[[152, 162], [176, 162]].map(([x, y]) => (
        <g key={x}>
          <circle cx={x} cy={y} r="6.4" fill="#F6EBD3" stroke={STUDIO.ink2} strokeWidth="1.2" />
          <circle cx={x} cy={y} r="2.4" fill={STUDIO.ink} />
          <path d={`M${x - 4} ${y} H${x + 4} M${x} ${y - 4} V${y + 4}`} stroke={STUDIO.ink} strokeWidth="1" />
        </g>
      ))}
      <path d="M136 168 L140 160 H188 L192 168" stroke="#3A3C45" strokeWidth="1.4" fill="none" />
      <Glint x={198} y={122} r={3.8} fill="#FFF6C8" />
    </g>
  ),
};

/** Three gold bars climbing, an arrow shooting up past the last one: moving up the charts. */
const chartArrow: PropPiece = {
  front: (uid) => (
    <g transform="translate(-4 -18)">
      <linearGradient id={`${uid}cha`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={STUDIO.goldHi} />
        <stop offset="1" stopColor={STUDIO.goldDark} />
      </linearGradient>
      <rect x="134" y="168" width="64" height="6" rx="3" fill={STUDIO.ink2} />
      {[[140, 152, 16], [158, 138, 30], [176, 118, 50]].map(([x, y, h]) => (
        <rect key={x} x={x} y={y} width="14" height={h} rx="3" fill={`url(#${uid}cha)`} stroke={STUDIO.goldDark} strokeWidth="1.2" />
      ))}
      <path d="M130 150 L150 132 L164 140 L192 104" stroke={STUDIO.orange} strokeWidth="9" opacity="0.35" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M130 150 L150 132 L164 140 L190 106" stroke="#FFFFFF" strokeWidth="4.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M180 104 L196 98 L192 114 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="2" strokeLinejoin="round" />
      <Glint x={168} y={104} r={4.2} fill="#FFF6C8" />
      <Glint x={138} y={126} r={2.8} />
    </g>
  ),
};

/** Appended after the Summit Flag (p31, p32, p33, p34). */
export const STUDIO_PROPS: PropPiece[] = [vintageMic, mixingFader, masterTape, chartArrow];

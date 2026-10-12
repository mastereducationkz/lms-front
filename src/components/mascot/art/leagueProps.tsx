/**
 * Master League props (owner, 2026-10-13), appended after the lightning badge:
 * p27 Silver Whistle (first matchday), p28 Squad Pennant (a full squad), p29 Gold Clipboard
 * (no loose ends). They sit under the resting right fin so the fin reads as holding them.
 */
import type { PropPiece } from './props';
import { MasterMark } from './MasterMark';
import { LEAGUE } from './LeagueCrest';

function Glint({ x, y, r, fill = '#fff' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

/** A referee's whistle on a navy-and-gold lanyard, held in the fin, with two little sound arcs. */
const silverWhistle: PropPiece = {
  front: () => (
    <g>
      {/* lanyard round the neck, under the fin */}
      <path d="M58 152 Q92 190 118 168" stroke={LEAGUE.navy2} strokeWidth="4.4" fill="none" strokeLinecap="round" />
      <path d="M58 152 Q92 190 118 168" stroke={LEAGUE.gold} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeDasharray="4 5" />
    </g>
  ),
  over: (uid) => (
    <g>
      <linearGradient id={`${uid}whs`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="0.5" stopColor="#D5DDEA" />
        <stop offset="1" stopColor="#8D9BB3" />
      </linearGradient>
      {/* mouthpiece */}
      <path d="M114 162 L142 167 L140 179 L112 174 Z" fill={`url(#${uid}whs)`} stroke="#6E7C95" strokeWidth="1.4" strokeLinejoin="round" />
      {/* chamber */}
      <circle cx="148" cy="170" r="13.5" fill={`url(#${uid}whs)`} stroke="#6E7C95" strokeWidth="1.6" />
      <circle cx="148" cy="170" r="5.4" fill={LEAGUE.night} />
      <circle cx="148" cy="170" r="2.7" fill="#E8EEF8" />
      <path d="M138 163 C 141 159 146 158 151 159" stroke="#fff" strokeWidth="2.4" opacity="0.85" fill="none" strokeLinecap="round" />
      {/* sound arcs */}
      <g stroke={LEAGUE.gold} strokeWidth="2.8" fill="none" strokeLinecap="round">
        <path d="M162 156 Q168 150 169 142" />
        <path d="M167 164 Q174 158 176 150" opacity="0.75" />
      </g>
      <Glint x={136} y={160} r={3.2} />
    </g>
  ),
};

/** A navy pennant on a stick with the gold «M», waving. */
const squadPennant: PropPiece = {
  front: () => (
    <g>
      <rect x="165" y="104" width="4.6" height="82" rx="2.3" fill="#B8955A" stroke="#8B6B3A" strokeWidth="0.8" />
      <circle cx="167.3" cy="102" r="4.2" fill={LEAGUE.gold} stroke={LEAGUE.goldDark} strokeWidth="1.2" />
      {/* the flag, pointing back towards the orca */}
      <path d="M165 108 C 156 106 146 110 134 112 C 144 117 150 120 134 128 C 148 132 158 134 165 140 Z" fill={LEAGUE.navy2} stroke={LEAGUE.gold} strokeWidth="2" strokeLinejoin="round" />
      <path d="M163 114 C 156 113 150 115 144 116" stroke="#fff" strokeWidth="1.8" opacity="0.28" fill="none" strokeLinecap="round" />
      <MasterMark x={154} y={125} size={14} color={LEAGUE.gold} />
      <Glint x={168} y={112} r={3} fill="#FFF6C8" />
    </g>
  ),
};

/** A gold clipboard with three green ticks: everything handed in. */
const goldClipboard: PropPiece = {
  front: (uid) => (
    <g transform="rotate(9 168 148)">
      <linearGradient id={`${uid}clb`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFE07A" />
        <stop offset="1" stopColor="#E3A008" />
      </linearGradient>
      <rect x="146" y="112" width="44" height="64" rx="6" fill={`url(#${uid}clb)`} stroke={LEAGUE.goldDark} strokeWidth="1.8" />
      <rect x="151" y="121" width="34" height="50" rx="3" fill="#fff" />
      {[131, 144, 157].map((y) => (
        <g key={y}>
          <path d={`M155 ${y} l3.2 3.6 l6.4 -7.6`} stroke="#1E9E50" strokeWidth="2.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M169 ${y + 1} L181 ${y + 1}`} stroke="#C3CCDB" strokeWidth="2.6" strokeLinecap="round" />
        </g>
      ))}
      {/* the clip */}
      <rect x="158" y="106" width="20" height="13" rx="3.5" fill={LEAGUE.navy2} stroke={LEAGUE.gold} strokeWidth="1.6" />
      <circle cx="168" cy="111" r="2.1" fill={LEAGUE.gold} />
      <path d="M148 118 L148 168" stroke="#fff" strokeWidth="2" opacity="0.4" strokeLinecap="round" />
      <Glint x={188} y={118} r={4} fill="#FFF6C8" />
    </g>
  ),
};

/** Appended after the lightning badge (p27, p28, p29). */
export const LEAGUE_PROPS: PropPiece[] = [silverWhistle, squadPennant, goldClipboard];

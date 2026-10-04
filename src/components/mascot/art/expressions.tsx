/** Faces: white-ringed eyes on the black head, a wide grin on the cream jaw. One entry per EXPRESSIONS. */
import type { ReactNode } from 'react';
import { EYE, EYE_L, EYE_R, INK, MOUTH, TONGUE } from './base';

const EYES = [EYE_L, EYE_R];
const LINE = '#fff';

/** An open eye: white ring, dark pupil looking slightly inward, two highlights. */
function RoundEye({ x, y, r = 13, inward = 1 }: { x: number; y: number; r?: number; inward?: number }) {
  const px = x + inward * r * 0.12;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" />
      <circle cx={px} cy={y + r * 0.06} r={r * 0.68} fill={EYE} />
      <circle cx={px + r * 0.24} cy={y - r * 0.24} r={r * 0.26} fill="#fff" />
      <circle cx={px - r * 0.26} cy={y + r * 0.3} r={r * 0.11} fill="#fff" />
    </g>
  );
}

const arc = (x: number, y: number, up: boolean, w = 9, h = 6) =>
  `M${x - w} ${y} Q${x} ${up ? y - h * 1.5 : y + h * 1.5} ${x + w} ${y}`;

/** The reference grin: wide, deep pink inside, a tongue, sitting on the jaw line. */
function OpenSmile({ uid, wide = 1, deep = 1 }: { uid: string; wide?: number; deep?: number }) {
  const l = 100 - 23 * wide;
  const r = 100 + 23 * wide;
  const top = 134;
  const bottom = top + 18 * deep;
  const d = `M${l} ${top} Q100 ${top + 6} ${r} ${top} Q${r - 4} ${bottom} 100 ${bottom} Q${l + 4} ${bottom} ${l} ${top} Z`;
  return (
    <g>
      <path d={d} fill={MOUTH} stroke="#FBF7F0" strokeWidth="2.4" strokeLinejoin="round" />
      <clipPath id={`${uid}mouth`}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${uid}mouth)`}>
        <ellipse cx="100" cy={top + 4} rx={22 * wide} ry="5" fill="#7E1631" />
        <ellipse cx="100" cy={bottom} rx={13 * wide} ry={8 * deep} fill={TONGUE} />
      </g>
    </g>
  );
}

function LineSmile({ d }: { d: string }) {
  return (
    <g>
      <path d={d} stroke="#FBF7F0" strokeWidth="7" strokeLinecap="round" fill="none" />
      <path d={d} stroke={MOUTH} strokeWidth="3.6" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill="#FFC531" stroke="#FFF1B8" strokeWidth="1.6" strokeLinejoin="round" />;
}

const Zs = () => (
  <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <polyline points="150,112 159,112 150,122 159,122" />
    <polyline points="163,96 170,96 163,104 170,104" opacity="0.8" />
  </g>
);

export const EXPRESSION_ART: ((uid: string) => ReactNode)[] = [
  // happy — the reference face
  (uid) => (
    <g>
      <RoundEye {...EYE_L} inward={1} />
      <RoundEye {...EYE_R} inward={-1} />
      <OpenSmile uid={uid} />
    </g>
  ),
  // wink
  (uid) => (
    <g>
      <path d={arc(EYE_L.x, EYE_L.y + 2, true)} stroke={LINE} strokeWidth="4.2" strokeLinecap="round" fill="none" />
      <RoundEye {...EYE_R} inward={-1} />
      <OpenSmile uid={uid} wide={0.9} deep={0.85} />
    </g>
  ),
  // cool — half-lidded, smirk
  () => (
    <g>
      {EYES.map((e) => (
        <g key={e.x}>
          <path d={`M${e.x - 13} ${e.y} A13 13 0 0 0 ${e.x + 13} ${e.y} Z`} fill="#fff" />
          <path d={`M${e.x - 7.5} ${e.y} A8 8 0 0 0 ${e.x + 8.5} ${e.y} Z`} fill={EYE} />
          <path d={`M${e.x - 15} ${e.y - 0.5} L${e.x + 15} ${e.y - 0.5}`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />
        </g>
      ))}
      <LineSmile d="M86 140 Q102 150 116 136" />
    </g>
  ),
  // star-eyes
  (uid) => (
    <g>
      {EYES.map((e) => <Star key={e.x} x={e.x} y={e.y} r={13} />)}
      <OpenSmile uid={uid} wide={1.05} deep={1.1} />
    </g>
  ),
  // determined — inner brows cut down into the eyes, confident grin
  () => (
    <g>
      <RoundEye {...EYE_L} inward={1} />
      <RoundEye {...EYE_R} inward={-1} />
      <path d={`M${EYE_L.x - 14} ${EYE_L.y - 16} L${EYE_L.x + 14} ${EYE_L.y - 9} L${EYE_L.x + 14} ${EYE_L.y - 20} Z`} fill={INK} />
      <path d={`M${EYE_R.x + 14} ${EYE_R.y - 16} L${EYE_R.x - 14} ${EYE_R.y - 9} L${EYE_R.x - 14} ${EYE_R.y - 20} Z`} fill={INK} />
      <path d="M80 136 Q100 146 120 136 Q116 152 100 153 Q84 152 80 136 Z" fill={MOUTH} stroke="#FBF7F0" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M83 138 Q100 146 117 138 L116 142 Q100 149 84 142 Z" fill="#fff" />
    </g>
  ),
  // sleepy
  () => (
    <g>
      {EYES.map((e) => (
        <path key={e.x} d={arc(e.x, e.y, false, 9, 4.5)} stroke={LINE} strokeWidth="4" strokeLinecap="round" fill="none" />
      ))}
      <ellipse cx="100" cy="142" rx="5.5" ry="6.5" fill={MOUTH} stroke="#FBF7F0" strokeWidth="2" />
      <Zs />
    </g>
  ),
  // surprised
  () => (
    <g>
      {EYES.map((e) => (
        <g key={e.x}>
          <circle cx={e.x} cy={e.y} r="14.5" fill="#fff" />
          <circle cx={e.x} cy={e.y} r="6" fill={EYE} />
          <circle cx={e.x + 2} cy={e.y - 2} r="2" fill="#fff" />
        </g>
      ))}
      <ellipse cx="100" cy="144" rx="9" ry="10" fill={MOUTH} stroke="#FBF7F0" strokeWidth="2.4" />
      <ellipse cx="100" cy="149.5" rx="6" ry="3.5" fill={TONGUE} />
    </g>
  ),
  // laughing
  (uid) => (
    <g>
      {EYES.map((e) => (
        <path key={e.x} d={arc(e.x, e.y + 3, true, 9.5, 6.5)} stroke={LINE} strokeWidth="4.4" strokeLinecap="round" fill="none" />
      ))}
      <OpenSmile uid={uid} wide={1.12} deep={1.35} />
    </g>
  ),
];

/**
 * Master League season 2 «Studio» frames (owner, 2026-11-02), drawn in the margin the Orca adds when
 * a frame is worn (FRAME_PAD). Each ring is a record: grooves, a sheen, the label hanging at the bottom.
 * f7 Gold Record (Signed): gold grooves on a dark edge.
 * f8 Platinum Record (Platinum, an official 1500+, the rarest of the two): platinum grooves, a purple
 * label and sparks; reads as «brighter than gold» even at 32 px.
 */
import type { ReactNode } from 'react';
import { MasterMark } from './MasterMark';
import { STUDIO } from './StudioEmblem';

const C = 100;

function Spark({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

interface RecordRing {
  hi: string;
  mid: string;
  dark: string;
  edge: string;
  label: string;
  mark: string;
}

function recordFrame(uid: string, id: string, c: RecordRing, extra?: ReactNode): ReactNode {
  return (
    <g>
      <linearGradient id={`${uid}${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={c.hi} />
        <stop offset="0.45" stopColor={c.mid} />
        <stop offset="1" stopColor={c.dark} />
      </linearGradient>
      <circle cx={C} cy={C} r="114.5" fill="none" stroke={c.edge} strokeWidth="2.4" />
      <circle cx={C} cy={C} r="107.5" fill="none" stroke={`url(#${uid}${id})`} strokeWidth="12" />
      {/* the grooves */}
      {[103.4, 106.2, 109, 111.8].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke={c.dark} strokeWidth="0.8" opacity="0.55" />
      ))}
      <circle cx={C} cy={C} r="101" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
      {/* light caught in the grooves, top left and bottom right */}
      <path d="M14 58 A 98 98 0 0 1 58 14" stroke="#fff" strokeWidth="5" opacity="0.6" fill="none" strokeLinecap="round" />
      <path d="M186 142 A 98 98 0 0 1 150 182" stroke="#fff" strokeWidth="3" opacity="0.4" fill="none" strokeLinecap="round" />
      {/* the label, hanging at the bottom like the crest does */}
      <circle cx={C} cy="203" r="15" fill={c.edge} />
      <circle cx={C} cy="203" r="12.5" fill={c.label} stroke={c.mid} strokeWidth="1.6" />
      <MasterMark x={C} y={202.4} size={15} color={c.mark} />
      <circle cx={C} cy="203" r="1.8" fill={c.edge} />
      {extra}
    </g>
  );
}

export function goldRecordFrame(uid: string): ReactNode {
  return recordFrame(uid, 'grf', {
    hi: '#FFF1B8', mid: STUDIO.gold, dark: STUDIO.goldDark, edge: STUDIO.ink, label: STUDIO.gold, mark: STUDIO.ink,
  }, (
    <g>
      <Spark x={30} y={24} r={6} fill="#FFF6C8" />
      <Spark x={182} y={176} r={4} fill="#FFF6C8" />
    </g>
  ));
}

export function platinumRecordFrame(uid: string): ReactNode {
  return recordFrame(uid, 'prf', {
    hi: '#FFFFFF', mid: '#D4DDE7', dark: STUDIO.platinumDark, edge: STUDIO.purple, label: STUDIO.purple, mark: '#F4F7FA',
  }, (
    <g>
      <Spark x={100} y={-8} r={9} fill="#fff" />
      <Spark x={30} y={24} r={6} fill="#fff" />
      <Spark x={186} y={44} r={5} fill="#E6ECF2" />
      <Spark x={182} y={176} r={4.4} fill="#fff" />
      <Spark x={14} y={150} r={3.6} fill="#E6ECF2" />
    </g>
  ));
}

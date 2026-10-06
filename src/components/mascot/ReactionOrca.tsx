/**
 * A live-lesson reaction (owner, 2026-10-04): the student's OWN orca reacting. Their saved look
 * with the reaction's expression and a small overlay — hearts, happy tears, flames, sparkles, a
 * burst, a splash. Drawn in one SVG so it reads at 40–48 px; effects may spill past the circle.
 * During an anonymous activity the screens pass no code and no id: a plain orca reacts.
 */
import type { ReactNode } from 'react';
import Orca from './Orca';
import { resolveMascot, type MascotConfig } from './config';
import { EYE_L, EYE_R } from './art/base';

export const REACTION_KINDS = ['love', 'laugh', 'fire', 'clap', 'mindblown', 'splash'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_LABEL: Record<ReactionKind, string> = {
  love: 'Love', laugh: 'Haha', fire: 'Fire', clap: 'Bravo', mindblown: 'Mind blown', splash: 'Splash',
};
// Bubbles and counters draw a reaction with ReactionGlyph (live-lesson/reactionIcons): icons, not emoji.

/** expression indices in config EXPRESSIONS: 0 happy, 3 star-eyes, 4 determined, 7 laughing. */
const FACE: Record<ReactionKind, number> = { love: 0, laugh: 7, fire: 4, clap: 7, mindblown: 3, splash: 0 };
const PLAIN: MascotConfig = { hat: 0, eyewear: 0, expression: 0, prop: 0, background: 0, frame: 0 };

function Heart({ x, y, s, fill = '#FF4D7E' }: { x: number; y: number; s: number; fill?: string }) {
  const d = `M${x} ${y + s * 0.9} C${x - s * 1.5} ${y - s * 0.1} ${x - s * 0.9} ${y - s * 1.2} ${x} ${y - s * 0.45}
    C${x + s * 0.9} ${y - s * 1.2} ${x + s * 1.5} ${y - s * 0.1} ${x} ${y + s * 0.9} Z`;
  return <path d={d} fill={fill} stroke="#fff" strokeWidth={Math.max(1.6, s * 0.18)} strokeLinejoin="round" />;
}

function Tear({ x, y, flip = 1 }: { x: number; y: number; flip?: number }) {
  // A big happy tear arcing out from the eye's outer corner, so it still reads at 40 px.
  return (
    <path d={`M${x} ${y} c${-14 * flip} 8 ${-20 * flip} 22 ${-8 * flip} 30 c${10 * flip} 6 ${20 * flip} -6 ${12 * flip} -18 c${-3 * flip} -5 ${-2 * flip} -9 ${-4 * flip} -12 Z`}
      fill="#7DD3FC" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
  );
}

function Flame({ x, y, s, rot = 0 }: { x: number; y: number; s: number; rot?: number }) {
  return (
    <g transform={`rotate(${rot} ${x} ${y})`}>
      <path d={`M${x} ${y} c${-s * 0.9} ${-s * 0.6} ${-s * 0.7} ${-s * 1.5} ${-s * 0.1} ${-s * 2.2}
        c${s * 0.05} ${s * 0.6} ${s * 0.45} ${s * 0.8} ${s * 0.55} ${s * 0.3} c${s * 0.5} ${s * 0.7} ${s * 0.6} ${s * 1.5} ${-s * 0.45} ${s * 1.9} Z`}
        fill="#FF6A1A" stroke="#FFD166" strokeWidth={s * 0.14} strokeLinejoin="round" />
      <path d={`M${x} ${y - s * 0.15} c${-s * 0.4} ${-s * 0.3} ${-s * 0.3} ${-s * 0.8} 0 ${-s * 1.1} c${s * 0.25} ${s * 0.4} ${s * 0.45} ${s * 0.75} 0 ${s * 1.1} Z`}
        fill="#FFE066" />
    </g>
  );
}

function Sparkle({ x, y, s, fill = '#FFC531' }: { x: number; y: number; s: number; fill?: string }) {
  return (
    <path d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s}
      Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`}
      fill={fill} stroke="#fff" strokeWidth={Math.max(1.4, s * 0.16)} strokeLinejoin="round" />
  );
}

function Burst() {
  const rays: ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
    const r1 = 104;
    const r2 = i % 2 ? 122 : 132;
    rays.push(<line key={i} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + r2 * Math.cos(a)} y2={100 + r2 * Math.sin(a)}
      stroke={i % 2 ? '#FFFFFF' : '#FFC531'} strokeWidth="9" strokeLinecap="round" />);
  }
  return <g>{rays}</g>;
}

function Splash() {
  return (
    <g>
      <path d="M-6 196 Q20 150 40 182 Q52 132 70 176 Q88 140 100 178 Q112 140 130 176 Q148 132 160 182 Q180 150 206 196 L206 230 L-6 230 Z"
        fill="#38BDF8" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
      <path d="M8 214 Q50 196 100 212 Q150 196 192 214" stroke="#E0F2FE" strokeWidth="6" fill="none" strokeLinecap="round" />
      {[[-8, 150, 8], [208, 146, 9], [-2, 116, 5], [202, 110, 6]].map(([x, y, r]) => (
        <circle key={`${x}`} cx={x} cy={y} r={r} fill="#7DD3FC" stroke="#fff" strokeWidth="2" />
      ))}
    </g>
  );
}

const BEHIND: Partial<Record<ReactionKind, () => ReactNode>> = {
  mindblown: () => <Burst />,
  fire: () => (
    <g>
      <Flame x={18} y={196} s={34} rot={-14} />
      <Flame x={182} y={196} s={34} rot={14} />
    </g>
  ),
};

const FRONT: Record<ReactionKind, () => ReactNode> = {
  love: () => (
    <g>
      <Heart x={EYE_L.x} y={EYE_L.y} s={15} />
      <Heart x={EYE_R.x} y={EYE_R.y} s={15} />
      <Heart x={172} y={42} s={13} />
      <Heart x={190} y={74} s={8} fill="#FF8FB0" />
    </g>
  ),
  laugh: () => (
    <g>
      <Tear x={EYE_L.x - 12} y={EYE_L.y + 4} flip={1} />
      <Tear x={EYE_R.x + 12} y={EYE_R.y + 4} flip={-1} />
    </g>
  ),
  fire: () => <Flame x={176} y={60} s={22} rot={10} />,
  clap: () => (
    <g>
      <Sparkle x={24} y={44} s={16} />
      <Sparkle x={178} y={40} s={18} />
      <Sparkle x={190} y={92} s={10} fill="#60A5FA" />
      <path d="M150 20 l10 -14 M166 26 l16 -8 M140 12 l-2 -16" stroke="#FFC531" strokeWidth="6" strokeLinecap="round" />
    </g>
  ),
  mindblown: () => (
    <g>
      <Sparkle x={30} y={30} s={12} fill="#F472B6" />
      <Sparkle x={176} y={26} s={14} />
    </g>
  ),
  splash: () => <Splash />,
};

interface ReactionOrcaProps {
  kind: ReactionKind;
  /** Their saved look (users.mascot) and id for the automatic one; both null = a plain orca. */
  code?: string | null;
  userId?: number | string | null;
  size?: number;
  className?: string;
  title?: string;
}

export default function ReactionOrca({ kind, code, userId, size = 48, className, title }: ReactionOrcaProps) {
  const look = userId == null ? PLAIN : resolveMascot(code ?? null, userId);
  const config: MascotConfig = { ...look, expression: FACE[kind], frame: 0 };
  const leap = kind === 'splash' ? -16 : 0;
  return (
    <svg viewBox="-24 -24 248 248" width={size} height={size} className={className} role="img"
      aria-label={title ?? `${REACTION_LABEL[kind]} reaction`}>
      {BEHIND[kind]?.()}
      <g transform={`translate(0 ${leap})`}>
        <Orca config={config} size={200} />
      </g>
      {FRONT[kind]()}
    </svg>
  );
}

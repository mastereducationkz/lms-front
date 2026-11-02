/**
 * The Master League «Studio» emblem (season 2, owner 2026-11-02): a vinyl record, its label carrying
 * the Master sunburst «M». Original art only: no album cover, no artist, no logo but our own. One
 * drawing, three homes: the Gold Record frame's label, the achievements page band and the welcome /
 * invitation scenes (as a standalone svg). Flat fills only (no gradient ids), so it can be drawn any
 * number of times in one document.
 */
import { MasterMark } from './MasterMark';

export const STUDIO = {
  ink: '#16171A',
  ink2: '#24252B',
  ink3: '#34363E',
  gold: '#E8C268',
  goldHi: '#F8E3A0',
  goldDark: '#A8802A',
  orange: '#F08A4B',
  purple: '#2E1656',
  platinum: '#E6ECF2',
  platinumDark: '#8C9AAB',
} as const;

interface EmblemProps {
  /** Centre of the record in the parent's coordinates. */
  x: number;
  y: number;
  /** Diameter of the record in the parent's units. */
  size: number;
  /** The label's colour (gold by default; Off-Season's is burnt orange). */
  label?: string;
}

/** A record seen flat: grooves, a sheen across the top left, the label with the emblem and a spindle hole. */
export function StudioRecord({ x, y, size, label = STUDIO.gold }: EmblemProps) {
  const k = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <circle r="50" fill={STUDIO.ink} />
      <circle r="49" fill="none" stroke="#3A3C45" strokeWidth="1.2" />
      {[44, 39.5, 35, 30.5, 26].map((r) => (
        <circle key={r} r={r} fill="none" stroke="#2C2E35" strokeWidth="1.4" />
      ))}
      {/* the sheen: light caught in the grooves */}
      <path d="M-40 -22 A46 46 0 0 1 -18 -42" stroke="#fff" strokeWidth="5" opacity="0.22" fill="none" strokeLinecap="round" />
      <path d="M38 24 A46 46 0 0 1 20 40" stroke="#fff" strokeWidth="3" opacity="0.12" fill="none" strokeLinecap="round" />
      <circle r="19" fill={label} />
      <circle r="19" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1.2" />
      <MasterMark x={0} y={-1} size={24} color={STUDIO.ink} />
      <circle r="2.6" fill={STUDIO.ink} />
    </g>
  );
}

/** The emblem on its own, for the banner, the achievements band and the scenes. */
export function StudioEmblemSvg({ size = 64, label, className, title }: { size?: number; label?: string; className?: string; title?: string }) {
  return (
    <svg
      viewBox="-54 -54 108 108"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle r="53" fill="#fff" opacity="0.14" />
      <StudioRecord x={0} y={0} size={100} label={label} />
    </svg>
  );
}

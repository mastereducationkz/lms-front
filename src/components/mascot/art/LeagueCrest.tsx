/**
 * The Master League crest (owner, 2026-10-13): a navy shield with a gold rim and the Master sunburst
 * «M» in gold. One drawing, three homes: the League Jersey's chest, the League Crest frame's badge,
 * and the season banner / welcome scene (as a standalone svg). Flat fills only (no gradient ids), so
 * it can be drawn any number of times in one document.
 */
import { MasterMark } from './MasterMark';

export const LEAGUE = {
  night: '#07122E',
  navy: '#0B1B4D',
  navy2: '#14307A',
  blue: '#2563EB',
  sky: '#5B8DFF',
  gold: '#F7C948',
  goldHi: '#FFE07A',
  goldDark: '#C98A00',
} as const;

/** Shield outline in a 100 × 120 box centred on the origin (x −50…50, y −58…62). */
const SHIELD = 'M0 -58 C 18 -52 36 -51 50 -53 L50 6 C 50 36 26 54 0 62 C -26 54 -50 36 -50 6 L-50 -53 C -36 -51 -18 -52 0 -58 Z';
/** The same, inset, for the lit panel inside the rim. */
const PANEL = 'M0 -49 C 15 -44 30 -43 42 -45 L42 5 C 42 31 22 46 0 53 C -22 46 -42 31 -42 5 L-42 -45 C -30 -43 -15 -44 0 -49 Z';

interface CrestProps {
  /** Centre of the shield in the parent's coordinates. */
  x: number;
  y: number;
  /** Width of the shield in the parent's units (it is 1.2× as tall). */
  size: number;
  /** Draw the three small stars over the «M» (the banner and welcome scene; too fine for a 24 px badge). */
  stars?: boolean;
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={LEAGUE.gold} />;
}

export function LeagueCrest({ x, y, size, stars = false }: CrestProps) {
  const k = size / 100;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <path d={SHIELD} fill={LEAGUE.gold} stroke={LEAGUE.goldDark} strokeWidth="3" strokeLinejoin="round" />
      <path d={PANEL} fill={LEAGUE.navy2} />
      {/* lit upper half, a quiet gloss */}
      <path d="M0 -49 C 15 -44 30 -43 42 -45 L42 -8 C 24 -2 10 -6 0 -14 C -10 -6 -24 -2 -42 -8 L-42 -45 C -30 -43 -15 -44 0 -49 Z" fill={LEAGUE.sky} opacity="0.28" />
      <path d={PANEL} fill="none" stroke={LEAGUE.goldHi} strokeWidth="1.8" opacity="0.7" />
      <MasterMark x={0} y={stars ? 8 : 4} size={stars ? 54 : 62} color={LEAGUE.gold} />
      {stars && (
        <g>
          <Star x={-20} y={-30} r={6} />
          <Star x={0} y={-35} r={7.5} />
          <Star x={20} y={-30} r={6} />
        </g>
      )}
    </g>
  );
}

/** The crest on its own, for the banner and the welcome scene. */
export function LeagueCrestSvg({ size = 64, stars = true, className, title }: { size?: number; stars?: boolean; className?: string; title?: string }) {
  return (
    <svg viewBox="-56 -64 112 132" width={size} height={size * (132 / 112)} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <LeagueCrest x={0} y={0} size={100} stars={stars} />
    </svg>
  );
}

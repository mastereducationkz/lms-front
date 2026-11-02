/**
 * Master League season 2 «Studio» hats (owner, 2026-11-02), appended after the Golden Laurel:
 * h29 Studio Headphones (Signed), h30 Vinyl Snapback (Three-Peat), h31 Diamond Headphones (Diamond,
 * a perfect 1600). Charcoal, gold and ice: a notch richer than the free pink headphones (h2), which
 * they must never be mistaken for.
 */
import type { ReactNode } from 'react';
import type { Piece } from './hats';
import { STUDIO, StudioRecord } from './StudioEmblem';

function Glint({ x, y, r, fill = '#FFF6C8' }: { x: number; y: number; r: number; fill?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={fill} />;
}

interface Cans {
  band: [string, string];
  cushion: string;
  slider: string;
  sliderEdge: string;
  shell: string;
  rim: string;
  pad: string;
  /** What sits on the face of each ear cup, centred on (cx, cy). */
  face: (cx: number, cy: number, uid: string, side: 'l' | 'r') => ReactNode;
}

/** Over-ear studio monitors: a padded headband, sliders, big round cups over the eye patches' line. */
function headphones(c: Cans, opts: { cable?: boolean } = {}): Piece {
  return {
    front: (uid) => (
      <g>
        <linearGradient id={`${uid}cb`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.band[0]} />
          <stop offset="1" stopColor={c.band[1]} />
        </linearGradient>
        {/* coiled cable from the left cup, behind everything else */}
        {opts.cable && (
          <path
            d="M24 138 c -7 4 -7 9 0 11 c 7 2 7 7 0 11 c -7 4 -7 9 0 11 c 7 2 7 7 0 11 c -7 4 -6 9 2 12 L30 214"
            stroke={c.shell}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* the headband and its padded cushion */}
        <path d="M30 110 C 26 28 174 28 170 110" stroke={`url(#${uid}cb)`} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M66 46 Q100 28 134 46" stroke={c.cushion} strokeWidth="15" fill="none" strokeLinecap="round" />
        <path d="M68 44 Q100 28 132 44" stroke={c.slider} strokeWidth="1.4" fill="none" strokeDasharray="3 3" opacity="0.8" />
        <path d="M72 39 Q100 28 116 32" stroke="#fff" strokeWidth="2.4" opacity="0.22" fill="none" strokeLinecap="round" />
        {/* sliders */}
        {[26, 164].map((x) => (
          <rect key={x} x={x} y="78" width="10" height="20" rx="3" fill={c.slider} stroke={c.sliderEdge} strokeWidth="1.2" />
        ))}
        {/* pads against the head, then the cups */}
        <rect x="39" y="99" width="10" height="38" rx="5" fill={c.pad} />
        <rect x="151" y="99" width="10" height="38" rx="5" fill={c.pad} />
        {([[27, 'l'], [173, 'r']] as const).map(([cx, side]) => (
          <g key={side}>
            <ellipse cx={cx} cy="118" rx="17" ry="22" fill={c.shell} />
            <ellipse cx={cx} cy="118" rx="14" ry="19" fill="none" stroke={c.rim} strokeWidth="2.6" />
            {c.face(cx, 118, uid, side)}
          </g>
        ))}
      </g>
    ),
  };
}

/** h29: matte charcoal monitors with gold sliders and a little record on each cup. */
const studioHeadphones = headphones(
  {
    band: ['#4A4C56', STUDIO.ink],
    cushion: STUDIO.ink2,
    slider: STUDIO.gold,
    sliderEdge: STUDIO.goldDark,
    shell: STUDIO.ink,
    rim: STUDIO.gold,
    pad: STUDIO.ink3,
    face: (cx, cy, _uid, side) => (
      <g>
        <StudioRecord x={cx} y={cy} size={20} />
        {side === 'r' && <Glint x={cx + 9} y={cy - 16} r={3.6} />}
      </g>
    ),
  },
  { cable: true },
);

/** A faceted gem on the cup: the outline, its table and a few facet lines. */
function Gem({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g>
      <path d={`M${cx - 9} ${cy - 3} L${cx - 5} ${cy - 9} L${cx + 5} ${cy - 9} L${cx + 9} ${cy - 3} L${cx} ${cy + 10} Z`} fill="#F4FBFF" stroke="#5FA8E0" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={`M${cx - 9} ${cy - 3} H${cx + 9} M${cx - 5} ${cy - 9} L${cx - 2.5} ${cy - 3} L${cx} ${cy + 10} L${cx + 2.5} ${cy - 3} L${cx + 5} ${cy - 9}`} stroke="#7EC2EE" strokeWidth="1" fill="none" strokeLinejoin="round" />
      <path d={`M${cx - 4} ${cy - 7} L${cx - 1} ${cy - 4}`} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

/** h31: ice-white and platinum, a cut diamond on each cup, sparks round the band. The perfect score. */
const diamondHeadphonesBase = headphones({
  band: ['#FFFFFF', '#9FD3F5'],
  cushion: '#DDF0FC',
  slider: '#C9D3DE',
  sliderEdge: '#8C9AAB',
  shell: '#BFE3FA',
  rim: '#FFFFFF',
  pad: '#9DB8CE',
  face: (cx, cy) => <Gem cx={cx} cy={cy} />,
});

const diamondHeadphones: Piece = {
  front: (uid) => (
    <g>
      {diamondHeadphonesBase.front?.(uid)}
      <path d="M38 96 C 36 52 70 38 92 36" stroke="#fff" strokeWidth="2.6" opacity="0.8" fill="none" strokeLinecap="round" />
      <Glint x={100} y={22} r={6} fill="#fff" />
      <Glint x={146} y={40} r={4.5} fill="#E6F6FF" />
      <Glint x={58} y={38} r={3.6} fill="#fff" />
      <Glint x={186} y={92} r={3.4} fill="#E6F6FF" />
    </g>
  ),
};

/** h30: a flat-brim snapback in charcoal with a gold button and a little record stitched on the front. */
const vinylSnapback: Piece = {
  noDorsal: true,
  front: (uid) => (
    <g transform="rotate(-6 100 64)">
      <linearGradient id={`${uid}snap`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={STUDIO.ink3} />
        <stop offset="0.6" stopColor={STUDIO.ink2} />
        <stop offset="1" stopColor={STUDIO.ink} />
      </linearGradient>
      {/* crown: six panels over the whole top of the head */}
      <path d="M44 86 C 40 30 160 30 156 86 Q100 76 44 86 Z" fill={`url(#${uid}snap)`} />
      <path d="M100 36 C 88 50 84 66 86 80 M100 36 C 112 50 116 66 114 80 M100 36 C 72 42 58 60 56 82 M100 36 C 128 42 142 60 144 82" stroke="#000" strokeOpacity="0.3" strokeWidth="1.2" fill="none" />
      <path d="M56 70 C 58 54 70 44 84 40" stroke="#fff" strokeWidth="2.6" opacity="0.18" fill="none" strokeLinecap="round" />
      {/* the flat brim, straight out over the eyes, gold piping on its edge */}
      <path d="M40 84 Q100 72 160 84 L170 96 Q100 84 30 96 Z" fill={STUDIO.ink} />
      <path d="M30 96 Q100 84 170 96" stroke={STUDIO.gold} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* the record patch and the gold button */}
      <StudioRecord x={100} y={58} size={34} />
      <circle cx="100" cy="34.5" r="4.4" fill={STUDIO.gold} stroke={STUDIO.goldDark} strokeWidth="1" />
      <Glint x={134} y={48} r={4} />
    </g>
  ),
};

/** Appended after the Golden Laurel (h29, h30, h31). */
export const STUDIO_HATS: Piece[] = [studioHeadphones, vinylSnapback, diamondHeadphones];

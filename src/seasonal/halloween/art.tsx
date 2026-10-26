/**
 * The Halloween drawings (owner, 2026-10-26): cute, never scary — no skulls, blood or occult signs.
 * Flat fills in one small palette, no strokes, no gradients, no glows; every piece is decorative
 * (aria-hidden) and paired with text wherever it means something.
 */
import type { CSSProperties } from 'react';

export const INK = {
  pumpkin: '#F97316',
  pumpkinDeep: '#EA580C',
  pumpkinFace: '#431407',
  stem: '#4D7C0F',
  leaf: '#65A30D',
  night: '#1E1433',
  nightDeep: '#130C22',
  violet: '#4C1D95',
  hat: '#2E1065',
  moon: '#FDE68A',
  crater: '#FCD34D',
  bat: '#0F0A1C',
  ghost: '#F8FAFC',
  blush: '#FDA4AF',
  broomStick: '#92400E',
  broomStraw: '#D97706',
  broomBand: '#B45309',
} as const;

interface ArtProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const svgProps = (size: number | undefined, viewBox: string, className?: string, style?: CSSProperties) => ({
  viewBox,
  width: size,
  height: size,
  className,
  style,
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

/** A pumpkin; with a friendly face unless `plain`. */
export function Pumpkin({ size = 24, className, style, plain = false, hollow = false }: ArtProps & { plain?: boolean; hollow?: boolean }) {
  if (hollow) {
    // Not found yet: the same pumpkin as a faint silhouette in the text colour.
    return (
      <svg {...svgProps(size, '0 0 48 48', className, style)}>
        <g fill="currentColor" opacity=".28">
          <path d="M22.6 6.4c.4-1.6 2.6-1.8 3.3-.3l.9 2c.5 1.1.5 2.6 0 4.9h-4.9c.3-2.6.3-4.9.7-6.6Z" />
          <ellipse cx="13.2" cy="28" rx="11.2" ry="14" />
          <ellipse cx="34.8" cy="28" rx="11.2" ry="14" />
          <ellipse cx="24" cy="27.6" rx="12.4" ry="14.6" />
        </g>
      </svg>
    );
  }
  return (
    <svg {...svgProps(size, '0 0 48 48', className, style)}>
      <path d="M22.6 6.4c.4-1.6 2.6-1.8 3.3-.3l.9 2c.5 1.1.5 2.6 0 4.9h-4.9c.3-2.6.3-4.9.7-6.6Z" fill={INK.stem} />
      <path d="M27 9.2c2.6-2.6 6.8-3.3 9.6-1.6-1.5 3.2-5.6 4.8-9.6 4.3Z" fill={INK.leaf} />
      <ellipse cx="13.2" cy="28" rx="11.2" ry="14" fill={INK.pumpkinDeep} />
      <ellipse cx="34.8" cy="28" rx="11.2" ry="14" fill={INK.pumpkinDeep} />
      <ellipse cx="24" cy="27.6" rx="12.4" ry="14.6" fill={INK.pumpkin} />
      {!plain && (
        <g fill={INK.pumpkinFace}>
          <path d="M15.2 25.4 18.8 20l3.4 5.4c.3.5 0 1.1-.6 1.1h-5.8c-.6 0-.9-.6-.6-1.1Z" />
          <path d="M25.8 25.4 29.2 20l3.6 5.4c.3.5 0 1.1-.6 1.1h-5.8c-.6 0-.9-.6-.6-1.1Z" />
          <path d="M14.8 30.6c.2-.6.9-.8 1.4-.5l2.4 1.4 2.6-1.6c.4-.2.9-.2 1.2 0l1.6 1.1 1.6-1.1c.4-.2.9-.2 1.2 0l2.6 1.6 2.4-1.4c.5-.3 1.2-.1 1.4.5.4 1.4-.3 3.8-2.6 5.6-2 1.6-4.4 2.4-6.6 2.4s-4.6-.8-6.6-2.4c-2.3-1.8-3-4.2-2.6-5.6Z" />
        </g>
      )}
    </svg>
  );
}

/** A bat seen from the front. Its wings carry `data-wing` so a flight can flap them. */
export function Bat({ size = 48, className, style, color = INK.bat, membrane }: ArtProps & { color?: string; membrane?: string }) {
  return (
    <svg {...svgProps(size, '0 0 64 32', className, style)} height={size / 2}>
      <g data-wing="left" style={{ transformOrigin: '28px 14px' }}>
        <path d="M28 14C24 8 16 5 4 7c3 2 4 4 4 7 3-1 6 0 7 3 2-2 5-2 7 0 1-2 3-3 6-3Z" fill={color} />
        {membrane && <path d="M26 13.4c-3.4-3.8-9-5.6-17-5 2 1.6 2.8 3.2 2.8 5.2 2.2-.4 4.4.4 5.4 2.2 1.8-1.2 4-1.2 5.6 0 .8-1.4 1.8-2.2 3.2-2.4Z" fill={membrane} />}
      </g>
      <g data-wing="right" style={{ transformOrigin: '36px 14px' }}>
        <path d="M36 14c4-6 12-9 24-7-3 2-4 4-4 7-3-1-6 0-7 3-2-2-5-2-7 0-1-2-3-3-6-3Z" fill={color} />
        {membrane && <path d="M38 13.4c3.4-3.8 9-5.6 17-5-2 1.6-2.8 3.2-2.8 5.2-2.2-.4-4.4.4-5.4 2.2-1.8-1.2-4-1.2-5.6 0-.8-1.4-1.8-2.2-3.2-2.4Z" fill={membrane} />}
      </g>
      <g fill={color}>
        <ellipse cx="32" cy="16.5" rx="5.6" ry="7" />
        <path d="M27.6 11.2 27 5.6l3.6 3.4ZM36.4 11.2 37 5.6l-3.6 3.4Z" />
      </g>
      <circle cx="30" cy="14.6" r="1.1" fill={INK.pumpkin} />
      <circle cx="34" cy="14.6" r="1.1" fill={INK.pumpkin} />
    </svg>
  );
}

/** A witch hat, tip bent, tilted to sit on an avatar's top-right. */
export function WitchHat({ size = 24, className, style }: ArtProps) {
  return (
    <svg {...svgProps(size, '0 0 40 40', className, style)}>
      <ellipse cx="20" cy="31" rx="18" ry="5.4" fill={INK.hat} />
      <path d="M9.6 30.4C12 21 15 11.6 21.4 4.6c1.6-1.7 4.6-1.2 5.4 1 .4 1.2-.4 2.2-1.6 2.4-1.8.3-2.4 2-2 4.2l3.6 18.2Z" fill={INK.hat} />
      <path d="M10.6 26.4c6.2 1.6 12.4 1.6 16.8 0l.8 4c-5.6 1.8-12 1.8-18.6 0Z" fill={INK.pumpkin} />
      <circle cx="26.4" cy="5.8" r="1.6" fill={INK.moon} />
    </svg>
  );
}

/** Black cat ears, drawn to sit along the top of an avatar. */
export function CatEars({ size = 24, className, style }: ArtProps) {
  return (
    <svg {...svgProps(size, '0 0 40 16', className, style)} height={size ? (size * 16) / 40 : undefined}>
      <path d="M3 15 6.4 1.6c.2-.8 1.2-1 1.8-.5L17 9.6Z" fill={INK.bat} />
      <path d="M37 15 33.6 1.6c-.2-.8-1.2-1-1.8-.5L23 9.6Z" fill={INK.bat} />
      <path d="M6.6 12.4 8.2 5.2l4.6 4.6Z" fill={INK.blush} />
      <path d="M33.4 12.4 31.8 5.2l-4.6 4.6Z" fill={INK.blush} />
    </svg>
  );
}

/** A friendly ghost. */
export function Ghost({ size = 48, className, style }: ArtProps) {
  return (
    <svg {...svgProps(size, '0 0 48 56', className, style)}>
      <path d="M24 3C13.4 3 6 11 6 22v28c0 1.8 2 2.6 3.2 1.4l3.4-3.2 3.6 3.6c.8.8 2 .8 2.8 0L24 48.4l5 3.4c.8.8 2 .8 2.8 0l3.6-3.6 3.4 3.2c1.2 1.2 3.2.4 3.2-1.4V22C42 11 34.6 3 24 3Z" fill={INK.ghost} />
      <ellipse cx="18" cy="22" rx="2.8" ry="3.8" fill={INK.night} />
      <ellipse cx="30" cy="22" rx="2.8" ry="3.8" fill={INK.night} />
      <ellipse cx="24" cy="31" rx="3" ry="2.4" fill={INK.night} />
      <ellipse cx="13.4" cy="28" rx="2.6" ry="1.6" fill={INK.blush} />
      <ellipse cx="34.6" cy="28" rx="2.6" ry="1.6" fill={INK.blush} />
    </svg>
  );
}

/** A full moon with a few craters. */
export function Moon({ size = 64, className, style }: ArtProps) {
  return (
    <svg {...svgProps(size, '0 0 64 64', className, style)}>
      <circle cx="32" cy="32" r="30" fill={INK.moon} />
      <circle cx="22" cy="22" r="6" fill={INK.crater} />
      <circle cx="40" cy="38" r="8" fill={INK.crater} />
      <circle cx="24" cy="44" r="3.6" fill={INK.crater} />
      <circle cx="44" cy="20" r="2.6" fill={INK.crater} />
    </svg>
  );
}

const CANDY_COLOURS = [
  [INK.pumpkin, '#FFEDD5'],
  ['#7C3AED', '#EDE9FE'], // Halloween purple, by brief. taste-skill-ignore
  ['#16A34A', '#DCFCE7'],
  ['#E11D48', '#FFE4E6'],
  ['#FACC15', '#FEF9C3'],
] as const;

/** A wrapped sweet; `variant` picks its colours. */
export function Candy({ size = 28, className, style, variant = 0 }: ArtProps & { variant?: number }) {
  const [main, stripe] = CANDY_COLOURS[Math.abs(variant) % CANDY_COLOURS.length];
  return (
    <svg {...svgProps(size, '0 0 48 24', className, style)}>
      <path d="M12 12 2 4.4c-.8-.6-2 0-1.8 1L1.6 12 .2 18.6c-.2 1 1 1.6 1.8 1Z" fill={main} />
      <path d="M36 12 46 4.4c.8-.6 2 0 1.8 1L46.4 12l1.4 6.6c.2 1-1 1.6-1.8 1Z" fill={main} />
      <ellipse cx="24" cy="12" rx="13" ry="9" fill={main} />
      <path d="M17 4.6c3 4.4 3 10.4 0 14.8M25 3c3 5.4 3 12.6 0 18" stroke={stripe} strokeWidth="2.6" fill="none" />
    </svg>
  );
}

/** A witch's broom, lying left to right. */
export function Broom({ size = 120, className, style }: ArtProps) {
  return (
    <svg {...svgProps(size, '0 0 120 40', className, style)} height={size ? (size * 40) / 120 : undefined}>
      <rect x="4" y="17" width="78" height="5" rx="2.5" fill={INK.broomStick} transform="rotate(-6 43 19.5)" />
      <path d="M80 15.6c8-4 22-6.6 36-4.4 2 .4 2.4 2.8.6 3.8L104 22l12.6 6.6c1.8 1 1.4 3.6-.6 3.8-14 2.4-28-.2-36-4.2Z" fill={INK.broomStraw} />
      <rect x="78" y="13.4" width="7" height="15.6" rx="2.4" fill={INK.broomBand} transform="rotate(-6 81.5 21.2)" />
    </svg>
  );
}

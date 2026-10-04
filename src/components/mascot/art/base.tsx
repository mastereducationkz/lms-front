/**
 * The orca itself, in a 200×200 viewBox drawn for a circular crop: a chubby front-facing
 * bust (black back, white belly, white eye patches), soft gloss and a white "sticker" rim.
 * Everything else anchors to the points below.
 */
import type { ReactNode } from 'react';

export const INK = '#1B2236';
export const BELLY = '#FBF7F0';
export const EYE = '#10162B';
export const MOUTH = '#B8264A';
export const TONGUE = '#FF94AE';

/** Eye centres (on the white patches), head top and the belly line. */
export const EYE_L = { x: 76, y: 106 };
export const EYE_R = { x: 124, y: 106 };
export const HEAD_TOP = { x: 100, y: 54 };

export const BODY_PATH = 'M24 210 C 16 130 38 54 100 54 C 162 54 184 130 176 210 Z';
const BELLY_PATH = 'M40 210 C 38 160 62 134 100 134 C 138 134 162 160 160 210 Z';
/** Raised (waving) left fin and the resting right fin. */
const FIN_L_PATH = 'M38 150 C 22 148 8 134 4 114 C 20 112 36 124 46 138 Z';
const FIN_R_PATH = 'M150 152 C 166 150 184 160 192 178 C 176 182 158 176 146 166 Z';
/** The orca's tall dorsal fin, peeking up behind the head (hidden under an astronaut helmet). */
const DORSAL_PATH = 'M88 62 C 100 52 110 44 124 32 C 126 44 128 56 134 66 Z';

export function OrcaDefs({ uid }: { uid: string }) {
  return (
    <>
      <linearGradient id={`${uid}ink`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#36425F" />
        <stop offset="0.55" stopColor={INK} />
        <stop offset="1" stopColor="#121726" />
      </linearGradient>
      <radialGradient id={`${uid}belly`} cx="0.5" cy="0.25" r="0.8">
        <stop offset="0.55" stopColor={BELLY} />
        <stop offset="1" stopColor="#E6DCCD" />
      </radialGradient>
      <clipPath id={`${uid}body`}>
        <path d={BODY_PATH} />
      </clipPath>
    </>
  );
}

/** White sticker rim behind a shape. */
function Rim({ d }: { d: string }) {
  return <path d={d} fill="#fff" stroke="#fff" strokeWidth={7} strokeLinejoin="round" />;
}

export function OrcaBody({ uid, dorsal = true }: { uid: string; dorsal?: boolean }) {
  return (
    <g>
      {dorsal && <Rim d={DORSAL_PATH} />}
      {dorsal && <path d={DORSAL_PATH} fill={`url(#${uid}ink)`} />}
      {dorsal && <path d="M106 50 C 112 45 117 41 122 37" stroke="#fff" strokeWidth="2.4" opacity="0.22" strokeLinecap="round" fill="none" />}
      <Rim d={BODY_PATH} />
      <Rim d={FIN_L_PATH} />
      <path d={FIN_L_PATH} fill={`url(#${uid}ink)`} />
      <path d={BODY_PATH} fill={`url(#${uid}ink)`} />
      <path d={BELLY_PATH} fill={`url(#${uid}belly)`} />
      <path d="M152 74 C 168 92 176 120 177 152" stroke="#9EC2FF" strokeOpacity="0.28" strokeWidth="5" fill="none" strokeLinecap="round" clipPath={`url(#${uid}body)`} />
      {/* gloss */}
      <ellipse cx="70" cy="80" rx="28" ry="12" fill="#fff" opacity="0.16" transform="rotate(-26 70 80)" />
      <circle cx="58" cy="80" r="4.5" fill="#fff" opacity="0.5" />
      <ellipse cx="18" cy="124" rx="6" ry="3" fill="#fff" opacity="0.22" transform="rotate(-40 18 124)" />
      {/* the orca's white eye patches: small ovals behind the eyes, sloping up toward the back */}
      <ellipse cx="50" cy="92" rx="13" ry="7.5" fill="#fff" transform="rotate(28 50 92)" />
      <ellipse cx="150" cy="92" rx="13" ry="7.5" fill="#fff" transform="rotate(-28 150 92)" />
    </g>
  );
}

/** The resting right fin — drawn last so it can hold a prop. */
export function OrcaFinRight({ uid }: { uid: string }) {
  return (
    <g>
      <Rim d={FIN_R_PATH} />
      <path d={FIN_R_PATH} fill={`url(#${uid}ink)`} />
      <ellipse cx="172" cy="164" rx="7" ry="2.6" fill="#fff" opacity="0.2" transform="rotate(25 172 164)" />
    </g>
  );
}

/** Rosy cheeks under the eyes. */
export function Blush() {
  return (
    <g fill="#FF9DB8" opacity="0.7">
      <ellipse cx="66" cy="150" rx="7" ry="4" />
      <ellipse cx="134" cy="150" rx="7" ry="4" />
    </g>
  );
}

export type Layer = (props: { uid: string }) => ReactNode;

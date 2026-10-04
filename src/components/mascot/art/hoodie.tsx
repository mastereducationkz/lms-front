/** «Master hoodie» (owner, 2026-10-04): brand-blue hoodie, hood down behind the head, white emblem. */
import { BODY_PATH } from './base';
import type { Piece } from './hats';
import { BRAND_BLUE, MasterMark } from './MasterMark';

const SHADE = '#1D4ED8';

export const masterHoodie: Piece = {
  // the hood covers the back, so the dorsal fin is tucked away
  noDorsal: true,
  back: () => (
    <g>
      {/* the hood, up: a soft peak at the crown, a centre seam, darker inside where the head sits */}
      <path d="M18 162 C 8 96 44 40 100 32 C 156 40 192 96 182 162 Z" fill={BRAND_BLUE} stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 158 C 26 104 58 52 100 48 C 142 52 174 104 168 158 Z" fill={SHADE} />
      <path d="M100 34 L100 48" stroke={SHADE} strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),
  front: (uid) => (
    <g>
      <clipPath id={`${uid}hoodie`}>
        <path d={BODY_PATH} />
      </clipPath>
      <g clipPath={`url(#${uid}hoodie)`}>
        <path d="M0 214 L0 166 Q36 150 72 158 Q100 166 128 158 Q164 150 200 166 L200 214 Z" fill={BRAND_BLUE} />
        <path d="M2 170 Q36 155 72 162" stroke="#3B82F6" strokeWidth="3" fill="none" opacity="0.8" />
      </g>
      <path d="M58 160 Q100 178 142 160" stroke={SHADE} strokeWidth="7" fill="none" strokeLinecap="round" />
      <g stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M80 168 Q78 176 79 184" />
        <path d="M120 168 Q122 176 121 184" />
      </g>
      <rect x="76.5" y="183" width="5" height="7" rx="2" fill="#fff" />
      <rect x="118.5" y="183" width="5" height="7" rx="2" fill="#fff" />
      <MasterMark x={100} y={185} size={26} color="#fff" />
    </g>
  ),
};

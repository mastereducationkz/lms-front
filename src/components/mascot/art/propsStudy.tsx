/** Study props. Held ones sit just above the resting right fin (which is drawn over them). */
import type { PropPiece } from './props';
import { BRAND_BLUE, MasterMark } from './MasterMark';

function Steam({ x }: { x: number }) {
  return (
    <g stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.85">
      <path d={`M${x} 122 C ${x - 5} 116 ${x + 5} 112 ${x} 106`} />
      <path d={`M${x + 9} 120 C ${x + 4} 114 ${x + 14} 110 ${x + 9} 104`} />
    </g>
  );
}

export const laptop: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}lid`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#EEF2F8" />
        <stop offset="1" stopColor="#AEB8C9" />
      </linearGradient>
      <rect x="54" y="160" width="92" height="50" rx="7" fill={`url(#${uid}lid)`} stroke="#fff" strokeWidth="2" />
      <MasterMark x={100} y={183} size={28} color={BRAND_BLUE} />
      <rect x="40" y="203" width="120" height="8" rx="3" fill="#8F9AAE" />
    </g>
  ),
};

/** A Master Education hardcover: brand-blue cover, white emblem, page block peeking out. */
export const book: PropPiece = {
  front: () => (
    <g transform="rotate(-5 100 186)">
      <rect x="64" y="163" width="76" height="52" rx="5" fill="#EEF1F7" stroke="#fff" strokeWidth="1.5" />
      <path d="M134 168 L134 212 M137 167 L137 212" stroke="#C9D2E3" strokeWidth="1.2" />
      <rect x="58" y="160" width="76" height="54" rx="5" fill={BRAND_BLUE} stroke="#fff" strokeWidth="2" />
      <rect x="58" y="160" width="9" height="54" rx="3" fill="#1D4ED8" />
      <MasterMark x={100.5} y={185} size={28} color="#fff" />
    </g>
  ),
};

export const coffee: PropPiece = {
  front: () => (
    <g>
      <Steam x={158} />
      <path d="M177 134 a8 8 0 1 1 0 16" stroke={BRAND_BLUE} strokeWidth="4.5" fill="none" />
      <rect x="147" y="124" width="32" height="34" rx="6" fill={BRAND_BLUE} stroke="#fff" strokeWidth="1.8" />
      <ellipse cx="163" cy="125.5" rx="14" ry="3" fill="#7A4A2B" />
      <MasterMark x={163} y={142} size={21} color="#fff" />
    </g>
  ),
};

export const pillow: PropPiece = {
  front: () => (
    <g>
      <path d="M44 174 Q100 156 156 174 Q166 192 158 214 L42 214 Q34 192 44 174 Z" fill="#E7E0FF" stroke="#fff" strokeWidth="2" />
      <path d="M60 182 Q100 170 140 182" stroke="#C9BCFF" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M100 196 c -4 -5 -11 -1 -7 5 l7 6 l7 -6 c 4 -6 -3 -10 -7 -5 Z" fill="#FF9DB8" />
    </g>
  ),
};

export const calculator: PropPiece = {
  front: () => (
    <g transform="rotate(10 162 140)">
      <rect x="146" y="114" width="32" height="46" rx="6" fill="#3D4663" stroke="#fff" strokeWidth="2" />
      <rect x="150" y="118" width="24" height="11" rx="2" fill="#B8F5C4" />
      <text x="172" y="127" textAnchor="end" fontSize="8" fontWeight="800" fill="#1B5E2B" fontFamily="Arial, Helvetica, sans-serif">1600</text>
      <g fill="#E5EAF5">
        {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={151 + c * 8} y={133 + r * 7} width="5.5" height="4.5" rx="1.2" />
        )))}
      </g>
      <rect x="167" y="133" width="5.5" height="18.5" rx="1.2" fill="#FF8A3D" />
    </g>
  ),
};

export const quill: PropPiece = {
  front: () => (
    <g transform="rotate(28 166 140)">
      <path d="M166 98 C 182 112 182 140 168 166 C 156 140 154 112 166 98 Z" fill="#FFF7E6" stroke="#E8D9B8" strokeWidth="1.6" />
      <path d="M166 104 L167 170" stroke="#C9A86B" strokeWidth="2" />
      <path d="M160 120 L166 126 M161 132 L166 137 M172 118 L167 124 M173 130 L167 135" stroke="#E8D9B8" strokeWidth="1.6" />
      <path d="M164 166 L167 180 L170 166 Z" fill="#2B2F45" />
    </g>
  ),
};

export const pencil: PropPiece = {
  front: () => (
    <g transform="rotate(26 166 142)">
      <rect x="159" y="102" width="14" height="60" fill="#FFC531" />
      <rect x="159" y="102" width="4.5" height="60" fill="#FFE07A" />
      <rect x="159" y="94" width="14" height="10" rx="3" fill="#FF8FB1" />
      <rect x="159" y="102" width="14" height="4" fill="#C9CED8" />
      <path d="M159 162 L166 178 L173 162 Z" fill="#F4D9B0" />
      <path d="M164 172 L166 178 L168 172 Z" fill="#2B2F45" />
    </g>
  ),
};

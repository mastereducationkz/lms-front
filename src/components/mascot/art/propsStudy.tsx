/** Study props. Held ones sit just above the resting right fin (which is drawn over them). */
import type { PropPiece } from './props';

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
      <circle cx="100" cy="184" r="9" fill="#2F6BFF" />
      <path d="M100 178 L101.8 182.2 L106 182.6 L102.8 185.4 L103.8 189.6 L100 187.4 L96.2 189.6 L97.2 185.4 L94 182.6 L98.2 182.2 Z" fill="#fff" />
      <rect x="40" y="203" width="120" height="8" rx="3" fill="#8F9AAE" />
    </g>
  ),
};

export const book: PropPiece = {
  front: () => (
    <g>
      <path d="M52 172 Q78 160 100 170 Q122 160 148 172 L148 212 L52 212 Z" fill="#2F6BFF" />
      <path d="M57 172 Q78 162 100 172 L100 210 Q78 200 57 210 Z" fill="#fff" />
      <path d="M143 172 Q122 162 100 172 L100 210 Q122 200 143 210 Z" fill="#F4F1EA" />
      <g stroke="#B9C2D3" strokeWidth="2" strokeLinecap="round">
        <path d="M64 180 Q78 175 93 181 M64 188 Q78 183 93 189 M64 196 Q78 191 90 196" />
        <path d="M107 181 Q122 175 136 180 M107 189 Q122 183 136 188 M110 196 Q122 191 136 196" />
      </g>
    </g>
  ),
};

export const coffee: PropPiece = {
  front: () => (
    <g>
      <Steam x={158} />
      <path d="M176 134 a8 8 0 1 1 0 16" stroke="#FF6B6B" strokeWidth="4.5" fill="none" />
      <rect x="148" y="126" width="30" height="32" rx="6" fill="#FF6B6B" />
      <rect x="148" y="136" width="30" height="6" fill="#fff" opacity="0.9" />
      <ellipse cx="163" cy="127" rx="13" ry="3" fill="#7A4A2B" />
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

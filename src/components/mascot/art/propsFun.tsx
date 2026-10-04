/** Dream & fun props. */
import type { PropPiece } from './props';

export const rocket: PropPiece = {
  front: () => (
    <g transform="rotate(32 164 138)">
      <path d="M156 160 Q164 176 172 160 Q170 170 164 182 Q158 170 156 160 Z" fill="#FFB020" />
      <path d="M164 98 C 176 110 178 138 174 160 L154 160 C 150 138 152 110 164 98 Z" fill="#fff" stroke="#E3E8F2" strokeWidth="1.5" />
      <path d="M164 98 C 170 104 173 110 175 118 L153 118 C 155 110 158 104 164 98 Z" fill="#FF4D6D" />
      <circle cx="164" cy="132" r="6.5" fill="#4DA3FF" stroke="#2B5FD9" strokeWidth="2" />
      <path d="M154 146 L144 164 L155 160 Z M174 146 L184 164 L173 160 Z" fill="#FF4D6D" />
    </g>
  ),
};

export const guitar: PropPiece = {
  front: () => (
    <g transform="rotate(32 116 178)">
      <rect x="110.5" y="96" width="11" height="60" rx="2" fill="#8A5A2E" />
      <rect x="107.5" y="86" width="17" height="14" rx="4" fill="#3D2A1C" />
      <circle cx="116" cy="192" r="23" fill="#FF5C5C" stroke="#fff" strokeWidth="2" />
      <circle cx="116" cy="166" r="16" fill="#FF5C5C" stroke="#fff" strokeWidth="2" />
      <rect x="103" y="156" width="26" height="22" fill="#FF5C5C" />
      <circle cx="116" cy="180" r="7" fill="#2B2F45" />
      <rect x="106" y="196" width="20" height="5" rx="2" fill="#2B2F45" />
      <g stroke="#F4E9D8" strokeWidth="0.9" opacity="0.85">
        <path d="M113.5 98 L113.5 198 M116 98 L116 198 M118.5 98 L118.5 198" />
      </g>
    </g>
  ),
};

export const controller: PropPiece = {
  front: () => (
    <g>
      <path d="M62 170 Q100 162 138 170 Q154 174 154 192 Q152 208 136 206 Q124 198 100 198 Q76 198 64 206 Q48 208 46 192 Q46 174 62 170 Z" fill="#5B6CFF" stroke="#fff" strokeWidth="2" />
      <path d="M72 184 L84 184 M78 178 L78 190" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="122" cy="180" r="3.6" fill="#FF5C8A" />
      <circle cx="130" cy="186" r="3.6" fill="#FFD84D" />
      <circle cx="114" cy="186" r="3.6" fill="#7FE0FF" />
      <circle cx="122" cy="192" r="3.6" fill="#7CF29A" />
    </g>
  ),
};

export const magnifier: PropPiece = {
  front: () => (
    <g>
      <path d="M170 196 L158 158" stroke="#8A5A2E" strokeWidth="8" strokeLinecap="round" />
      <circle cx="152" cy="138" r="17" fill="#BFE6FF" fillOpacity="0.45" stroke="#F2B705" strokeWidth="5" />
      <path d="M143 130 A11 11 0 0 1 152 126" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  ),
};

export const decks: PropPiece = {
  front: () => (
    <g>
      <rect x="32" y="168" width="136" height="44" rx="8" fill="#2E3550" stroke="#fff" strokeWidth="2" />
      <circle cx="76" cy="188" r="17" fill="#11131F" />
      <circle cx="76" cy="188" r="11" fill="none" stroke="#3A3F55" strokeWidth="1.5" />
      <circle cx="76" cy="188" r="5" fill="#FF5C8A" />
      <circle cx="118" cy="182" r="4" fill="#7FE0FF" />
      <circle cx="132" cy="182" r="4" fill="#FFD84D" />
      <rect x="112" y="194" width="28" height="4" rx="2" fill="#5A6283" />
      <rect x="122" y="191" width="6" height="10" rx="2" fill="#fff" />
    </g>
  ),
};

export const wave: PropPiece = {
  over: () => (
    <g>
      <path d="M-10 178 C 20 160 42 162 62 174 C 82 186 102 184 122 170 C 142 156 172 156 210 174 L210 214 L-10 214 Z" fill="#39C6FF" />
      <path d="M-10 178 C 20 160 42 162 62 174 C 82 186 102 184 122 170 C 142 156 172 156 210 174" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M150 172 C 160 160 176 160 182 170 C 174 166 166 168 162 176 Z" fill="#fff" />
      <g fill="#fff" opacity="0.8">
        <circle cx="40" cy="190" r="2.5" />
        <circle cx="98" cy="196" r="2" />
        <circle cx="150" cy="192" r="2.5" />
      </g>
    </g>
  ),
};

export const trophy: PropPiece = {
  front: (uid) => (
    <g>
      <linearGradient id={`${uid}cup`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFE680" />
        <stop offset="1" stopColor="#F2A400" />
      </linearGradient>
      <path d="M146 120 C 136 120 136 138 150 140 M180 120 C 190 120 190 138 176 140" stroke="#F2A400" strokeWidth="4" fill="none" />
      <path d="M146 112 L180 112 L178 132 Q163 148 148 132 Z" fill={`url(#${uid}cup)`} stroke="#E39A00" strokeWidth="1.6" />
      <rect x="159" y="140" width="8" height="12" fill="#F2A400" />
      <rect x="150" y="150" width="26" height="8" rx="2" fill="#8A5A2E" />
      <path d="M163 116 L165 121 L170 121.5 L166 124.5 L167.5 129.5 L163 126.8 L158.5 129.5 L160 124.5 L156 121.5 L161 121 Z" fill="#fff" opacity="0.9" />
    </g>
  ),
};

export const cupcake: PropPiece = {
  front: () => (
    <g>
      <path d="M150 128 Q152 120 150 116" stroke="#FFB020" strokeWidth="3" fill="none" strokeLinecap="round" />
      <rect x="148" y="128" width="5" height="14" rx="2" fill="#7FE0FF" />
      <path d="M134 152 C 132 138 168 138 166 152 Z" fill="#FFB3CF" />
      <path d="M138 146 C 140 136 160 136 162 146 Z" fill="#FFD3E4" />
      <path d="M136 152 L164 152 L159 176 L141 176 Z" fill="#FF6FA3" />
      <path d="M143 152 L145 176 M150 152 L150 176 M157 152 L155 176" stroke="#fff" strokeWidth="1.8" opacity="0.7" />
    </g>
  ),
};

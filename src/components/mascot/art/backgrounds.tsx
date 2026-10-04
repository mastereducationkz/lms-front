/** Backgrounds, one per BACKGROUNDS entry: the brand «SAT» blue plus soft gradients. */
import type { ReactNode } from 'react';
import { BRAND_BLUE, MasterMark } from './MasterMark';

type Bg = (uid: string) => ReactNode;

function Gradient({ uid, from, to, angle = 'diag' }: { uid: string; from: string; to: string; angle?: 'diag' | 'down' }) {
  const coords = angle === 'down' ? { x1: 0, y1: 0, x2: 0, y2: 1 } : { x1: 0, y1: 0, x2: 1, y2: 1 };
  return (
    <>
      <linearGradient id={`${uid}bg`} {...coords}>
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      <circle cx="60" cy="50" r="70" fill="#fff" opacity="0.12" />
    </>
  );
}

/** Seeded scatter of dots, so stars/bubbles sit in the same places on every render. */
function Dots({ n, seed, color, rMin, rMax, opacity = 1, ring = false }: {
  n: number; seed: number; color: string; rMin: number; rMax: number; opacity?: number; ring?: boolean;
}) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dots = Array.from({ length: n }, (_, i) => {
    const x = 8 + rnd() * 184;
    const y = 6 + rnd() * 110;
    const r = rMin + rnd() * (rMax - rMin);
    return ring
      ? <circle key={i} cx={x} cy={y} r={r} fill="none" stroke={color} strokeWidth="1.6" opacity={opacity} />
      : <circle key={i} cx={x} cy={y} r={r} fill={color} opacity={opacity * (0.55 + rnd() * 0.45)} />;
  });
  return <g>{dots}</g>;
}

function Sparkle({ x, y, r, color = '#fff' }: { x: number; y: number; r: number; color?: string }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill={color} />;
}

export const BACKGROUND_ART: Bg[] = [
  // SAT blue — the brand frame with outlined «SAT» letters
  (uid) => (
    <g>
      <radialGradient id={`${uid}bg`} cx="0.5" cy="0.4" r="0.75">
        <stop offset="0" stopColor="#3D74FF" />
        <stop offset="1" stopColor="#1546E0" />
      </radialGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      <g fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.6" fontFamily="Arial Black, Arial, Helvetica, sans-serif" fontWeight="900" fontSize="30" letterSpacing="1">
        {[30, 66, 102, 138, 174].map((y, i) => (
          <text key={y} x={i % 2 ? -34 : -8}  y={y}>SAT SAT SAT SAT</text>
        ))}
      </g>
    </g>
  ),
  // ocean
  (uid) => (
    <g>
      <Gradient uid={uid} from="#3FD3FF" to="#1E5BF0" angle="down" />
      <Dots n={10} seed={7} color="#fff" rMin={2.5} rMax={6} opacity={0.5} ring />
    </g>
  ),
  // sunset
  (uid) => (
    <g>
      <Gradient uid={uid} from="#FFB25B" to="#FF5E8E" angle="down" />
      <circle cx="160" cy="44" r="18" fill="#FFE59A" opacity="0.8" />
    </g>
  ),
  // mint
  (uid) => <Gradient uid={uid} from="#7FF0CF" to="#22B3A6" />,
  // starry night
  (uid) => (
    <g>
      <Gradient uid={uid} from="#6A4DF2" to="#24166B" angle="down" />
      <Dots n={22} seed={11} color="#fff" rMin={0.8} rMax={2} />
      <Sparkle x={34} y={40} r={6} />
      <Sparkle x={168} y={58} r={5} />
      <path d="M160 22 A14 14 0 1 0 174 40 A11 11 0 1 1 160 22 Z" fill="#FFE59A" />
    </g>
  ),
  // lemon
  (uid) => <Gradient uid={uid} from="#FFF08A" to="#FFB43F" />,
  // coral
  (uid) => <Gradient uid={uid} from="#FFA6B9" to="#FF5F6D" />,
  // deep space
  (uid) => (
    <g>
      <Gradient uid={uid} from="#16245E" to="#05081C" angle="down" />
      <Dots n={30} seed={3} color="#fff" rMin={0.7} rMax={1.8} />
      <circle cx="166" cy="40" r="13" fill="#FF8A5C" />
      <ellipse cx="166" cy="40" rx="22" ry="5" fill="none" stroke="#FFC9A8" strokeWidth="2.2" transform="rotate(-18 166 40)" />
      <Sparkle x={30} y={56} r={5} />
    </g>
  ),
  // forest
  (uid) => <Gradient uid={uid} from="#9BEA8F" to="#1F9A6B" />,
  // lilac
  (uid) => (
    <g>
      <Gradient uid={uid} from="#DCCBFF" to="#8C6CFF" />
      <Sparkle x={36} y={44} r={5} />
      <Sparkle x={166} y={36} r={4} />
    </g>
  ),
  // Master blue — brand blue with a tonal pattern of emblems (appended last)
  (uid) => (
    <g>
      <radialGradient id={`${uid}bg`} cx="0.5" cy="0.4" r="0.75">
        <stop offset="0" stopColor="#3B7BF5" />
        <stop offset="0.6" stopColor={BRAND_BLUE} />
        <stop offset="1" stopColor="#1C4FD6" />
      </radialGradient>
      <rect width="200" height="200" fill={`url(#${uid}bg)`} />
      {[[30, 32, 34], [100, 12, 26], [168, 32, 34], [12, 96, 26], [188, 96, 26], [36, 160, 30], [164, 160, 30], [100, 100, 30]].map(([x, y, s]) => (
        <MasterMark key={`${x}-${y}`} x={x} y={y} size={s} color="#fff" opacity={0.13} />
      ))}
    </g>
  ),
];

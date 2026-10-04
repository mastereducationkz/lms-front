/**
 * Frames (achievement rewards): a ring drawn OUTSIDE the orca's circle, in the margin the Orca
 * component adds when a frame is worn (viewBox -FRAME_PAD … 200+FRAME_PAD). A frame is a rarity
 * signal, so its colour reads even at 32 px; the ornaments add character at full size.
 */
import type { ReactNode } from 'react';

/** Extra viewBox margin on every side when a frame is worn. */
export const FRAME_PAD = 18;

const C = 100;
const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (deg: number, r: number) => ({ x: C + r * Math.cos(rad(deg)), y: C + r * Math.sin(rad(deg)) });

/** A flickering flame tongue standing on the ring, pointing outward at `deg`, tip bent by `lean`. */
function Tongue({ deg, h, fill, lean }: { deg: number; h: number; fill: string; lean: number }) {
  const w = h * 0.4;
  const tx = lean * h * 0.35;
  return (
    <path
      d={`M${-w} 0 C ${-w * 1.15} ${-h * 0.4} ${-w * 0.2 + tx * 0.4} ${-h * 0.62} ${tx} ${-h} C ${w * 0.15 + tx * 0.5} ${-h * 0.58} ${w * 1.1} ${-h * 0.38} ${w} 0 Z`}
      transform={`translate(${C} ${C}) rotate(${deg + 90}) translate(0 -98)`}
      fill={fill}
    />
  );
}

const HEIGHTS = [21, 14, 18, 12, 20, 15];

function flameFrame(uid: string, hot: string, mid: string, core: string, ring: [string, string]): ReactNode {
  const tongues = Array.from({ length: 16 }, (_, i) => ({
    deg: i * (360 / 16) - 90,
    h: HEIGHTS[i % HEIGHTS.length],
    lean: i % 2 === 0 ? 0.85 : -0.7,
  }));
  return (
    <g>
      <linearGradient id={`${uid}fr`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={ring[0]} />
        <stop offset="1" stopColor={ring[1]} />
      </linearGradient>
      {tongues.map((t) => <Tongue key={t.deg} deg={t.deg} h={t.h} lean={t.lean} fill={hot} />)}
      {tongues.map((t) => <Tongue key={`m${t.deg}`} deg={t.deg} h={t.h * 0.68} lean={t.lean} fill={mid} />)}
      {tongues.map((t) => <Tongue key={`c${t.deg}`} deg={t.deg} h={t.h * 0.36} lean={t.lean} fill={core} />)}
      <circle cx={C} cy={C} r="103.5" fill="none" stroke={`url(#${uid}fr)`} strokeWidth="7" />
      <circle cx={C} cy={C} r="100.5" fill="none" stroke="#fff" strokeWidth="1.6" opacity="0.85" />
    </g>
  );
}

function Leaf({ deg, r, side }: { deg: number; r: number; side: 1 | -1 }) {
  const p = at(deg, r);
  return (
    <ellipse
      cx={p.x}
      cy={p.y}
      rx="3.6"
      ry="7.4"
      transform={`rotate(${deg + 90 + side * 38} ${p.x} ${p.y})`}
      fill={side > 0 ? '#F7C948' : '#E2A300'}
      stroke="#9A6A00"
      strokeWidth="0.8"
    />
  );
}

function Star5({ x, y, r, fill, stroke }: { x: number; y: number; r: number; fill: string; stroke?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} stroke={stroke} strokeWidth={stroke ? 1 : 0} strokeLinejoin="round" />;
}

function Glint({ x, y, r }: { x: number; y: number; r: number }) {
  return <path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`} fill="#fff" />;
}

export const FRAME_ART: ((uid: string) => ReactNode)[] = [
  () => null,
  // flame (streak 7)
  (uid) => flameFrame(uid, '#FF5A1F', '#FF9F1C', '#FFE066', ['#FFB627', '#FF4D1A']),
  // blue flame (streak 30) — hotter
  (uid) => flameFrame(uid, '#2F6BFF', '#3FC5FF', '#E8FBFF', ['#7DE3FF', '#2459F0']),
  // gold laurel (legendary)
  (uid) => {
    const leaves: ReactNode[] = [];
    for (let i = 0; i < 9; i++) {
      const dl = 112 + i * 16; // left branch, from the bottom up to the top
      const dr = 68 - i * 16; // right branch
      leaves.push(<Leaf key={`l${i}`} deg={dl} r={i % 2 ? 110 : 107} side={i % 2 ? 1 : -1} />);
      leaves.push(<Leaf key={`r${i}`} deg={dr} r={i % 2 ? 110 : 107} side={i % 2 ? -1 : 1} />);
    }
    const top = at(-90, 108);
    return (
      <g>
        <linearGradient id={`${uid}gl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1A8" />
          <stop offset="0.5" stopColor="#F5B800" />
          <stop offset="1" stopColor="#C98A00" />
        </linearGradient>
        <circle cx={C} cy={C} r="104" fill="none" stroke={`url(#${uid}gl)`} strokeWidth="6.5" />
        <circle cx={C} cy={C} r="100.6" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
        {leaves}
        <path d="M86 206 L100 214 L114 206 L110 218 L100 212 L90 218 Z" fill="#E8364F" stroke="#B8213A" strokeWidth="1" />
        <Star5 x={top.x} y={top.y} r={10} fill="#FFD84D" stroke="#B97800" />
        <Glint x={30} y={22} r={5} />
        <Glint x={180} y={40} r={4} />
        <Glint x={186} y={170} r={3.5} />
      </g>
    );
  },
  // star ring (3 Stars of the Week)
  (uid) => {
    const stars = Array.from({ length: 8 }, (_, i) => at(i * 45 - 90, 107));
    return (
      <g>
        <linearGradient id={`${uid}sr`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B26BFF" />
          <stop offset="1" stopColor="#FF5CA8" />
        </linearGradient>
        <circle cx={C} cy={C} r="104" fill="none" stroke={`url(#${uid}sr)`} strokeWidth="8" />
        <circle cx={C} cy={C} r="100.6" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.9" />
        {stars.map((s, i) => <Star5 key={i} x={s.x} y={s.y} r={i === 0 ? 11 : 8} fill="#FFD84D" stroke="#C98A00" />)}
      </g>
    );
  },
];

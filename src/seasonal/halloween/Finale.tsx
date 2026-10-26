/**
 * The hunt's finale (owner, 2026-10-26): when the fifth pumpkin is picked up, sweets rain down and
 * Kasatik — the person's own orca, in a witch hat — flies a lap of honour across the screen on a
 * broom; then the card dialog opens. With reduced motion it goes straight to the card.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import Orca from '@/components/mascot/Orca';
import { resolveMascot, type MascotConfig } from '@/components/mascot/config';
import { Broom, Candy } from './art';
import { closeFinale, prefersReducedMotion, useFinale } from './state';

const CardDialog = lazy(() => import('./CardDialog'));

/** The wizard hat in the orca wardrobe (src/components/mascot/config.ts HATS). */
const WITCH_HAT = 6;
const FLIGHT_MS = 2600;
const SWEETS = 26;

export function witchOrca(user: { id: number | string; mascot?: string | null }): MascotConfig {
  return { ...resolveMascot(user.mascot, user.id), hat: WITCH_HAT };
}

function Flight({ orca, onLanded }: { orca: MascotConfig; onLanded: () => void }) {
  const rider = useRef<HTMLDivElement>(null);
  const sweets = useRef<(HTMLDivElement | null)[]>([]);
  const [rain] = useState(() =>
    Array.from({ length: SWEETS }, () => ({
      x: Math.random() * 100,
      size: 22 + Math.random() * 18,
      duration: 1500 + Math.random() * 1300,
      delay: Math.random() * 900,
      spin: (Math.random() - 0.5) * 720,
    })),
  );

  useLayoutEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = Math.min(150, w * 0.32);
    const ride = rider.current?.animate(
      [
        { transform: `translate(${-size * 1.6}px, ${h * 0.42}px) rotate(-10deg)` },
        { transform: `translate(${w * 0.3}px, ${h * 0.2}px) rotate(-4deg)`, offset: 0.35 },
        { transform: `translate(${w * 0.58}px, ${h * 0.26}px) rotate(4deg)`, offset: 0.62 },
        { transform: `translate(${w + size * 0.4}px, ${h * 0.1}px) rotate(-12deg)` },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)', fill: 'both' },
    );
    const falls = rain.map((s, i) => sweets.current[i]?.animate(
      [
        { transform: 'translateY(-60px) rotate(0deg)', opacity: 1 },
        { transform: `translateY(${h + 60}px) rotate(${s.spin}deg)`, opacity: 0.9 },
      ],
      { duration: s.duration, delay: s.delay, easing: 'cubic-bezier(0.4, 0, 0.9, 0.6)', fill: 'both' },
    ));
    const landed = window.setTimeout(onLanded, FLIGHT_MS + 150);
    return () => {
      window.clearTimeout(landed);
      ride?.cancel();
      falls.forEach((f) => f?.cancel());
    };
  }, [rain, onLanded]);

  const size = Math.min(150, (typeof window === 'undefined' ? 1024 : window.innerWidth) * 0.32);
  return createPortal(
    <div aria-hidden>
      {rain.map((s, i) => (
        <div key={i} ref={(el) => { sweets.current[i] = el; }} className="hw-candy-fall" style={{ left: `${s.x}vw` }}>
          <Candy size={s.size} variant={i} />
        </div>
      ))}
      <div ref={rider} className="hw-flight" style={{ width: size * 1.5 }}>
        <div className="relative" style={{ width: size * 1.5, height: size * 1.1 }}>
          <Orca config={orca} size={size} className="absolute left-1/2 top-0 -translate-x-1/2 rounded-full" title="" />
          <Broom size={size * 1.5} className="absolute left-0" style={{ top: size * 0.72 }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Finale() {
  const { user } = useAuth();
  const finale = useFinale();
  const [landed, setLanded] = useState(false);
  const land = useCallback(() => setLanded(true), []);
  const userId = user?.id;
  const mascot = user?.mascot;
  const orca = useMemo(() => (userId == null ? null : witchOrca({ id: userId, mascot })), [userId, mascot]);

  useEffect(() => {
    if (finale === 'closed') setLanded(false);
  }, [finale]);

  if (!user || !orca || finale === 'closed') return null;
  const flying = finale === 'flight' && !landed && !prefersReducedMotion();
  return flying ? (
    <Flight orca={orca} onLanded={land} />
  ) : (
    <Suspense fallback={null}>
      <CardDialog orca={orca} userName={user.name ?? ''} onClose={closeFinale} />
    </Suspense>
  );
}

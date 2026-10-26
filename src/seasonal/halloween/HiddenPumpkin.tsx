/**
 * The hunt's pumpkin on this page, if there is one and it has not been found yet: it peeks in from
 * the right edge and ducks back now and then. Picking it up pops it with a handful of sweets and
 * counts it; the fifth one starts the finale.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/seasonal';
import { Candy, Pumpkin } from './art';
import { spotFor } from './hunt';
import { pickUp, prefersReducedMotion, useFound } from './state';

interface Pop {
  id: number;
  x: number;
  y: number;
}

const SWEETS = 7;

/** One handful of sweets thrown up and left out of a picked pumpkin. */
function SweetBurst({ pop, onDone }: { pop: Pop; onDone: (id: number) => void }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [sizes] = useState(() => Array.from({ length: SWEETS }, () => 22 + Math.random() * 10));
  useLayoutEffect(() => {
    const flights = refs.current.map((el, i) => {
      if (!el) return null;
      const angle = Math.PI * (0.55 + (i / (SWEETS - 1)) * 0.9);
      const dist = 70 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = -Math.sin(angle) * dist;
      const spin = (Math.random() - 0.5) * 360;
      return el.animate(
        [
          { transform: 'translate(0, 0) rotate(0deg) scale(.4)', opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin}deg) scale(1)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${dx * 1.1}px, ${dy + 90}px) rotate(${spin * 1.4}deg) scale(.9)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 300, easing: 'cubic-bezier(0.2, 0.7, 0.4, 1)', fill: 'forwards' },
      );
    });
    Promise.allSettled(flights.map((f) => f?.finished)).then(() => onDone(pop.id));
    return () => flights.forEach((f) => f?.cancel());
  }, [pop, onDone]);
  return (
    <>
      {sizes.map((size, i) => (
        <div
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="hw-pop-candy"
          style={{ left: pop.x - size / 2, top: pop.y - size / 4 }}
          aria-hidden
        >
          <Candy size={size} variant={i} />
        </div>
      ))}
    </>
  );
}

function PumpkinOnThisPage({ onPop }: { onPop: (x: number, y: number) => void }) {
  const t = useT();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const found = useFound(user?.id);
  const spot = spotFor(user?.role, pathname);
  const [picked, setPicked] = useState(false);
  const [gutter, setGutter] = useState(0);

  useEffect(() => setPicked(false), [pathname]);

  // Peek out beside the page's scrollbar, never over it: dragging the scrollbar must not pick it up.
  useEffect(() => {
    const main = document.querySelector('main');
    setGutter(main ? Math.max(0, main.offsetWidth - main.clientWidth) : 0);
  }, [pathname]);

  if (!user || !spot || found.includes(spot.path)) return null;

  return (
    <button
      type="button"
      className="hw-hunt"
      style={{ top: `calc(${Math.round(spot.top * 100)}dvh - 24px)`, right: gutter }}
      data-picked={picked}
      aria-label={t('seasonal.halloween.hunt.pumpkin')}
      onClick={(event) => {
        if (picked) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (!prefersReducedMotion()) onPop(box.left + box.width / 2, box.top + box.height / 2);
        setPicked(true);
        // Let the pop play before the pumpkin leaves the page.
        window.setTimeout(() => {
          const result = pickUp(user.id, spot.path);
          if (!result.complete) {
            toast(t('seasonal.halloween.hunt.found', { count: result.found }), {
              description: t('seasonal.halloween.hunt.keepLooking'),
            });
          }
        }, prefersReducedMotion() ? 0 : 380);
      }}
    >
      <Pumpkin size={40} />
    </button>
  );
}

export default function HiddenPumpkin() {
  const [pops, setPops] = useState<Pop[]>([]);
  const nextId = useRef(0);
  const done = useRef((id: number) => setPops((list) => list.filter((p) => p.id !== id))).current;
  return createPortal(
    <>
      <PumpkinOnThisPage onPop={(x, y) => setPops((list) => [...list, { id: nextId.current++, x, y }])} />
      {pops.map((pop) => <SweetBurst key={pop.id} pop={pop} onDone={done} />)}
    </>,
    document.body,
  );
}

/**
 * Trick or treat (owner, 2026-10-26): the pumpkin in the top bar. A tap dims the screen, a full moon
 * rises, a flock of bats bursts out of the pumpkin and scatters off every edge, and a treat card
 * says something warm or useful. Nothing blocks: a tap anywhere, Escape, or seven seconds closes it.
 * With reduced motion the bats stay home; the moon and the treat simply fade in.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/seasonal';
import { Bat, Moon, Pumpkin } from './art';
import { nextTreat, treatKey } from './treats';
import { prefersReducedMotion } from './state';

const BAT_COUNT = 22;
const TREAT_KEY = 'seasonal:halloween-2026:last-treat';
const OPEN_FOR = 7000;

function lastTreat(): number | null {
  try {
    const n = Number(window.localStorage.getItem(TREAT_KEY));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function rememberTreat(n: number) {
  try {
    window.localStorage.setItem(TREAT_KEY, String(n));
  } catch {
    // Private mode: the next tap may repeat a treat; nothing else changes.
  }
}

/** Where each bat ends up: spread round the circle, well past the screen's edge. */
function flightPlan(origin: { x: number; y: number }) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const reach = Math.hypot(w, h);
  return Array.from({ length: BAT_COUNT }, (_, i) => {
    const angle = (i / BAT_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const wobble = (Math.random() - 0.5) * 140;
    const size = 52 + Math.random() * 64;
    return {
      size,
      mid: { x: origin.x + Math.cos(angle) * reach * 0.28 + wobble, y: origin.y + Math.sin(angle) * reach * 0.22 - 60 },
      end: { x: origin.x + Math.cos(angle) * reach, y: origin.y + Math.sin(angle) * reach * 0.8 - 120 },
      duration: 1500 + Math.random() * 900,
      delay: Math.random() * 260,
    };
  });
}

function Burst({ origin, onClose }: { origin: { x: number; y: number }; onClose: () => void }) {
  const t = useT();
  const [shown, setShown] = useState(false);
  // Pure: StrictMode calls an initializer twice; the treat is remembered once it is shown.
  const [treat] = useState(() => nextTreat(lastTreat()));
  useEffect(() => rememberTreat(treat), [treat]);
  const bats = useRef<(HTMLDivElement | null)[]>([]);
  const [plan] = useState(() => (prefersReducedMotion() ? [] : flightPlan(origin)));

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const animations = plan.map((bat, i) => {
      const el = bats.current[i];
      if (!el) return null;
      const at = (p: { x: number; y: number }, scale: number) => `translate(${p.x - bat.size / 2}px, ${p.y - bat.size / 4}px) scale(${scale})`;
      return el.animate(
        [
          { transform: at(origin, 0.2), opacity: 0 },
          { transform: at(bat.mid, 1), opacity: 1, offset: 0.35 },
          { transform: at(bat.end, 1.15), opacity: 1 },
        ],
        { duration: bat.duration, delay: bat.delay, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'both' },
      );
    });
    return () => {
      cancelAnimationFrame(frame);
      animations.forEach((a) => a?.cancel());
    };
  }, [origin, plan]);

  const close = useCallback(() => {
    setShown(false);
    window.setTimeout(onClose, 260);
  }, [onClose]);

  useEffect(() => {
    const timer = window.setTimeout(close, OPEN_FOR);
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [close]);

  return createPortal(
    <>
      <div className="hw-burst-dim" data-shown={shown} onClick={close} aria-hidden />
      <div className="hw-burst-stage hw-burst-sky" data-shown={shown} aria-hidden>
        <Moon className="hw-burst-moon" />
      </div>
      {plan.map((bat, i) => (
        <div key={i} ref={(el) => { bats.current[i] = el; }} className="hw-bat" style={{ opacity: 0 }} aria-hidden>
          <Bat size={bat.size} membrane="#5B3F8C" />
        </div>
      ))}
      <div className="hw-burst-stage hw-burst-front" data-shown={shown}>
        {/* A floating card over a dimmed screen: a real overlay keeps its shadow. */}
        <div /* taste-skill-ignore */ role="status" className="hw-treat rounded-2xl border border-border bg-popover p-5 pr-12 text-popover-foreground shadow-xl">
          <p className="text-lg font-semibold text-foreground">{t('seasonal.halloween.treat.title')}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-foreground">{t(treatKey(treat))}</p>
          <button
            type="button"
            onClick={close}
            className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('seasonal.halloween.treat.dismiss')}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** The trick-or-treat pumpkin: in the top bar, and on phones in the dashboard greeting. */
export default function TrickOrTreat({ className = '', size = 26 }: { className?: string; size?: number }) {
  const t = useT();
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  return (
    <>
      <button
        type="button"
        className={`hw-pumpkin-button items-center justify-center rounded-lg border bg-card transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
        aria-label={t('seasonal.halloween.pumpkin.label')}
        title={t('seasonal.halloween.pumpkin.label')}
        aria-expanded={origin !== null}
        onClick={(event) => {
          if (origin) return;
          const box = event.currentTarget.getBoundingClientRect();
          setOrigin({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
        }}
      >
        <Pumpkin size={size} />
      </button>
      {origin && <Burst origin={origin} onClose={() => setOrigin(null)} />}
    </>
  );
}

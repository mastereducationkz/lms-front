/**
 * The running tour on screen (owner, 2026-10-07; replaces nextstepjs, which froze the app).
 *
 * Nothing here can trap anyone: the dim and the ring are `pointer-events: none`, so the page keeps
 * scrolling and clicking; the card is clamped inside the viewport, its Skip and Close always there;
 * Escape closes. A stop whose element is still rendering waits for it — silently for a moment, then
 * as a centred card that says it's loading, Skip at hand — and is skipped only after TARGET_WAIT_MS.
 * Before a card is placed, its target is scrolled into view in whatever container holds it.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate } from '@floating-ui/react-dom';
import { centerInViewport, spotlightBox } from '@/lib/guide/geometry';
import { neighbourStep, reachable, settleStep, stepPosition, targetPhase } from '@/lib/guide/steps';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/guide';
import { bringIntoView, findShown, otherDialogOpen, prefersReducedMotion, resolves, viewportSize } from './dom';
import { TourCard } from './GuideCards';
import type { TourDefinition, TourStep } from './tours';
import { useAnchoredCard } from './useAnchoredCard';

export type TourEnd = 'finish' | 'skip' | 'close';

interface Props {
  tour: TourDefinition;
  stepId: string;
  /** Shown beside the first card's title (the person's avatar or orca). */
  welcomeLeading?: ReactNode;
  onGoTo: (stepId: string) => void;
  onEnd: (how: TourEnd) => void;
}

const GLIDE_MS = 420;
/** How often a stop still loading looks for its element. */
const LOOK_MS = 100;

function Spotlight({ target, gliding }: { target: HTMLElement | null; gliding: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const place = () => {
      const view = viewportSize();
      const box = target
        ? spotlightBox(target.getBoundingClientRect(), view, 6)
        : { left: view.width / 2, top: view.height / 2, width: 0, height: 0 };
      node.style.transform = `translate(${box.left}px, ${box.top}px)`;
      node.style.width = `${box.width}px`;
      node.style.height = `${box.height}px`;
    };
    place();
    if (!target) {
      window.addEventListener('resize', place);
      return () => window.removeEventListener('resize', place);
    }
    return autoUpdate(target, node, place);
  }, [target]);
  return (
    <div
      ref={ref}
      aria-hidden
      data-guide="tour-spotlight"
      className={`pointer-events-none fixed left-0 top-0 z-[70] rounded-xl shadow-[0_0_0_200vmax_rgb(2_6_23/0.32)] dark:shadow-[0_0_0_200vmax_rgb(0_0_0/0.45)] ${
        target ? 'ring-2 ring-brand ring-offset-0' : ''
      } ${gliding ? 'transition-[transform,width,height] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none' : ''}`}
    />
  );
}

export default function TourLayer({ tour, stepId, welcomeLeading, onGoTo, onEnd }: Props) {
  const t = useT();
  const steps = tour.steps;
  const step: TourStep = steps.find((s) => s.id === stepId) ?? steps[0];
  // Stops Next and Back can land on: on screen now, or content still loading that its stop waits for.
  const canReach = useMemo(() => reachable(steps, resolves), [steps]);
  // What is on screen: a stop and its element, swapped together once the element is in view, so the
  // card never shows one stop's words at another stop's place.
  const [shown, setShown] = useState<{ stepId: string; el: HTMLElement | null; loading?: boolean } | null>(null);
  const [gliding, setGliding] = useState(false);
  const glideTimer = useRef(0);
  const glide = useCallback(() => {
    setGliding(true);
    window.clearTimeout(glideTimer.current);
    glideTimer.current = window.setTimeout(() => setGliding(false), GLIDE_MS + 300);
  }, []);
  useEffect(() => () => window.clearTimeout(glideTimer.current), []);
  const [, setLayoutTick] = useState(0);
  const direction = useRef<1 | -1>(1);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const returnFocus = useRef<Element | null>(null);
  const titleId = useId();
  const bodyId = useId();
  // The callers' callbacks, always current, without re-running the effects that read them.
  const goToRef = useRef(onGoTo);
  const endRef = useRef(onEnd);
  goToRef.current = onGoTo;
  endRef.current = onEnd;

  // Where focus was before the tour; it goes back there when the tour ends.
  useEffect(() => {
    returnFocus.current = document.activeElement;
    return () => {
      const el = returnFocus.current as HTMLElement | null;
      if (el && document.contains(el)) el.focus?.({ preventScroll: true });
    };
  }, []);

  // Resolve this stop's element, bring it into view, then place the card. An element that shows up
  // early is used at once; one still rendering gets the loading card; one that never comes is skipped.
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    glide();
    const selector = step.target;
    if (!selector) {
      setShown({ stepId: step.id, el: null });
      return undefined;
    }
    const started = Date.now();
    const look = () => {
      if (cancelled) return;
      const el = findShown(selector);
      const phase = targetPhase(Date.now() - started, el !== null, step.waits);
      if (phase === 'show' && el) {
        void bringIntoView(el, !prefersReducedMotion()).then(() => {
          if (cancelled) return;
          glide();
          setShown({ stepId: step.id, el });
        });
        return;
      }
      if (phase === 'skip') {
        // Past this stop now, so only stops that show (or wait) count; never back onto this one.
        const others = (sel: string) => sel !== selector && canReach(sel);
        const next = neighbourStep(steps, step.id, direction.current, others) ?? neighbourStep(steps, step.id, -direction.current as 1 | -1, others);
        if (next) goToRef.current(next.id);
        else endRef.current('finish');
        return;
      }
      if (phase === 'loading') {
        setShown((prev) => (prev?.stepId === step.id && prev.loading ? prev : { stepId: step.id, el: null, loading: true }));
      }
      timer = window.setTimeout(look, LOOK_MS);
    };
    look();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step.id, step.target, step.waits, steps, glide, canReach]);

  // A resize can hide this stop's element (desktop → phone): move to the nearest stop that shows.
  useEffect(() => {
    const onResize = () => {
      setLayoutTick((n) => n + 1);
      const settled = settleStep(steps, step.id, canReach);
      if (settled && settled.id !== step.id) goToRef.current(settled.id);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [steps, step.id]);

  const current: TourStep = steps.find((s) => s.id === shown?.stepId) ?? step;
  const position = stepPosition(steps, current.id, canReach);

  const go = useCallback(
    (dir: 1 | -1) => {
      direction.current = dir;
      const next = neighbourStep(steps, current.id, dir, canReach);
      if (next) goToRef.current(next.id);
      else if (dir === 1) endRef.current('finish');
    },
    [steps, current.id, canReach],
  );

  // Escape closes (unless something above the tour wants it); arrows step while the card has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        if (otherDialogOpen()) return;
        e.preventDefault();
        endRef.current('close');
        return;
      }
      const inCard = cardRef.current?.contains(document.activeElement);
      if (!inCard) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [go]);

  const anchored = shown?.el ?? null;
  const floating = useAnchoredCard(anchored, current.placement ?? 'bottom');
  const setCard = useCallback(
    (node: HTMLDivElement | null) => {
      cardRef.current = node;
      floating.refs.setFloating(node);
    },
    [floating.refs],
  );

  // A centred card (no target) is placed by the same clamp, so it glides like the others.
  const [centre, setCentre] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (anchored || !cardRef.current) return undefined;
    const place = () => {
      const node = cardRef.current;
      if (node) setCentre(centerInViewport({ width: node.offsetWidth, height: node.offsetHeight }, viewportSize()));
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [anchored, current.id]);

  // Focus moves into the card when the tour opens (Tab reaches its buttons, arrows step); never
  // scrolls for it.
  const focusedOnce = useRef(false);
  useEffect(() => {
    if (focusedOnce.current || shown === null) return;
    focusedOnce.current = true;
    cardRef.current?.focus({ preventScroll: true });
  }, [shown]);

  const ready = shown !== null && (anchored ? floating.isPositioned : centre !== null);
  const style: CSSProperties = useMemo(() => {
    const base: CSSProperties = anchored
      ? { ...floating.floatingStyles }
      : { position: 'fixed', left: 0, top: 0, transform: `translate(${centre?.x ?? 0}px, ${centre?.y ?? 0}px)` };
    if (!ready) base.visibility = 'hidden';
    if (gliding && !prefersReducedMotion()) base.transition = `transform ${GLIDE_MS}ms cubic-bezier(0.16, 1, 0.3, 1)`;
    return base;
  }, [anchored, floating.floatingStyles, centre, ready, gliding]);

  return createPortal(
    <>
      <Spotlight target={anchored} gliding={gliding} />
      <TourCard
        ref={setCard}
        titleId={titleId}
        bodyId={bodyId}
        stepId={current.id}
        title={t(current.title)}
        body={t(current.body)}
        index={position.index}
        total={position.total}
        loading={Boolean(shown?.loading)}
        leading={current.target ? undefined : welcomeLeading}
        style={style}
        arrowRef={anchored ? floating.arrowRef : undefined}
        arrowStyle={floating.arrowStyle}
        onNext={() => go(1)}
        onBack={() => go(-1)}
        onSkip={() => endRef.current('skip')}
        onClose={() => endRef.current('close')}
      />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {ready ? `${t('guide.tour.stepOf', { index: position.index + 1, total: position.total })}: ${t(current.title)}${shown?.loading ? `. ${t('guide.tour.loading')}` : ''}` : ''}
      </div>
    </>,
    document.body,
  );
}

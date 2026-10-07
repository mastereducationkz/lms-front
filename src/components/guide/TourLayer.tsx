/**
 * The running tour on screen (owner, 2026-10-07; replaces nextstepjs, which froze the app).
 *
 * Nothing here can trap anyone: the dim and the ring are `pointer-events: none`, so the page keeps
 * scrolling and clicking; the card is clamped inside the viewport, its Skip and Close always there;
 * Escape closes. A stop whose target is missing or has no size is skipped silently. Before a card is
 * placed, its target is scrolled into view in whatever container holds it.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { autoUpdate } from '@floating-ui/react-dom';
import { centerInViewport, spotlightBox } from '@/lib/guide/geometry';
import { neighbourStep, settleStep, stepPosition } from '@/lib/guide/steps';
import { bringIntoView, otherDialogOpen, prefersReducedMotion, resolves, viewportSize, waitForShown } from './dom';
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

/** How long a stop waits for its element to render before it is skipped. */
const TARGET_WAIT_MS = 1000;
const GLIDE_MS = 420;

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
  const steps = tour.steps;
  const step: TourStep = steps.find((s) => s.id === stepId) ?? steps[0];
  // What is on screen: a stop and its element, swapped together once the element is in view, so the
  // card never shows one stop's words at another stop's place.
  const [shown, setShown] = useState<{ stepId: string; el: HTMLElement | null } | null>(null);
  const [gliding, setGliding] = useState(false);
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

  // Resolve this stop's element, bring it into view, then place the card. Missing → skip it.
  useEffect(() => {
    let cancelled = false;
    setGliding(true);
    const glide = window.setTimeout(() => setGliding(false), GLIDE_MS + 300);
    if (!step.target) {
      setShown({ stepId: step.id, el: null });
      return () => {
        cancelled = true;
        window.clearTimeout(glide);
      };
    }
    void (async () => {
      const el = await waitForShown(step.target as string, TARGET_WAIT_MS);
      if (cancelled) return;
      if (!el) {
        const next = neighbourStep(steps, step.id, direction.current, resolves) ?? neighbourStep(steps, step.id, -direction.current as 1 | -1, resolves);
        if (next) goToRef.current(next.id);
        else endRef.current('finish');
        return;
      }
      await bringIntoView(el, !prefersReducedMotion());
      if (cancelled) return;
      setShown({ stepId: step.id, el });
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(glide);
    };
  }, [step.id, step.target, steps]);

  // A resize can hide this stop's element (desktop → phone): move to the nearest stop that shows.
  useEffect(() => {
    const onResize = () => {
      setLayoutTick((n) => n + 1);
      const settled = settleStep(steps, step.id, resolves);
      if (settled && settled.id !== step.id) goToRef.current(settled.id);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [steps, step.id]);

  const current: TourStep = steps.find((s) => s.id === shown?.stepId) ?? step;
  const position = stepPosition(steps, current.id, resolves);

  const go = useCallback(
    (dir: 1 | -1) => {
      direction.current = dir;
      const next = neighbourStep(steps, current.id, dir, resolves);
      if (next) goToRef.current(next.id);
      else if (dir === 1) endRef.current('finish');
    },
    [steps, current.id],
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
        title={current.title}
        body={current.body}
        index={position.index}
        total={position.total}
        text={tour.text}
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
        {ready ? `${tour.text.stepOf(position.index + 1, position.total)}: ${current.title}` : ''}
      </div>
    </>,
    document.body,
  );
}

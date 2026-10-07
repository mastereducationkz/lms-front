/**
 * The one positioning primitive behind the tour card and the tips (@floating-ui/react-dom).
 *
 * - autoUpdate follows every scrolling ancestor (the app scrolls inside <main> and the sidebar's
 *   <nav>), resizes and layout shifts — the old tour measured once and kept stale coordinates.
 * - flip, then shift on both axes, then size caps the height to the room there is.
 * - A last clamp moves the card fully inside the viewport whatever the rest decided: the card, and
 *   its buttons, can never sit off-screen again.
 */
import { useRef, type CSSProperties } from 'react';
import {
  arrow,
  autoUpdate,
  flip,
  hide,
  offset,
  shift,
  size,
  useFloating,
  type Middleware,
  type Placement,
} from '@floating-ui/react-dom';
import { clampToViewport, EDGE } from '@/lib/guide/geometry';
import { viewportSize } from './dom';

export const viewportClamp = (pad = EDGE): Middleware => ({
  name: 'viewportClamp',
  fn({ x, y, rects }) {
    const p = clampToViewport({ x, y }, rects.floating, viewportSize(), pad);
    return { x: p.x, y: p.y, data: { clamped: p.clamped } };
  },
});

export function useAnchoredCard(reference: Element | null, placement: Placement, gap = 14) {
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const keepSide = placement.includes('-');
  const flipper = flip({ padding: EDGE, crossAxis: 'alignment', fallbackAxisSideDirection: 'end' });
  const shifter = shift({ padding: EDGE, crossAxis: true });
  const floating = useFloating({
    strategy: 'fixed',
    placement,
    elements: { reference },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(gap),
      // Edge-aligned placements flip before they shift; centred ones shift first (floating-ui docs).
      ...(keepSide ? [flipper, shifter] : [shifter, flipper]),
      size({
        padding: EDGE,
        apply({ availableHeight, elements }) {
          const room = Math.min(availableHeight, viewportSize().height - 2 * EDGE);
          elements.floating.style.maxHeight = `${Math.max(160, room)}px`;
        },
      }),
      arrow({ element: arrowRef, padding: 14 }),
      hide({ strategy: 'referenceHidden' }),
      viewportClamp(),
    ],
  });

  const { middlewareData } = floating;
  const side = floating.placement.split('-')[0] as 'top' | 'right' | 'bottom' | 'left';
  const clamped = Boolean((middlewareData.viewportClamp as { clamped?: boolean } | undefined)?.clamped);
  const referenceHidden = Boolean(middlewareData.hide?.referenceHidden);
  // The arrow only points when it truly can: not when the card had to leave the target's side.
  const arrowShown = !clamped && !referenceHidden && (middlewareData.arrow?.centerOffset ?? 0) === 0;
  const staticSide = { top: 'bottom', right: 'left', bottom: 'top', left: 'right' }[side];
  const arrowStyle: CSSProperties = {
    left: middlewareData.arrow?.x != null ? `${middlewareData.arrow.x}px` : '',
    top: middlewareData.arrow?.y != null ? `${middlewareData.arrow.y}px` : '',
    [staticSide]: '-6px',
    visibility: arrowShown ? 'visible' : 'hidden',
  };

  return { ...floating, arrowRef, arrowStyle, side, referenceHidden };
}

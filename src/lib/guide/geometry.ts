/**
 * Placement math shared by the tour and the tips. Pure: the components measure, these decide.
 *
 * The rule the old tour broke (2026-10-06): a card must ALWAYS sit fully inside the viewport, with
 * its buttons reachable, whatever the target does — even off-screen or inside a scrolled sidebar.
 */

/** Gap kept between a card and the viewport's edges. */
export const EDGE = 12;

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A card of `size` at `pos`, moved the least needed to sit `pad` inside every viewport edge. A card
 * larger than the viewport keeps its top-left corner in (its own max-height then scrolls it).
 */
export function clampToViewport(pos: Point, size: Size, viewport: Size, pad = EDGE): Point & { clamped: boolean } {
  const maxX = Math.max(pad, viewport.width - size.width - pad);
  const maxY = Math.max(pad, viewport.height - size.height - pad);
  const x = Math.min(Math.max(pos.x, pad), maxX);
  const y = Math.min(Math.max(pos.y, pad), maxY);
  return { x, y, clamped: Math.abs(x - pos.x) > 0.5 || Math.abs(y - pos.y) > 0.5 };
}

/** Where a card with no target goes: the middle, clamped like any other. */
export function centerInViewport(size: Size, viewport: Size, pad = EDGE): Point {
  const { x, y } = clampToViewport(
    { x: (viewport.width - size.width) / 2, y: (viewport.height - size.height) / 2 },
    size,
    viewport,
    pad,
  );
  return { x, y };
}

/** A target worth pointing at: laid out, with an area, not hidden. Hidden desktop sidebars are 0×0. */
export function isRenderable(rect: Size, style: { display: string; visibility: string }): boolean {
  return rect.width >= 1 && rect.height >= 1 && style.display !== 'none' && style.visibility !== 'hidden';
}

/** At least `min` px of the target, both ways, are inside the viewport. */
export function visibleInViewport(rect: RectLike, viewport: Size, min = 8): boolean {
  const w = Math.min(rect.left + rect.width, viewport.width) - Math.max(rect.left, 0);
  const h = Math.min(rect.top + rect.height, viewport.height) - Math.max(rect.top, 0);
  return w >= Math.min(min, rect.width) && h >= Math.min(min, rect.height);
}

/** The whole target is inside `frame` (the viewport, or a scrolling ancestor's visible box). */
export function containedIn(rect: RectLike, frame: RectLike, slack = 1): boolean {
  return (
    rect.left >= frame.left - slack &&
    rect.top >= frame.top - slack &&
    rect.left + rect.width <= frame.left + frame.width + slack &&
    rect.top + rect.height <= frame.top + frame.height + slack
  );
}

/** The spotlight's box: the target with breathing room, trimmed to the viewport. */
export function spotlightBox(rect: RectLike, viewport: Size, pad = 6): RectLike {
  const left = Math.max(rect.left - pad, 0);
  const top = Math.max(rect.top - pad, 0);
  const right = Math.min(rect.left + rect.width + pad, viewport.width);
  const bottom = Math.min(rect.top + rect.height + pad, viewport.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

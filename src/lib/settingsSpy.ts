/**
 * Which Settings section the index marks (components/settings/SettingsNav). Pure, so the rules are
 * tested without a browser. Positions are relative to the top of the scrolling area's visible box.
 *
 *  1. A click on an item marks it at once and holds while its own scroll runs (the component
 *     keeps it until the person scrolls by hand: wheel, touch or a scrolling key).
 *  2. Scrolled to the very bottom, the last section whose heading can be seen wins: the last
 *     sections are too short to ever reach the top, so rule 3 would never pick them.
 *  3. Otherwise, the first section crossing the band between 15% and 30% of the height; when
 *     none crosses it (the gap between two sections), the mark stays where it was.
 */
export interface SpySection {
  id: string;
  top: number;
  bottom: number;
}

export const BAND_TOP = 0.15;
export const BAND_BOTTOM = 0.3;
/** How close to the end counts as «at the bottom» (px). */
export const BOTTOM_SLACK = 2;
/** A heading this close to the bottom edge isn't readable yet (px). */
const HEADING_MIN = 24;

export function isAtBottom(scrollTop: number, clientHeight: number, scrollHeight: number): boolean {
  // A page that doesn't scroll at all isn't «at the bottom» of anything.
  if (scrollHeight <= clientHeight + BOTTOM_SLACK) return false;
  return scrollTop + clientHeight >= scrollHeight - BOTTOM_SLACK;
}

export function spyActive(sections: SpySection[], height: number, atBottom: boolean, previous: string): string {
  if (atBottom) {
    const visible = sections.filter((s) => s.top >= 0 && s.top < height - HEADING_MIN);
    if (visible.length) return visible[visible.length - 1].id;
  }
  const bandTop = height * BAND_TOP;
  const bandBottom = height * BAND_BOTTOM;
  const hit = sections.find((s) => s.top < bandBottom && s.bottom > bandTop);
  return hit ? hit.id : previous;
}

/** Keys that scroll the page, unless typed into a field. */
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);

export function isScrollKey(key: string, editable: boolean): boolean {
  return !editable && SCROLL_KEYS.has(key);
}

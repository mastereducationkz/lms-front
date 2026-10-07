/**
 * Reading the page for the tour and the tips: which element a selector means right now, whether it
 * is fully in view (the app scrolls inside <main> and the sidebar's <nav>, not the window), and
 * bringing it into view before anything is measured.
 */
import { containedIn, isRenderable, type RectLike } from '@/lib/guide/geometry';

export const viewportSize = () => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.innerHeight,
});

export function isShown(el: Element): boolean {
  if (el.getClientRects().length === 0) return false;
  const style = window.getComputedStyle(el);
  return isRenderable(el.getBoundingClientRect(), style);
}

/** The first element matching `selector` that is laid out with a size (hidden sidebars are 0×0). */
export function findShown(selector: string): HTMLElement | null {
  let list: NodeListOf<HTMLElement>;
  try {
    list = document.querySelectorAll<HTMLElement>(selector);
  } catch {
    return null;
  }
  for (const el of Array.from(list)) if (isShown(el)) return el;
  return null;
}

export const resolves = (selector: string): boolean => findShown(selector) !== null;

/** Waits up to `ms` for a selector to show (a page still rendering), then gives up with null. */
export function waitForShown(selector: string, ms: number): Promise<HTMLElement | null> {
  const found = findShown(selector);
  if (found || ms <= 0) return Promise.resolve(found);
  return new Promise((resolve) => {
    const until = Date.now() + ms;
    const poll = () => {
      const el = findShown(selector);
      if (el || Date.now() >= until) resolve(el);
      else window.setTimeout(poll, 80);
    };
    window.setTimeout(poll, 80);
  });
}

const scrolls = (style: CSSStyleDeclaration) => /(auto|scroll|hidden|clip)/.test(`${style.overflowX} ${style.overflowY}`);

/** The whole element is inside the viewport and inside every clipping ancestor's visible box. */
export function fullyInView(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  const view = viewportSize();
  if (!containedIn(rect, { left: 0, top: 0, ...view })) return false;
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (!scrolls(window.getComputedStyle(p))) continue;
    const box = p.getBoundingClientRect();
    const frame: RectLike = { left: box.left + p.clientLeft, top: box.top + p.clientTop, width: p.clientWidth, height: p.clientHeight };
    if (frame.width > 0 && frame.height > 0 && !containedIn(rect, frame)) return false;
  }
  return true;
}

/**
 * Scrolls every scrolling ancestor so the element sits in view, then resolves once it has stopped
 * moving (or after `maxMs`), so whoever measures next measures where it landed.
 */
export function bringIntoView(el: Element, smooth: boolean, maxMs = 700): Promise<void> {
  if (fullyInView(el)) return Promise.resolve();
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  return new Promise((resolve) => {
    const until = Date.now() + maxMs;
    let last = el.getBoundingClientRect();
    let still = 0;
    const tick = () => {
      const now = el.getBoundingClientRect();
      still = Math.abs(now.top - last.top) < 0.5 && Math.abs(now.left - last.left) < 0.5 ? still + 1 : 0;
      last = now;
      if (still >= 3 || Date.now() >= until) resolve();
      else window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });
}

/** Another dialog is open (the stars panel, a celebration, the Kasatik card…): tips wait. */
export function otherDialogOpen(): boolean {
  const dialogs = document.querySelectorAll('[role="dialog"]:not([data-guide]), [role="alertdialog"]:not([data-guide])');
  return Array.from(dialogs).some(isShown);
}

export const prefersReducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

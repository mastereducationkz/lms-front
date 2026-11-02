// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HScroll, scrollEdges } from './h-scroll';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('scrollEdges', () => {
  it('reports nothing when the content fits', () => {
    expect(scrollEdges(0, 300, 300)).toEqual({ left: false, right: false });
    expect(scrollEdges(0, 301, 300)).toEqual({ left: false, right: false });
  });
  it('reports the right edge at the start, both in the middle, the left edge at the end', () => {
    expect(scrollEdges(0, 600, 300)).toEqual({ left: false, right: true });
    expect(scrollEdges(150, 600, 300)).toEqual({ left: true, right: true });
    expect(scrollEdges(300, 600, 300)).toEqual({ left: true, right: false });
    expect(scrollEdges(299.5, 600, 300)).toEqual({ left: true, right: false });
  });
});

describe('<HScroll>', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const size = (el: HTMLElement, scrollWidth: number, clientWidth: number) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  };

  it('marks the hidden sides and follows the scroll', () => {
    // jsdom has no layout: give the scroller its sizes before the first measure.
    const proto = HTMLElement.prototype;
    const sw = Object.getOwnPropertyDescriptor(proto, 'scrollWidth');
    const cw = Object.getOwnPropertyDescriptor(proto, 'clientWidth');
    Object.defineProperty(proto, 'scrollWidth', { configurable: true, get() { return this.classList?.contains('overflow-x-auto') ? 800 : 0; } });
    Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return this.classList?.contains('overflow-x-auto') ? 400 : 0; } });
    try {
      act(() => root.render(<HScroll className="rounded-lg border"><table><tbody><tr><td>wide</td></tr></tbody></table></HScroll>));
      const outer = host.firstElementChild as HTMLElement;
      const scroller = outer.querySelector('.overflow-x-auto') as HTMLElement;
      expect(outer.className).toContain('rounded-lg');
      expect(outer.dataset.scrollRight).toBe('true');
      expect(outer.dataset.scrollLeft).toBeUndefined();

      act(() => { scroller.scrollLeft = 400; scroller.dispatchEvent(new Event('scroll')); });
      expect(outer.dataset.scrollLeft).toBe('true');
      expect(outer.dataset.scrollRight).toBeUndefined();

      size(scroller, 400, 400);
      act(() => { scroller.scrollLeft = 0; scroller.dispatchEvent(new Event('scroll')); });
      expect(outer.dataset.scrollLeft).toBeUndefined();
      expect(outer.dataset.scrollRight).toBeUndefined();
      // The shadows are decoration only.
      expect(outer.querySelectorAll('[aria-hidden="true"]').length).toBe(2);
    } finally {
      if (sw) Object.defineProperty(proto, 'scrollWidth', sw);
      if (cw) Object.defineProperty(proto, 'clientWidth', cw);
    }
  });
});

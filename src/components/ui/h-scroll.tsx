import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Which sides of a horizontal scroller still hide content (1 px tolerance for sub-pixel widths). */
export function scrollEdges(scrollLeft: number, scrollWidth: number, clientWidth: number): { left: boolean; right: boolean } {
  const max = scrollWidth - clientWidth;
  if (max <= 1) return { left: false, right: false };
  return { left: scrollLeft > 1, right: scrollLeft < max - 1 };
}

interface HScrollProps {
  children: ReactNode;
  /** Classes for the outer box (border, radius, margins). */
  className?: string;
  /** Classes for the scrolling element itself. */
  scrollerClassName?: string;
}

/**
 * A horizontal scroller (a wide table on a phone or tablet) that shows a soft shadow on each edge
 * while there is more to scroll that way, so cut-off columns read as "scroll me", not as missing.
 */
export function HScroll({ children, className, scrollerClassName }: HScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => {
      const next = scrollEdges(el.scrollLeft, el.scrollWidth, el.clientWidth);
      setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);

  const shade = 'pointer-events-none absolute inset-y-0 z-[1] w-5 from-black/15 to-transparent transition-opacity duration-150 dark:from-black/70';
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      data-scroll-left={edges.left || undefined}
      data-scroll-right={edges.right || undefined}
    >
      <div ref={ref} className={cn('overflow-x-auto', scrollerClassName)}>
        {children}
      </div>
      <div aria-hidden="true" className={cn(shade, 'left-0 bg-gradient-to-r', edges.left ? 'opacity-100' : 'opacity-0')} />
      <div aria-hidden="true" className={cn(shade, 'right-0 bg-gradient-to-l', edges.right ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

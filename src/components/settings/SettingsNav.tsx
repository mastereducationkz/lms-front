import { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { isAtBottom, isScrollKey, spyActive, type SpySection } from '../../lib/settingsSpy';

export interface NavItem {
  id: string;
  title: string;
  icon: LucideIcon;
}

/** The element that scrolls the page: the app layout's <main>, or the document. */
function scrollerOf(el: HTMLElement | null): HTMLElement {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight) return node;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * The section index beside the Settings column, once the page is wide enough (@4xl of the app's
 * content container). Marks the section being read (lib/settingsSpy). A click marks its item at
 * once and holds it through the scroll it starts; the person's own scrolling (wheel, touch, a
 * scrolling key) hands the mark back to the spy.
 */
export default function SettingsNav({ items, label }: { items: NavItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? '');
  const pinned = useRef(false);
  const navRef = useRef<HTMLElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const spy = useCallback(() => {
    if (pinned.current) return;
    const scroller = scrollerOf(navRef.current);
    const isDocument = scroller === document.scrollingElement || scroller === document.documentElement;
    const boxTop = isDocument ? 0 : scroller.getBoundingClientRect().top;
    const height = isDocument ? window.innerHeight : scroller.clientHeight;
    const sections: SpySection[] = [];
    for (const item of items) {
      const rect = document.getElementById(item.id)?.getBoundingClientRect();
      if (rect) sections.push({ id: item.id, top: rect.top - boxTop, bottom: rect.bottom - boxTop });
    }
    const bottom = isAtBottom(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight);
    const next = spyActive(sections, height, bottom, activeRef.current);
    if (next !== activeRef.current) setActive(next);
  }, [items]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        spy();
      });
    };
    // The person scrolling by hand: the spy takes over again, also after a click.
    const release = () => {
      if (!pinned.current) return;
      pinned.current = false;
      onScroll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (isScrollKey(e.key, editable(e.target))) release();
    };
    // Grabbing the scrollbar: the pointer lands on the scrolling element itself.
    const onPointer = (e: PointerEvent) => {
      if (e.target === scrollerOf(navRef.current)) release();
    };
    // Capture: the page scrolls inside <main>, whose scroll events don't bubble to window.
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchmove', release, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    spy();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchmove', release);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [spy]);

  const go = (id: string) => {
    pinned.current = true;
    setActive(id);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav ref={navRef} aria-label={label} className="hidden @4xl:block">
      <ul className="sticky top-24 space-y-0.5">
        {items.map(({ id, title, icon: Icon }) => {
          const current = id === active;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={current ? 'true' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  go(id);
                }}
                className={`flex min-h-9 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  current ? 'bg-brand-surface font-medium text-brand-subtle-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 flex-none" aria-hidden />
                <span className="min-w-0">{title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

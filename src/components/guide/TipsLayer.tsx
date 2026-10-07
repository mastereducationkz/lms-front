/**
 * One-time page tips: at most one on screen, never over the tour, the welcome or an open dialog, no
 * dimming, nothing blocked. A tip waits until its element is actually on screen (a phone without the
 * sidebar, a closed menu, a section scrolled away) and shows once it has stayed there a moment.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { visibleInViewport } from '@/lib/guide/geometry';
import { findShown, isShown, otherDialogOpen, viewportSize } from './dom';
import { TipCard } from './GuideCards';
import { tipGotIt, tipsFor, type TipDefinition } from './tips';
import { useAnchoredCard } from './useAnchoredCard';

/** How often the page is looked at while a tip is waiting for its element. */
const POLL_MS = 400;
/** The element has to stay in view this long first: no tip flashing past during a scroll or a load. */
const SETTLE_MS = 700;

interface Props {
  role: string | null | undefined;
  pathname: string;
  /** The tour or the welcome is up. */
  busy: boolean;
  dismissed: (key: string) => boolean;
  onDismiss: (key: string) => void;
}

function TipBubble({ tip, el, onGotIt }: { tip: TipDefinition; el: HTMLElement; onGotIt: () => void }) {
  const floating = useAnchoredCard(el, tip.placement, 12);
  return (
    <TipCard
      ref={floating.refs.setFloating}
      tipKey={tip.key}
      title={tip.title}
      body={tip.body}
      gotIt={tipGotIt(tip.locale)}
      side={floating.side}
      style={floating.floatingStyles}
      hidden={!floating.isPositioned || floating.referenceHidden}
      arrowRef={floating.arrowRef}
      arrowStyle={floating.arrowStyle}
      onGotIt={onGotIt}
    />
  );
}

export default function TipsLayer({ role, pathname, busy, dismissed, onDismiss }: Props) {
  const candidates = useMemo(() => tipsFor(role, pathname, dismissed), [role, pathname, dismissed]);
  const [active, setActive] = useState<{ tip: TipDefinition; el: HTMLElement } | null>(null);

  useEffect(() => {
    setActive(null);
    if (busy || candidates.length === 0) return undefined;
    const since = new Map<string, number>();
    let current: { tip: TipDefinition; el: HTMLElement } | null = null;
    const look = () => {
      // A shown tip stays while its element is on the page; it only hides when that scrolls away.
      if (current && document.contains(current.el) && isShown(current.el) && !otherDialogOpen()) return;
      const view = viewportSize();
      let pick: { tip: TipDefinition; el: HTMLElement } | null = null;
      if (!otherDialogOpen()) {
        for (const tip of candidates) {
          const el = findShown(tip.target);
          if (!el || !visibleInViewport(el.getBoundingClientRect(), view, 12)) {
            since.delete(tip.key);
            continue;
          }
          const first = since.get(tip.key) ?? Date.now();
          since.set(tip.key, first);
          if (Date.now() - first >= SETTLE_MS) {
            pick = { tip, el };
            break;
          }
        }
      }
      if (pick?.el !== current?.el || pick?.tip.key !== current?.tip.key) {
        current = pick;
        setActive(pick);
      }
    };
    look();
    const timer = window.setInterval(look, POLL_MS);
    return () => window.clearInterval(timer);
  }, [busy, candidates]);

  if (!active) return null;
  return createPortal(
    <TipBubble
      key={active.tip.key}
      tip={active.tip}
      el={active.el}
      onGotIt={() => {
        onDismiss(active.tip.key);
        setActive(null);
      }}
    />,
    document.body,
  );
}

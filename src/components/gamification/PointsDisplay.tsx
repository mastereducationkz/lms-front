import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { getGamificationStatus } from '../../services/api';
import { getStarsBreakdown } from '../../services/api/gamification';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import StarsBreakdown, { type BreakdownState } from './StarsBreakdown';
import './PointsDisplay.css';
import { formatNumber } from '../../lib/i18n';

interface GamificationStatus {
  activity_points: number;
  daily_streak: number;
  monthly_points: number;
  rank_this_month: number | null;
}

/** Below this width the breakdown opens as a bottom sheet instead of a popover. */
const SHEET_QUERY = '(max-width: 479px)';

/** Dims the page behind the open panel so the panel is the one thing in focus (owner, 2026-10-07). */
const SCRIM =
  'fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] dark:bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.(SHEET_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(SHEET_QUERY);
    if (!mq) return undefined;
    const onChange = () => setNarrow(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/**
 * The student's star total in the Topbar. A button: it opens where the stars came from, how to
 * earn more and the streak multiplier (GET /gamification/breakdown) — a popover on wide screens,
 * a bottom sheet on narrow ones.
 */
export const PointsDisplay: React.FC = () => {
  const [status, setStatus] = useState<GamificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<BreakdownState>({ status: 'loading' });
  const request = useRef(0);
  const narrow = useNarrowScreen();
  const titleId = useId();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getGamificationStatus();
        setStatus(data);
      } catch (error) {
        console.error('Failed to fetch gamification status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadBreakdown = useCallback(() => {
    const id = ++request.current;
    // Keep showing what we have while a reopen refreshes it; only a first load shows skeletons.
    setBreakdown((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    getStarsBreakdown()
      .then((data) => {
        if (id !== request.current) return;
        setBreakdown({ status: 'ready', data });
        // The pill and the panel must agree: the breakdown is the fresher read.
        setStatus((prev) => (prev ? { ...prev, activity_points: data.total } : prev));
      })
      .catch(() => {
        if (id !== request.current) return;
        setBreakdown((prev) => (prev.status === 'ready' ? prev : { status: 'error' }));
      });
  }, []);

  useEffect(() => {
    if (open) loadBreakdown();
  }, [open, loadBreakdown]);

  if (isLoading || !status) {
    return null;
  }

  const total = status.activity_points;
  const panel = <StarsBreakdown state={breakdown} onRetry={loadBreakdown} titleId={titleId} />;
  const pill = (
    <button
      type="button"
      className="points-item"
      data-tour="stars-pill"
      aria-label={`${total.toLocaleString('en-US')} ${total === 1 ? 'star' : 'stars'}. Show where they came from`}
    >
      <svg className="points-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
      <span className="points-value">{formatNumber(total)}</span>
    </button>
  );

  return (
    <div className="points-display">
      {narrow ? (
        <SheetPrimitive.Root open={open} onOpenChange={setOpen}>
          <SheetPrimitive.Trigger asChild>{pill}</SheetPrimitive.Trigger>
          <SheetPrimitive.Portal>
            <SheetPrimitive.Overlay className={SCRIM} />
            <SheetPrimitive.Content
              aria-describedby={undefined}
              className="stars-sheet fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-2xl border-t border-border bg-popover px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-popover-foreground shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
            >
              <SheetPrimitive.Title className="sr-only">Your stars</SheetPrimitive.Title>
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
              <SheetPrimitive.Close
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden />
              </SheetPrimitive.Close>
              {panel}
            </SheetPrimitive.Content>
          </SheetPrimitive.Portal>
        </SheetPrimitive.Root>
      ) : (
        <Popover open={open} onOpenChange={setOpen} modal>
          <PopoverTrigger asChild>{pill}</PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            collisionPadding={8}
            aria-labelledby={titleId}
            className="w-[min(40rem,calc(100vw-1rem))] max-h-[min(42rem,calc(var(--radix-popover-content-available-height)-8px))] overflow-y-auto rounded-xl border-border p-5 shadow-2xl"
          >
            {panel}
          </PopoverContent>
        </Popover>
      )}
      {/* Clicking the scrim is a click outside the (modal) popover: it closes and focus returns to the pill. */}
      {open && !narrow && createPortal(<div className={SCRIM} data-state="open" aria-hidden />, document.body)}
    </div>
  );
};

export default PointsDisplay;

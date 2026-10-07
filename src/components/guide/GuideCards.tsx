/**
 * What the tour and the tips look like: theme tokens only (they switch with dark mode — the old
 * tour's card was white on white in dark), lucide icons only, no emoji.
 */
import { forwardRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { ArrowRight, Check, Lightbulb, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TourText } from './tours';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover';
const SHADOW = 'shadow-[0_20px_44px_-18px_rgb(15_23_42/0.45),0_2px_6px_-2px_rgb(15_23_42/0.12)] dark:shadow-[0_22px_48px_-16px_rgb(0_0_0/0.75),0_2px_6px_-2px_rgb(0_0_0/0.4)]';

interface ArrowProps {
  arrowRef?: RefObject<HTMLDivElement>;
  arrowStyle?: CSSProperties;
}

/** A small rotated square under the card's body: only the half outside the card shows. */
function Arrow({ arrowRef, arrowStyle }: ArrowProps) {
  if (!arrowRef) return null;
  return <div ref={arrowRef} style={arrowStyle} aria-hidden className="absolute z-0 h-3 w-3 rotate-45 border border-border bg-popover" />;
}

interface TourCardProps extends ArrowProps {
  titleId: string;
  bodyId: string;
  title: string;
  body: string;
  index: number;
  total: number;
  text: TourText;
  leading?: ReactNode;
  style?: CSSProperties;
  className?: string;
  stepId: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export const TourCard = forwardRef<HTMLDivElement, TourCardProps>(function TourCard(
  { titleId, bodyId, title, body, index, total, text, leading, style, className, stepId, onNext, onBack, onSkip, onClose, arrowRef, arrowStyle },
  ref,
) {
  const isFirst = index === 0;
  const isLast = index >= total - 1;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      tabIndex={-1}
      data-guide="tour-card"
      data-step-id={stepId}
      data-step-index={index + 1}
      data-step-total={total}
      style={style}
      className={cn('pointer-events-auto fixed left-0 top-0 z-[71] flex w-[min(22rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)] outline-none', className)}
    >
      <Arrow arrowRef={arrowRef} arrowStyle={arrowStyle} />
      <div className={cn('relative z-[1] flex min-h-0 w-full flex-col rounded-2xl border border-border bg-popover text-popover-foreground', SHADOW)}>
        <div className="flex gap-1 px-4 pt-3.5" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i < index ? 'bg-brand/45' : i === index ? 'bg-brand' : 'bg-foreground/10')}
            />
          ))}
        </div>
        <div className="flex items-start gap-3 px-4 pt-3">
          {leading}
          <h2 id={titleId} className="min-w-0 flex-1 pt-1 text-[15px] font-semibold leading-snug text-foreground [text-wrap:balance]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={text.close}
            data-guide-action="close"
            className={cn('-mr-1.5 -mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOCUS)}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p id={bodyId} className="min-h-0 overflow-y-auto px-4 pt-1.5 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4 pt-4">
          <button
            type="button"
            onClick={onSkip}
            data-guide-action="skip"
            className={cn('-ml-1 rounded-md px-1 py-1 text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline', FOCUS)}
          >
            {text.skip}
          </button>
          <span className="flex-1" />
          {!isFirst && (
            <button
              type="button"
              onClick={onBack}
              data-guide-action="back"
              className={cn('inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted', FOCUS)}
            >
              {text.back}
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            data-guide-action={isLast ? 'done' : 'next'}
            data-guide-primary
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-solid px-3.5 text-sm font-semibold text-brand-solid-foreground transition-colors hover:bg-brand-solid-hover', FOCUS)}
          >
            {isLast ? text.done : text.next}
            {isLast ? <Check className="h-4 w-4" aria-hidden /> : <ArrowRight className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
});

interface TipCardProps extends ArrowProps {
  tipKey: string;
  title: string;
  body: string;
  gotIt: string;
  side: string;
  style?: CSSProperties;
  hidden?: boolean;
  onGotIt: () => void;
}

export const TipCard = forwardRef<HTMLDivElement, TipCardProps>(function TipCard(
  { tipKey, title, body, gotIt, side, style, hidden, onGotIt, arrowRef, arrowStyle },
  ref,
) {
  const titleId = `guide-tip-${tipKey.replace(/[^a-z0-9-]/gi, '-')}`;
  return (
    <div
      ref={ref}
      role="region"
      aria-labelledby={titleId}
      data-guide="tip"
      data-tip-key={tipKey}
      data-side={side}
      style={{ ...style, visibility: hidden ? 'hidden' : undefined }}
      className="pointer-events-auto fixed left-0 top-0 z-40 flex w-[min(18.5rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-1.5rem)]"
    >
      <Arrow arrowRef={arrowRef} arrowStyle={arrowStyle} />
      <div
        className={cn(
          'relative z-[1] flex w-full flex-col overflow-y-auto rounded-xl border border-border bg-popover p-3.5 text-popover-foreground',
          SHADOW,
          'animate-in fade-in-0 zoom-in-95 duration-200 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 motion-reduce:animate-none',
        )}
        data-side={side}
      >
        <div className="flex items-start gap-2.5">
          <span className="mt-px inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-subtle text-brand-subtle-foreground" aria-hidden>
            <Lightbulb className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p id={titleId} className="pt-1 text-sm font-semibold leading-snug text-foreground">
              {title}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={onGotIt}
            data-guide-action="got-it"
            className={cn('inline-flex h-8 items-center rounded-lg bg-brand-solid px-3 text-[13px] font-semibold text-brand-solid-foreground transition-colors hover:bg-brand-solid-hover', FOCUS)}
          >
            {gotIt}
          </button>
        </div>
      </div>
    </div>
  );
});

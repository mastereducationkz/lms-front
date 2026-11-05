import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  state: 'loading' | 'error';
  heading: string;
  hint: string;
  /** Error state: what went wrong, and what to do. */
  error?: string;
  actions?: ReactNode;
}

/**
 * The full-screen «opening the practice copy» screen: the brand logo, a spinner, a title and a one-line hint; or, when the
 * link failed or expired, the reason and a button. Layout follows its own container (a phone-sized tab and a desktop one
 * share it), the tab's markup twin lives in lib/training/loadingTab.ts.
 */
export default function TrainingLoader({ state, heading, hint, error, actions }: Props) {
  return (
    <div className="@container flex min-h-screen items-center justify-center bg-background p-4" data-training-loader={state}>
      <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center @sm:max-w-md">
        <img src="/logo.svg" alt="" className="mb-1 h-10 w-auto @sm:h-12" />
        {state === 'loading' ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" aria-label={heading} />
            <h1 className="text-base font-semibold text-foreground @sm:text-lg">{heading}</h1>
            <p className="text-sm text-muted-foreground">{hint}</p>
          </>
        ) : (
          <>
            <h1 className="text-base font-semibold text-foreground @sm:text-lg">{heading}</h1>
            <p role="alert" className={cn('text-sm text-destructive')}>{error}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
            {actions && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
          </>
        )}
      </div>
    </div>
  );
}

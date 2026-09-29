import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface Props {
  /** The deep-link anchor (`#materials`), also what the section chips scroll to. */
  id: string;
  title?: string;
  icon?: ReactNode;
  /** Right side of the heading row: a count, a save button. */
  aside?: ReactNode;
  /**
   * A section the lesson card already had (materials, recording, Meet): it draws its own heading
   * and a top rule meant for the card, so the rule is dropped here — and a card whose section
   * rendered nothing (no recording, not this viewer's Meet record) hides itself.
   */
  embedded?: boolean;
  children: ReactNode;
}

/** One block of `/lessons/:id`: a card with an anchor the page can scroll to. */
export default function SectionCard({ id, title, icon, aside, embedded, children }: Props) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn(
        'scroll-mt-[calc(var(--topbar-h,0px)+14rem)] rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5',
        embedded && '[&:not(:has(*))]:hidden [&>*:first-child]:mt-0 [&>*:first-child]:border-t-0 [&>*:first-child]:pt-0',
      )}
    >
      {title && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            {icon}
            {title}
          </h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

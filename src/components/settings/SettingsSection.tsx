import type { ReactNode } from 'react';

/**
 * One Settings section: its heading and a line on what it's for, above a panel of rows. The
 * panel is its own @container, so each row lays itself out by the panel's width, not the window's.
 */
export function SettingsSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-3">
      <div className="px-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold leading-snug text-foreground">
          {title}
        </h2>
        {description && <p className="mt-0.5 max-w-prose text-sm text-muted-foreground [text-wrap:pretty]">{description}</p>}
      </div>
      <div className="@container overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">{children}</div>
    </section>
  );
}

/**
 * A row in a panel: what it is on the left, its control on the right; the control drops under
 * the text when the panel is narrow.
 */
export function SettingsRow({ label, description, children, htmlFor }: { label: ReactNode; description?: ReactNode; children?: ReactNode; htmlFor?: string }) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 first:border-t-0 sm:px-5 @lg:flex-row @lg:items-center @lg:justify-between @lg:gap-6">
      <div className="min-w-0">
        <Label {...(htmlFor ? { htmlFor } : {})} className="block text-sm font-medium text-foreground">
          {label}
        </Label>
        {description && <div className="mt-0.5 text-sm text-muted-foreground [text-wrap:pretty]">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 @lg:flex-none @lg:justify-end">{children}</div>}
    </div>
  );
}

/** The brand fill for a section's main action (tokens, so dark mode follows). */
export const SOLID = 'bg-brand-solid text-brand-solid-foreground hover:bg-brand-solid-hover';

/** A two- or three-way choice drawn as one segmented control (radiogroup semantics). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg border border-border bg-muted p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              active ? 'bg-card text-foreground shadow-sm ring-1 ring-inset ring-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import { cn } from '@/lib/utils';

export interface SegmentedOption<V extends string> { value: V; label: string }

/** A few mutually exclusive choices as one row of buttons (subtitles, speed). */
export default function Segmented<V extends string>({ label, value, options, onChange, className }: {
  label: string;
  value: V;
  options: SegmentedOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-lg border border-border bg-muted/40 p-0.5', className)}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

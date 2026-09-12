import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Input } from './input';

export interface SearchableOption {
  value: string;
  label: string;
  /** Secondary text on the right of the row; also searched. */
  hint?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** A single-choice dropdown with a search box: type part of a name to filter, Enter picks the first match. */
export function SearchableSelect({
  options, value, onChange, placeholder = 'Choose…', searchPlaceholder = 'Type to search…',
  emptyText = 'Nothing matches', disabled, className, ariaLabel,
}: SearchableSelectProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    // Every word must appear somewhere: "aug gulz" finds "August 19 SAT - Gulzada".
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => {
      const haystack = `${o.label} ${o.hint ?? ''}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      // Start on the current choice, so reopening shows where you are.
      setActive(Math.max(0, options.findIndex((o) => o.value === value)));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (query) setActive(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label={ariaLabel} aria-expanded={open} disabled={disabled}
                className={`justify-between font-normal ${className ?? ''}`}>
          <span className={`truncate ${selected ? '' : 'text-muted-foreground'}`}>{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" align="start">
        <div className="flex items-center gap-2 border-b px-2">
          <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && filtered.length) {
                e.preventDefault();
                pick((filtered[active] ?? filtered[0]).value);
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${id}-option-${active}` : undefined}
          />
        </div>
        <ul ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                id={`${id}-option-${i}`}
                data-index={i}
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${i === active ? 'bg-muted' : o.value === value ? 'bg-muted/40' : ''}`}
              >
                <Check className={`h-4 w-4 shrink-0 ${o.value === value ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

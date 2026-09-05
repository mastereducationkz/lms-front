import { useEffect, useMemo, useRef, useState } from 'react';
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
}

/** A single-choice dropdown with a search box: type part of a name to filter, Enter picks the first match. */
export function SearchableSelect({
  options, value, onChange, placeholder = 'Choose…', searchPlaceholder = 'Type to search…',
  emptyText = 'Nothing matches', disabled, className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const pick = (v: string) => { onChange(v); setOpen(false); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
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
              if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); pick(filtered[0].value); }
              if (e.key === 'Escape') setOpen(false);
            }}
          />
        </div>
        <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>}
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60 ${o.value === value ? 'bg-muted/40' : ''}`}
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

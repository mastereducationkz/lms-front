import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { UnitKind, UnitOption } from '../../services/api/checkpoints';

export interface PickedUnit {
  lesson_id: number;
  kind: UnitKind;
  title: string;
}

export const MAX_UNITS = 4;

interface UnitPickerProps {
  /** Units of the course, grouped by their module name (Verbal / Math). */
  options: UnitOption[];
  selected: PickedUnit[];
  onChange: (next: PickedUnit[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

const KIND_CHIP: Record<UnitKind, string> = {
  verbal: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  math: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
};

/** The units a checkpoint requires: chips for the current choice, "Add unit" opens a searchable
 *  list of the course's units grouped by module. Nobody needs to know a lesson id. */
export function UnitPicker({ options, selected, onChange, disabled, loading }: UnitPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIds = useMemo(() => new Set(selected.map((u) => u.lesson_id)), [selected]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.module} ${o.title}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  const grouped = useMemo(() => {
    const out: [string, UnitOption[]][] = [];
    for (const o of filtered) {
      const g = out.find(([module]) => module === o.module);
      if (g) g[1].push(o); else out.push([o.module, [o]]);
    }
    return out;
  }, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const toggle = (o: UnitOption) => {
    if (selectedIds.has(o.lesson_id)) {
      onChange(selected.filter((u) => u.lesson_id !== o.lesson_id));
    } else if (selected.length < MAX_UNITS) {
      onChange([...selected, { lesson_id: o.lesson_id, kind: o.kind, title: o.title }]);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((u) => (
        <span key={u.lesson_id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${KIND_CHIP[u.kind]}`}>
          <span className="font-semibold">{u.kind === 'verbal' ? 'V' : 'M'}</span>
          <span className="max-w-[16rem] truncate">{u.title}</span>
          {!disabled && (
            <button type="button" aria-label={`Remove ${u.title}`} className="ml-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                    onClick={() => onChange(selected.filter((x) => x.lesson_id !== u.lesson_id))}>
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={selected.length >= MAX_UNITS}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              {selected.length >= MAX_UNITS ? '4 units max' : 'Add unit'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[26rem] p-0" align="start">
            <div className="flex items-center gap-2 border-b px-2">
              <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search units…"
                className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); toggle(filtered[0]); }
                }}
              />
            </div>
            <div className="max-h-80 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
              {loading && <p className="px-3 py-2 text-sm text-muted-foreground">Loading units…</p>}
              {!loading && filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Nothing matches</p>}
              {grouped.map(([module, items]) => (
                <div key={module}>
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{module}</div>
                  {items.map((o) => {
                    const on = selectedIds.has(o.lesson_id);
                    return (
                      <button key={o.lesson_id} type="button" role="option" aria-selected={on} onClick={() => toggle(o)}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60 ${on ? 'bg-muted/40' : ''}`}>
                        <Check className={`h-4 w-4 shrink-0 ${on ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                        <span className="truncate">{o.title}</span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">id {o.lesson_id}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">2 or 3 Verbal units and 1 or 2 Math units, 4 at most.</p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

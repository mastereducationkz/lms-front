/**
 * The open list of a dropdown: an optional search box, the listbox, and the "first 300" note.
 * Portalled above everything (z-[2000], the layer selects always used), the trigger's width or
 * 12rem, never wider than the screen, never taller than 20rem or the room left; flips above the
 * trigger when there is no room below (Radix Popover does the measuring).
 */
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/sharedUi';
import { useDropdown } from './Dropdown';
import {
  PAGE_STEP, ROW_LIMIT, TYPEAHEAD_MS, buildView, edgeIndex, isPrintableKey, moveIndex, typeAheadIndex,
  type DropdownOption, type DropdownRow, type DropdownView,
} from './logic';

export interface DropdownPanelProps {
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
}

const PANEL_BASE =
  'z-[2000] flex w-[min(max(var(--radix-popover-trigger-width),12rem),calc(100vw-1rem))] max-h-[min(20rem,var(--radix-popover-content-available-height))] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none ' +
  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 ' +
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-popover-content-transform-origin]';

export function DropdownPanel({ className, side = 'bottom', align = 'start', sideOffset = 4 }: DropdownPanelProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        role="presentation"
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(PANEL_BASE, className)}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (inputRef.current ?? listRef.current)?.focus({ preventScroll: true });
        }}
      >
        <PanelBody inputRef={inputRef} listRef={listRef} />
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

/** Where the list starts: on the chosen option when it is listed and pickable, else the first pickable one. */
function startIndex(view: DropdownView, value: string | null): number {
  const i = value === null ? -1 : view.options.findIndex((o) => o.value === value);
  return i >= 0 && !view.options[i].disabled ? i : edgeIndex(view.options, 'first');
}

/** Scroll the list just enough to show a row, or centre it (on open). */
function reveal(list: HTMLElement | null, row: HTMLElement | null | undefined, centre = false) {
  if (!list || !row) return;
  const top = row.offsetTop;
  const bottom = top + row.offsetHeight;
  if (centre) list.scrollTop = Math.max(0, top - (list.clientHeight - row.offsetHeight) / 2);
  else if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

function PanelBody({ inputRef, listRef }: {
  inputRef: React.RefObject<HTMLInputElement>; listRef: React.RefObject<HTMLDivElement>;
}) {
  const ctx = useDropdown();
  const t = useT();
  const { entries, searchable, listId } = ctx;
  // A letter typed on the closed trigger: the first letter of the search, or a type-ahead jump.
  const [typed] = React.useState(() => ctx.typedKey.current);
  React.useEffect(() => { ctx.typedKey.current = null; }, [ctx.typedKey]);
  const [query, setQuery] = React.useState(searchable && typed ? typed : '');
  const view = React.useMemo(() => buildView(entries, searchable ? query : ''), [entries, searchable, query]);
  const [active, setActive] = React.useState(() => {
    if (typed && !searchable) {
      const jump = typeAheadIndex(view.options, typed, startIndex(view, ctx.value));
      if (jump >= 0) return jump;
    }
    return query ? edgeIndex(view.options, 'first') : startIndex(view, ctx.value);
  });
  const current = active >= 0 && active < view.options.length ? active : edgeIndex(view.options, 'first');
  const keyboardMove = React.useRef(false);
  const buffer = React.useRef({ text: typed && !searchable ? typed : '', at: typed ? Date.now() : 0 });
  const optionId = (i: number) => `${listId}-o${i}`;
  const rowAt = (i: number) => (i >= 0 ? document.getElementById(optionId(i)) : null);

  // Open on the chosen row, centred; again once Radix has measured the room and sized the list.
  React.useLayoutEffect(() => {
    reveal(listRef.current, rowAt(current), true);
    const frame = requestAnimationFrame(() => reveal(listRef.current, rowAt(current), true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    reveal(listRef.current, rowAt(current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const moveTo = (i: number) => {
    if (i < 0) return;
    keyboardMove.current = true;
    setActive(i);
  };

  const onSearch = (next: string) => {
    setQuery(next);
    const nextView = buildView(entries, next);
    setActive(next.trim() ? edgeIndex(nextView.options, 'first') : startIndex(nextView, ctx.value));
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const inInput = event.currentTarget === inputRef.current;
    const opts = view.options;
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); moveTo(moveIndex(opts, current, 1)); return;
      case 'ArrowUp': event.preventDefault(); moveTo(moveIndex(opts, current, -1)); return;
      case 'PageDown': event.preventDefault(); moveTo(moveIndex(opts, current, PAGE_STEP)); return;
      case 'PageUp': event.preventDefault(); moveTo(moveIndex(opts, current, -PAGE_STEP)); return;
      case 'Home':
      case 'End':
        // While a query is typed, Home / End move the caret in it.
        if (inInput && query) return;
        event.preventDefault();
        moveTo(edgeIndex(opts, event.key === 'Home' ? 'first' : 'last'));
        return;
      case 'Enter':
        // Never let Enter submit the form around the field.
        event.preventDefault();
        if (current >= 0 && !opts[current]?.disabled) ctx.pick(opts[current].value);
        return;
      case 'Tab':
        event.preventDefault();
        ctx.setOpen(false);
        return;
      default:
    }
    if (inInput || !isPrintableKey(event)) return;
    // No search box: letters jump to the next row starting with what was typed.
    const now = Date.now();
    const recent = now - buffer.current.at < TYPEAHEAD_MS;
    if (event.key === ' ' && !(recent && buffer.current.text)) {
      event.preventDefault();
      if (current >= 0 && !opts[current]?.disabled) ctx.pick(opts[current].value);
      return;
    }
    event.preventDefault();
    buffer.current = { text: (recent ? buffer.current.text : '') + event.key, at: now };
    moveTo(typeAheadIndex(opts, buffer.current.text, current));
  };

  const activeId = current >= 0 ? optionId(current) : undefined;
  const placeholder = ctx.searchPlaceholder ?? t('sharedUi.select.searchPlaceholder');

  return (
    <>
      {searchable && (
        <div className="flex shrink-0 items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-label={placeholder}
            placeholder={placeholder}
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            className="h-10 w-full min-w-0 bg-transparent py-2 text-base outline-none placeholder:text-muted-foreground sm:h-9 sm:text-sm [@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:text-base"
          />
        </div>
      )}
      {/* overscroll-contain: reaching either end of the list never scrolls what is behind it. */}
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        tabIndex={searchable ? undefined : -1}
        aria-activedescendant={searchable ? undefined : activeId}
        onKeyDown={searchable ? undefined : onKeyDown}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 outline-none"
      >
        {view.options.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground" onMouseDown={(e) => e.preventDefault()}>
            {ctx.emptyText ?? t('sharedUi.select.empty')}
          </div>
        ) : (
          renderRows(view.rows, (row) => (
            <OptionRow
              key={row.option.key}
              id={optionId(row.index)}
              option={row.option}
              selected={row.option.value === ctx.value}
              active={row.index === current}
              onHover={() => { if (row.index !== current && !row.option.disabled) setActive(row.index); }}
              onPick={() => ctx.pick(row.option.value)}
            />
          ))
        )}
      </div>
      {view.capped && (
        <div className="shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground" onMouseDown={(e) => e.preventDefault()}>
          {t('sharedUi.select.capped', { count: ROW_LIMIT })}
        </div>
      )}
    </>
  );
}

/** Options under a group header go inside a role="group" named by it; separators are decoration. */
function renderRows(rows: DropdownRow[], option: (row: Extract<DropdownRow, { kind: 'option' }>) => React.ReactNode) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (row.kind === 'separator') {
      out.push(<div key={`sep-${row.key}`} aria-hidden="true" className="-mx-1 my-1 h-px bg-muted" />);
    } else if (row.kind === 'option') {
      out.push(option(row));
    } else {
      const members: React.ReactNode[] = [];
      while (i + 1 < rows.length) {
        const next = rows[i + 1];
        if (next.kind !== 'option' || next.option.group !== row.key) break;
        members.push(option(next));
        i += 1;
      }
      const headerId = `grp-${row.key}`;
      out.push(
        <div key={headerId} role="group" aria-labelledby={headerId}>
          <div id={headerId} className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground" onMouseDown={(e) => e.preventDefault()}>
            {row.label}
          </div>
          {members}
        </div>,
      );
    }
  }
  return out;
}

function OptionRow({ id, option, selected, active, onHover, onPick }: {
  id: string; option: DropdownOption; selected: boolean; active: boolean; onHover: () => void; onPick: () => void;
}) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled || undefined}
      data-value={option.value}
      data-active={active || undefined}
      data-disabled={option.disabled || undefined}
      // Rows never take focus: it stays in the search box or the list.
      onMouseDown={(e) => e.preventDefault()}
      onPointerMove={(e) => { if (e.pointerType === 'mouse') onHover(); }}
      onClick={() => { if (!option.disabled) onPick(); }}
      className={cn(
        'relative flex min-h-10 w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none sm:min-h-9 [@media(pointer:coarse)]:min-h-10',
        active && 'bg-accent text-accent-foreground',
        option.disabled && 'cursor-not-allowed opacity-50',
        option.className,
      )}
    >
      <span data-dd-label="" className="min-w-0 flex-1 whitespace-normal break-words">{option.label}</span>
      {option.hint && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{option.hint}</span>}
      {selected && (
        <span className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center">
          <Check className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

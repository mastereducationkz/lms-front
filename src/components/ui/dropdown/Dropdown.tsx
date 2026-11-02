/**
 * The one dropdown engine behind Select (shadcn API), NativeSelect (drop-in for <select>) and
 * SearchableSelect: a combobox button that opens a portalled listbox, searchable from
 * SEARCH_THRESHOLD options. Built on Radix Popover for positioning, flipping, portal, dismiss
 * and focus return; the list itself lives in DropdownPanel.tsx and its logic in logic.ts.
 */
import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isPrintableKey, shouldSearch, type DropdownEntry, type DropdownOption } from './logic';

export interface DropdownContextValue {
  entries: DropdownEntry[];
  /** The chosen value; null when nothing is chosen. */
  value: string | null;
  /** The option the value points at, listed or not; null when no option matches. */
  selected: DropdownOption | null;
  open: boolean;
  setOpen: (open: boolean) => void;
  pick: (value: string) => void;
  disabled: boolean;
  searchable: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  listId: string;
  triggerId?: string;
  /** A character typed on the closed trigger, handed to the panel when it opens (the panel clears it). */
  typedKey: React.MutableRefObject<string | null>;
}

const DropdownContext = React.createContext<DropdownContextValue | null>(null);

export function useDropdown(): DropdownContextValue {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error('Dropdown parts must be used inside <DropdownRoot>');
  return ctx;
}

export interface DropdownRootProps {
  entries: DropdownEntry[];
  /** Controlled when not undefined; null (or a value no option has) means nothing is chosen. */
  value?: string | null;
  defaultValue?: string | null;
  /** Called once per real change (picking the current value again is not a change). */
  onValueChange?: (value: string) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  /** Form field name: renders a hidden native control so form posts and `required` still work. */
  name?: string;
  required?: boolean;
  form?: string;
  /** Uncontrolled with no default: start on the first pickable option, as a native <select> does. */
  selectFirst?: boolean;
  /** Force the search box on or off; by default it shows from SEARCH_THRESHOLD listed options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** The trigger's id, so the listbox can point back at it. */
  triggerId?: string;
  children: React.ReactNode;
}

const firstPickable = (entries: DropdownEntry[]) =>
  entries.find((e): e is DropdownOption => e.kind === 'option' && !e.disabled && !e.hidden)?.value ?? null;

export function DropdownRoot({
  entries, value: valueProp, defaultValue, onValueChange, open: openProp, defaultOpen, onOpenChange, disabled = false,
  name, required, form, selectFirst, searchable, searchPlaceholder, emptyText, triggerId, children,
}: DropdownRootProps) {
  const listId = `${React.useId()}-listbox`;
  const [inner, setInner] = React.useState<string | null | undefined>(defaultValue);
  const [openInner, setOpenInner] = React.useState(defaultOpen ?? false);
  const controlled = valueProp !== undefined;
  const raw = controlled ? valueProp : inner;
  const value = raw === undefined || raw === null ? (!controlled && selectFirst ? firstPickable(entries) : null) : raw;
  const selected = React.useMemo(
    () => (value === null ? null : entries.find((e): e is DropdownOption => e.kind === 'option' && e.value === value) ?? null),
    [entries, value],
  );
  const open = (openProp ?? openInner) && !disabled;
  const typedKey = React.useRef<string | null>(null);

  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const setOpen = React.useCallback((next: boolean) => {
    setOpenInner(next);
    onOpenChangeRef.current?.(next);
  }, []);

  const valueRef = React.useRef(value);
  valueRef.current = value;
  const onValueChangeRef = React.useRef(onValueChange);
  onValueChangeRef.current = onValueChange;
  const pick = React.useCallback((next: string) => {
    setOpen(false);
    if (next === valueRef.current) return;
    if (!controlled) setInner(next);
    onValueChangeRef.current?.(next);
  }, [controlled, setOpen]);

  const ctx = React.useMemo<DropdownContextValue>(() => ({
    entries, value, selected, open, setOpen, pick, disabled,
    searchable: searchable ?? shouldSearch(entries),
    searchPlaceholder, emptyText, listId, triggerId,
    typedKey,
  }), [entries, value, selected, open, setOpen, pick, disabled, searchable, searchPlaceholder, emptyText, listId, triggerId]);

  return (
    <DropdownContext.Provider value={ctx}>
      {/* `modal`: inside a Dialog the list is portalled outside it, and the Dialog's scroll lock swallowed
          every wheel and touch scroll over it (2026-09-15, «Who is this?»). A modal popover's own lock sits
          on top of the Dialog's, so its list scrolls; the page behind stays still, as with a native select. */}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal>
        {children}
      </PopoverPrimitive.Root>
      {(name || required || form) && (
        <FormControl entries={entries} value={value} name={name} required={required} form={form} disabled={disabled} onPick={pick} />
      )}
    </DropdownContext.Provider>
  );
}

const HIDDEN_CONTROL: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, margin: 0, padding: 0, border: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none',
};

/**
 * A hidden native <select> mirroring the value, so a form post carries the field and `required`
 * still blocks an empty submit. It sits right after the trigger (absolute, no top/left: its static
 * position), so the browser's "please choose" bubble points at the field.
 */
function FormControl({ entries, value, name, required, form, disabled, onPick }: {
  entries: DropdownEntry[]; value: string | null; name?: string; required?: boolean; form?: string; disabled: boolean; onPick: (v: string) => void;
}) {
  const options = entries.filter((e): e is DropdownOption => e.kind === 'option');
  const hasEmpty = options.some((o) => o.value === '');
  const known = value !== null && options.some((o) => o.value === value);
  const ref = React.useRef<HTMLSelectElement>(null);
  // Keep the DOM value in step even when the parent turned a change down.
  React.useLayoutEffect(() => { if (ref.current) ref.current.value = known ? value! : ''; });
  return (
    <select
      ref={ref} aria-hidden tabIndex={-1} name={name} required={required} form={form} disabled={disabled}
      value={known ? value! : ''} onChange={(e) => onPick(e.target.value)} style={HIDDEN_CONTROL}
    >
      {!hasEmpty && <option value="" />}
      {options.map((o) => <option key={o.key} value={o.value} disabled={o.disabled}>{o.text}</option>)}
    </select>
  );
}

const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown', 'ArrowUp']);

export type DropdownTriggerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> & {
  /** Drawn after the label; the default is the chevron. */
  icon?: React.ReactNode;
};

/** The trigger every call site sees: `role="combobox"`, opens on click, Enter, Space, arrows or typing. */
export const DropdownTrigger = React.forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  ({ className, children, icon, onKeyDown, onClick, id, ...props }, ref) => {
    const ctx = useDropdown();
    return (
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={ref}
          type="button"
          id={id ?? ctx.triggerId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={ctx.open}
          aria-controls={ctx.open ? ctx.listId : undefined}
          aria-autocomplete="none"
          disabled={ctx.disabled}
          data-placeholder={ctx.selected ? undefined : ''}
          data-dd-value={ctx.value ?? ''}
          className={className}
          {...props}
          onClick={(event) => {
            onClick?.(event);
            // A click the keyboard made while the list is already open must not toggle it shut.
            if (event.detail === 0 && ctx.open) event.preventDefault();
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || ctx.disabled) return;
            if (OPEN_KEYS.has(event.key)) {
              event.preventDefault();
              ctx.setOpen(true);
            } else if (isPrintableKey(event)) {
              event.preventDefault();
              ctx.typedKey.current = event.key;
              ctx.setOpen(true);
            }
          }}
        >
          {children}
          {icon === undefined ? <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" /> : icon}
        </button>
      </PopoverPrimitive.Trigger>
    );
  },
);
DropdownTrigger.displayName = 'DropdownTrigger';

/** The chosen option's label on the trigger, or the placeholder. Truncates on one line with a title. */
export function DropdownValue({ placeholder, className, children }: {
  placeholder?: React.ReactNode; className?: string; children?: React.ReactNode;
}) {
  const { selected } = useDropdown();
  const body = selected ? (children ?? selected.label) : placeholder;
  const muted = !selected || (selected.disabled && selected.value === '') || selected.hidden;
  return (
    <span
      data-dd-text=""
      className={cn('block min-w-0 flex-1 truncate text-left', muted && 'text-muted-foreground', className)}
      title={selected?.text || (typeof placeholder === 'string' ? placeholder : undefined)}
    >
      {body ?? ' '}
    </span>
  );
}

/** Trigger classes shared by every dropdown: the look of the app's inputs (height, border, radius, font). */
export const TRIGGER_BASE =
  'flex h-9 min-w-0 items-center justify-between gap-2 whitespace-nowrap rounded-md border border-input px-3 py-2 text-left text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring data-[state=open]:ring-1 data-[state=open]:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const BLOCK_DISPLAY = new Set(['block', 'flex', 'grid', 'table', 'flow-root']);
const INLINE_DISPLAY = new Set(['inline', 'inline-block', 'inline-flex', 'inline-grid', 'inline-table']);

/**
 * The trigger lays its label and chevron out as a flex row, so a call site's display class
 * (`block w-full` was common on native selects) maps to flex / inline-flex, variants kept
 * (`sm:block` → `sm:flex`); `hidden` stays as it is.
 */
export function normalizeDisplay(className?: string): string | undefined {
  if (!className) return className;
  return className.split(/\s+/).map((token) => {
    const cut = token.lastIndexOf(':') + 1;
    const prefix = token.slice(0, cut);
    const base = token.slice(cut);
    if (BLOCK_DISPLAY.has(base)) return `${prefix}flex`;
    if (INLINE_DISPLAY.has(base)) return `${prefix}inline-flex`;
    return token;
  }).join(' ');
}

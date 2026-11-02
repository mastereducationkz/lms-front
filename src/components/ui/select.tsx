/**
 * The shadcn Select API (Select, SelectTrigger, SelectValue, SelectContent, SelectItem, …) on the
 * app's one dropdown engine (./dropdown): same exports and props as the Radix version, so call
 * sites did not change, but the list is searchable from 6 options and looks like every other
 * dropdown.
 *
 * Items register even while the list is closed, so SelectValue shows the chosen label: SelectContent
 * always renders its children into a detached element (never in the page), where each part leaves a
 * marker; the markers' order and text become the engine's entries.
 */
import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { DropdownRoot, DropdownTrigger, DropdownValue, TRIGGER_BASE } from './dropdown/Dropdown';
import { DropdownPanel } from './dropdown/DropdownPanel';
import type { DropdownEntry } from './dropdown/logic';

interface ItemRecord { value: string; disabled?: boolean; textValue?: string; className?: string; children: React.ReactNode }

interface Collector {
  container: HTMLElement | null;
  records: Map<string, ItemRecord | { label: React.ReactNode }>;
  /** Re-read the markers now (SelectContent's layout effect: before paint, so no placeholder flash). */
  rebuild: () => void;
  /** Re-read them after this commit (an item that re-rendered or left on its own). */
  schedule: () => void;
}

const CollectorContext = React.createContext<Collector | null>(null);
/** True inside SelectContent's detached copy: the only place items render anything. */
const CollectingContext = React.createContext(false);

const sameEntries = (a: DropdownEntry[], b: DropdownEntry[]) =>
  a.length === b.length && a.every((x, i) => {
    const y = b[i];
    if (x.kind !== y.kind || x.key !== y.key) return false;
    if (x.kind === 'separator') return true;
    if (x.kind === 'group' && y.kind === 'group') return x.text === y.text && x.label === y.label;
    if (x.kind === 'option' && y.kind === 'option') {
      return x.value === y.value && x.text === y.text && x.keywords === y.keywords && x.disabled === y.disabled
        && x.group === y.group && x.className === y.className && x.label === y.label;
    }
    return false;
  });

const textOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();

function readEntries(container: HTMLElement, records: Collector['records']): DropdownEntry[] {
  const entries: DropdownEntry[] = [];
  container.querySelectorAll<HTMLElement>('[data-dd-part]').forEach((el) => {
    const key = el.dataset.ddKey ?? '';
    const group = el.parentElement?.closest<HTMLElement>('[data-dd-part="group"]')?.dataset.ddKey;
    const part = el.dataset.ddPart;
    if (part === 'separator') entries.push({ kind: 'separator', key });
    else if (part === 'label') {
      const record = records.get(key);
      // A label outside any group heads the rows that follow it, as in Radix.
      if (group) entries.push({ kind: 'group', key: group, label: record && 'label' in record ? record.label : textOf(el), text: textOf(el) });
    } else if (part === 'item') {
      const record = records.get(key);
      if (!record || !('value' in record)) return;
      entries.push({
        kind: 'option', key, value: record.value, label: record.children, text: textOf(el) || record.textValue || record.value,
        keywords: record.textValue, disabled: record.disabled, group, className: record.className,
      });
    }
  });
  return entries;
}

type SelectProps = {
  value?: string;
  defaultValue?: string;
  // Method syntax, as in Radix: a handler typed for a narrower union (`(v: 'a' | 'b') => void`) still fits.
  onValueChange?(value: string): void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?(open: boolean): void;
  disabled?: boolean;
  name?: string;
  required?: boolean;
  form?: string;
  dir?: 'ltr' | 'rtl';
  autoComplete?: string;
  children?: React.ReactNode;
};

function Select({ children, value, defaultValue, onValueChange, open, defaultOpen, onOpenChange, disabled, name, required, form }: SelectProps) {
  const [entries, setEntries] = React.useState<DropdownEntry[]>([]);
  const [collector] = React.useState<Collector>(() => {
    const c: Collector = {
      container: typeof document === 'undefined' ? null : document.createElement('div'),
      records: new Map(),
      rebuild: () => {
        if (!c.container) return;
        const next = readEntries(c.container, c.records);
        setEntries((prev) => (sameEntries(prev, next) ? prev : next));
      },
      schedule: () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => { scheduled = false; c.rebuild(); });
      },
    };
    let scheduled = false;
    return c;
  });

  return (
    <CollectorContext.Provider value={collector}>
      <DropdownRoot
        entries={entries}
        // Radix: "" and undefined both mean "nothing chosen yet".
        value={value === undefined ? undefined : value === '' ? null : value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        disabled={disabled}
        name={name}
        required={required}
        form={form}
      >
        {children}
      </DropdownRoot>
    </CollectorContext.Provider>
  );
}

/** Registers one part of the list and renders its marker in the detached copy (nothing anywhere else). */
function usePart(record: ItemRecord | { label: React.ReactNode } | null) {
  const collector = React.useContext(CollectorContext);
  const collecting = React.useContext(CollectingContext);
  const key = React.useId();
  React.useLayoutEffect(() => {
    if (!collector || !collecting) return;
    if (record) collector.records.set(key, record);
    collector.schedule();
  });
  React.useLayoutEffect(() => () => {
    if (!collector || !collecting) return;
    collector.records.delete(key);
    collector.schedule();
  }, [collector, collecting, key]);
  return { key, collecting: !!collector && collecting };
}

const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children }, _ref) => {
  const { key, collecting } = usePart(null);
  return collecting ? <div data-dd-part="group" data-dd-key={key}>{children}</div> : null;
});
SelectGroup.displayName = 'SelectGroup';

const SelectValue = React.forwardRef<HTMLSpanElement, { placeholder?: React.ReactNode; className?: string; children?: React.ReactNode }>(
  ({ placeholder, className, children }, _ref) => <DropdownValue placeholder={placeholder} className={className}>{children}</DropdownValue>,
);
SelectValue.displayName = 'SelectValue';

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(({ className, children, asChild: _asChild, ...props }, ref) => (
  <DropdownTrigger ref={ref} className={cn(TRIGGER_BASE, 'w-full bg-transparent data-[placeholder]:text-muted-foreground', className)} {...props}>
    {children}
  </DropdownTrigger>
));
SelectTrigger.displayName = 'SelectTrigger';

/** Kept for imports: the engine's list scrolls on its own. */
const SelectScrollUpButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(() => null);
SelectScrollUpButton.displayName = 'SelectScrollUpButton';
const SelectScrollDownButton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(() => null);
SelectScrollDownButton.displayName = 'SelectScrollDownButton';

type SelectContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Accepted for the Radix API; the list always opens below the trigger (or above when there is no room). */
  position?: 'popper' | 'item-aligned';
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
};

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(({ className, children, side, align, sideOffset }, _ref) => {
  const collector = React.useContext(CollectorContext);
  // Runs after every item's own layout effect (children first), so the chosen label is there on first paint.
  React.useLayoutEffect(() => { collector?.rebuild(); });
  return (
    <>
      {collector?.container && createPortal(
        <CollectingContext.Provider value>{children}</CollectingContext.Provider>,
        collector.container,
      )}
      <DropdownPanel className={className} side={side} align={align} sideOffset={sideOffset} />
    </>
  );
});
SelectContent.displayName = 'SelectContent';

const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children }, _ref) => {
  const { key, collecting } = usePart({ label: children });
  return collecting ? <div data-dd-part="label" data-dd-key={key}>{children}</div> : null;
});
SelectLabel.displayName = 'SelectLabel';

type SelectItemProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  value: string;
  disabled?: boolean;
  textValue?: string;
  children?: React.ReactNode;
};

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(({ value, disabled, textValue, className, children }, _ref) => {
  const { key, collecting } = usePart({ value, disabled, textValue, className, children });
  return collecting ? <div data-dd-part="item" data-dd-key={key}>{children}</div> : null;
});
SelectItem.displayName = 'SelectItem';

const SelectSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((_props, _ref) => {
  const { key, collecting } = usePart(null);
  return collecting ? <div data-dd-part="separator" data-dd-key={key} /> : null;
});
SelectSeparator.displayName = 'SelectSeparator';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};

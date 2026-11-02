/**
 * Drop-in for a native <select>: same props and the same <option> / <optgroup> children, drawn by
 * the app's dropdown engine (searchable from 6 options). Converting a call site is
 * `<select` → `<NativeSelect`, `</select>` → `</NativeSelect>`; classes, ids and handlers stay.
 *
 * `onChange` gets an event whose `target` / `currentTarget` carry `value`, `name`, `id`,
 * `selectedIndex`, `options` and `dataset`, so `e.target.value` handlers work unchanged;
 * `onValueChange(value)` is there for new code. Not supported: `multiple` and `size`.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { DropdownRoot, DropdownTrigger, DropdownValue, TRIGGER_BASE, normalizeDisplay } from './dropdown/Dropdown';
import { DropdownPanel } from './dropdown/DropdownPanel';
import type { DropdownEntry, DropdownOption } from './dropdown/logic';

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue' | 'onChange' | 'multiple' | 'size' | 'placeholder'> {
  value?: string | number | null;
  defaultValue?: string | number;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  /** The new value, for code that does not want an event. Method syntax: a narrower handler still fits. */
  onValueChange?(value: string): void;
  /** Shown when no option matches the value (a native select has none). */
  placeholder?: React.ReactNode;
  /** Force the search box on or off (default: from 6 options). */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Classes for the open list (width, max height). */
  contentClassName?: string;
}

/** Plain text of option children: strings, numbers, arrays and elements' children; whitespace collapsed as in option.text. */
function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return '';
}
const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

type OptionProps = React.OptionHTMLAttributes<HTMLOptionElement>;
type GroupProps = React.OptgroupHTMLAttributes<HTMLOptGroupElement>;

/** <option>, <optgroup>, <hr>, fragments and arrays → engine entries, in order. */
export function entriesFromChildren(children: React.ReactNode): DropdownEntry[] {
  const out: DropdownEntry[] = [];
  let n = 0;
  const walk = (nodes: React.ReactNode, group?: { key: string; disabled?: boolean }) => {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === React.Fragment) {
        walk((child.props as { children?: React.ReactNode }).children, group);
      } else if (child.type === 'option') {
        const p = child.props as OptionProps;
        const text = clean(p.label ?? textOf(p.children));
        n += 1;
        out.push({
          kind: 'option', key: `o${n}`, value: p.value === undefined ? text : String(p.value), label: text || ' ', text,
          disabled: !!(p.disabled || group?.disabled), hidden: !!p.hidden, group: group?.key, className: p.className,
        });
      } else if (child.type === 'optgroup') {
        const p = child.props as GroupProps;
        n += 1;
        const key = `g${n}`;
        const text = clean(p.label ?? '');
        out.push({ kind: 'group', key, label: text, text });
        walk(p.children, { key, disabled: p.disabled });
      } else if (child.type === 'hr') {
        n += 1;
        out.push({ kind: 'separator', key: `s${n}` });
      }
    });
  };
  walk(children);
  return out;
}

const datasetOf = (props: Record<string, unknown>) => {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('data-') && v !== undefined && v !== null) {
      data[k.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = String(v);
    }
  }
  return data;
};

/** What a native change event's target would say after choosing `value`. */
function changeEvent(value: string, options: DropdownOption[], name: string | undefined, id: string | undefined, dataset: Record<string, string>) {
  const opts = options.map((o, index) => ({ value: o.value, text: o.text, label: o.text, disabled: !!o.disabled, selected: o.value === value, index }));
  const target = {
    value, name: name ?? '', id: id ?? '', type: 'select-one', dataset,
    selectedIndex: opts.findIndex((o) => o.selected), options: opts, selectedOptions: opts.filter((o) => o.selected),
  };
  let prevented = false;
  let stopped = false;
  return {
    target, currentTarget: target, type: 'change', bubbles: true, cancelable: false, eventPhase: 2, isTrusted: false,
    timeStamp: Date.now(), nativeEvent: new Event('change', { bubbles: true }),
    get defaultPrevented() { return prevented; },
    preventDefault() { prevented = true; }, isDefaultPrevented: () => prevented,
    stopPropagation() { stopped = true; }, isPropagationStopped: () => stopped, persist() {},
  } as unknown as React.ChangeEvent<HTMLSelectElement>;
}

/** The few longest labels, drawn invisibly so the trigger is as wide as its widest option (as a native select is). */
function sizerTexts(entries: DropdownEntry[], placeholder: React.ReactNode): string[] {
  const texts = entries.flatMap((e) => (e.kind === 'option' && !e.hidden ? [e.text] : []));
  if (typeof placeholder === 'string') texts.push(placeholder);
  return [...new Set(texts)].sort((a, b) => b.length - a.length).slice(0, 3);
}

export const NativeSelect = React.forwardRef<HTMLButtonElement, NativeSelectProps>(({
  children, value, defaultValue, onChange, onValueChange, placeholder, searchable, searchPlaceholder, emptyText, contentClassName,
  className, disabled, name, required, form, id, autoComplete: _autoComplete, ...rest
}, ref) => {
  const entries = React.useMemo(() => entriesFromChildren(children), [children]);
  const options = entries.filter((e): e is DropdownOption => e.kind === 'option');
  const sizers = React.useMemo(() => sizerTexts(entries, placeholder), [entries, placeholder]);
  const dataset = datasetOf(rest as Record<string, unknown>);

  return (
    <DropdownRoot
      entries={entries}
      value={value === undefined ? undefined : value === null ? null : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      selectFirst={placeholder === undefined}
      onValueChange={(next) => {
        onChange?.(changeEvent(next, options, name, id, dataset));
        onValueChange?.(next);
      }}
      disabled={disabled}
      name={name}
      required={required}
      form={form}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
    >
      <DropdownTrigger
        ref={ref}
        id={id}
        className={cn(TRIGGER_BASE, 'inline-flex bg-background', normalizeDisplay(className))}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        <span className="grid min-w-0 flex-1">
          {sizers.map((text) => (
            <span key={text} aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 truncate">{text}</span>
          ))}
          <DropdownValue placeholder={placeholder} className="col-start-1 row-start-1" />
        </span>
      </DropdownTrigger>
      <DropdownPanel className={contentClassName} />
    </DropdownRoot>
  );
});
NativeSelect.displayName = 'NativeSelect';

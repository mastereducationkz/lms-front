/**
 * Driving the app's dropdowns (Select, NativeSelect, SearchableSelect) from jsdom tests.
 *
 *   import { openDropdown, pickOption, optionLabels, typeInDropdown } from '@/test/dropdown';
 *   await pickOption('#ow-pipeline', 'SAT');            // by label (exact, then "contains")
 *   await pickValue('#ow-pipeline', '10736538');        // by value
 *   expect(await optionLabels('#ow-pipeline')).toEqual(['Choose the pipeline', 'SAT']);
 *   expect(dropdownValue('#ow-pipeline')).toBe('');      // what `select.value` used to say
 *
 * A trigger is the element, or a selector looked up in `document`. Every call runs inside React's
 * `act`. Importing this module also installs the few browser APIs Radix needs that jsdom lacks.
 */
import { act } from 'react';

type Target = Element | string | null | undefined;

const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean; ResizeObserver?: unknown };
g.IS_REACT_ACT_ENVIRONMENT = true;
if (typeof window !== 'undefined') {
  g.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia ??= ((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  Element.prototype.scrollIntoView ??= () => {};
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
}

/** Radix hands focus back to the trigger on a timer after the list closes. */
const afterClose = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });

/** The trigger button (role="combobox") behind an element or selector. */
export function dropdownTrigger(target: Target): HTMLButtonElement {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) throw new Error(`dropdown: no element for ${String(target)}`);
  const trigger = el.matches('button[role="combobox"]') ? el : el.querySelector('button[role="combobox"]');
  if (!trigger) throw new Error(`dropdown: ${String(target)} is not a dropdown trigger`);
  return trigger as HTMLButtonElement;
}

/** The open listbox of a trigger, or null when it is closed. */
export function dropdownList(target: Target): HTMLElement | null {
  const id = dropdownTrigger(target).getAttribute('aria-controls');
  return id ? document.getElementById(id) : null;
}

/** The chosen value ("" when nothing is chosen), as `select.value` used to tell. */
export function dropdownValue(target: Target): string {
  return dropdownTrigger(target).getAttribute('data-dd-value') ?? '';
}

/** The text the closed trigger shows (label or placeholder). */
export function dropdownText(target: Target): string {
  const trigger = dropdownTrigger(target);
  return (trigger.querySelector('[data-dd-text]') ?? trigger).textContent?.trim() ?? '';
}

/** Opens the list (from the keyboard, as a person would) and returns the listbox. */
export async function openDropdown(target: Target): Promise<HTMLElement> {
  const trigger = dropdownTrigger(target);
  if (trigger.disabled) throw new Error('dropdown: the trigger is disabled');
  if (!dropdownList(trigger)) {
    await act(async () => {
      trigger.focus();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
  }
  const list = dropdownList(trigger);
  if (!list) throw new Error('dropdown: the list did not open');
  return list;
}

/** Closes the list with Escape (no change). */
export async function closeDropdown(target: Target): Promise<void> {
  const list = dropdownList(target);
  if (!list) return;
  await act(async () => {
    (document.activeElement ?? list).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });
  await afterClose();
}

const labelOf = (row: Element) => (row.querySelector('[data-dd-label]')?.textContent ?? row.textContent ?? '').trim();

/** The rows the open list shows. */
export function optionRows(target: Target): HTMLElement[] {
  const list = dropdownList(target);
  return list ? Array.from(list.querySelectorAll<HTMLElement>('[role="option"]')) : [];
}

/** Labels of every listed option (disabled ones included, hidden ones never), in order. Leaves the list as it found it. */
export async function optionLabels(target: Target): Promise<string[]> {
  const wasOpen = !!dropdownList(target);
  await openDropdown(target);
  const labels = optionRows(target).map(labelOf);
  if (!wasOpen) await closeDropdown(target);
  return labels;
}

/** Types into the search box of the open list (opens it first). */
export async function typeInDropdown(target: Target, text: string): Promise<void> {
  const list = await openDropdown(target);
  const input = document.querySelector<HTMLInputElement>(`input[aria-controls="${list.id}"]`);
  if (!input) throw new Error('dropdown: this list has no search box (it shows from 6 options)');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function clickRow(target: Target, find: (rows: HTMLElement[]) => HTMLElement | undefined, what: string) {
  await openDropdown(target);
  const rows = optionRows(target);
  const row = find(rows);
  if (!row) throw new Error(`dropdown: no option ${what}; shown: ${rows.map(labelOf).join(' | ')}`);
  await act(async () => { row.click(); });
  await afterClose();
}

/** Opens the list and clicks the option with this label (an exact match first, else the first that contains it). */
export async function pickOption(target: Target, label: string | RegExp): Promise<void> {
  await clickRow(target, (rows) => (typeof label === 'string'
    ? rows.find((r) => labelOf(r) === label) ?? rows.find((r) => labelOf(r).includes(label))
    : rows.find((r) => label.test(labelOf(r)))), String(label));
}

/** Opens the list and clicks the option with this value. */
export async function pickValue(target: Target, value: string | number): Promise<void> {
  await clickRow(target, (rows) => rows.find((r) => r.getAttribute('data-value') === String(value)), `with value ${value}`);
}

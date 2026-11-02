// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});
import {
  closeDropdown, dropdownList, dropdownText, dropdownTrigger, dropdownValue, openDropdown, optionLabels, optionRows,
  pickOption, pickValue, typeInDropdown,
} from '@/test/dropdown';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '../select';
import { NativeSelect } from '../native-select';
import { SearchableSelect } from '../searchable-select';
import { Dialog, DialogContent, DialogTitle } from '../dialog';

let root: Root | null = null;
let host: HTMLDivElement;
async function show(ui: ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
  await act(async () => { await Promise.resolve(); }); // let Select's items register
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});
const key = (el: Element, k: string) => act(async () => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
});

function Fruits({ onValueChange = () => {}, value, defaultValue }: { onValueChange?: (v: string) => void; value?: string; defaultValue?: string }) {
  return (
    <>
      <label htmlFor="fruit">Fruit</label>
      <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <SelectTrigger id="fruit" className="w-40"><SelectValue placeholder="Pick a fruit" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="pear" disabled>Pear</SelectItem>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Berries</SelectLabel>
            {['Cherry', 'Grape'].map((f) => <SelectItem key={f} value={f.toLowerCase()}><span>{f}</span></SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

describe('Select (shadcn API on the engine)', () => {
  it('shows the chosen label while closed, the placeholder for "" and keeps call-site classes and id', async () => {
    await show(<Fruits value="grape" />);
    const trigger = dropdownTrigger('#fruit');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
    expect(trigger.className).toContain('w-40');
    expect(trigger.className).not.toContain('w-full');
    expect(dropdownText(trigger)).toBe('Grape');
    expect(dropdownList(trigger)).toBeNull();
    await act(async () => { root!.render(<Fruits value="" />); });
    expect(dropdownText(trigger)).toBe('Pick a fruit');
    await act(async () => { root!.render(<Fruits value="nope" />); });
    expect(dropdownText(trigger)).toBe('Pick a fruit');
  });

  it('lists items with group headers, no search box under 6 options, and picks once', async () => {
    const onChange = vi.fn();
    await show(<Fruits value="apple" onValueChange={onChange} />);
    const list = await openDropdown('#fruit');
    expect(list.getAttribute('role')).toBe('listbox');
    expect(dropdownTrigger('#fruit').getAttribute('aria-expanded')).toBe('true');
    expect(dropdownTrigger('#fruit').getAttribute('aria-controls')).toBe(list.id);
    expect(optionRows('#fruit').map((r) => r.textContent)).toEqual(['Apple', 'Pear', 'Cherry', 'Grape']);
    expect(list.querySelector('[role="group"]')?.textContent).toContain('Berries');
    expect(document.querySelector(`input[aria-controls="${list.id}"]`)).toBeNull();
    expect(optionRows('#fruit')[0].getAttribute('aria-selected')).toBe('true');
    expect(optionRows('#fruit')[1].getAttribute('aria-disabled')).toBe('true');
    await pickOption('#fruit', 'Pear'); // disabled: nothing happens
    expect(onChange).not.toHaveBeenCalled();
    await pickOption('#fruit', 'Apple'); // the current value: closes, no change
    expect(onChange).not.toHaveBeenCalled();
    expect(dropdownList('#fruit')).toBeNull();
    await pickOption('#fruit', 'Cherry');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  it('uncontrolled: defaultValue, then the pick sticks', async () => {
    await show(<Fruits defaultValue="cherry" />);
    expect(dropdownText('#fruit')).toBe('Cherry');
    await pickValue('#fruit', 'grape');
    expect(dropdownText('#fruit')).toBe('Grape');
    expect(dropdownValue('#fruit')).toBe('grape');
  });

  it('keyboard: opens on the chosen row, arrows skip disabled rows, Enter picks, Escape returns focus', async () => {
    const onChange = vi.fn();
    await show(<Fruits value="apple" onValueChange={onChange} />);
    const trigger = dropdownTrigger('#fruit');
    const list = await openDropdown(trigger);
    expect(document.activeElement).toBe(list);
    const active = () => list.querySelector('[data-active]')?.textContent;
    expect(active()).toBe('Apple');
    await key(list, 'ArrowDown');
    expect(active()).toBe('Cherry');
    expect(list.getAttribute('aria-activedescendant')).toBe(list.querySelector('[data-active]')?.id);
    await key(list, 'End');
    expect(active()).toBe('Grape');
    await key(list, 'Home');
    expect(active()).toBe('Apple');
    await key(list, 'g'); // type-ahead
    expect(active()).toBe('Grape');
    await closeDropdown(trigger);
    expect(dropdownList(trigger)).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await openDropdown(trigger);
    await key(dropdownList(trigger)!, 'ArrowDown');
    await key(dropdownList(trigger)!, 'Enter');
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  it('typing a letter on the closed trigger opens on the matching row', async () => {
    await show(<Fruits value="apple" />);
    const trigger = dropdownTrigger('#fruit');
    trigger.focus();
    await key(trigger, 'c');
    expect(dropdownList(trigger)?.querySelector('[data-active]')?.textContent).toBe('Cherry');
  });

  it('a name renders a hidden form control that carries the value', async () => {
    await show(<form><Select name="fruit" defaultValue="apple"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="apple">Apple</SelectItem></SelectContent></Select></form>);
    const form = host.querySelector('form')!;
    expect(new FormData(form).get('fruit')).toBe('apple');
  });
});

describe('NativeSelect (drop-in for <select>)', () => {
  function Native({ initial = '', onChange }: { initial?: string; onChange?: (v: string, name: string) => void }) {
    const [value, setValue] = useState(initial);
    const groups = { Math: ['Algebra', 'Geometry', 'Calculus'], English: ['Reading'] };
    return (
      <NativeSelect
        id="subject" name="subject" className="mt-1 block w-full" value={value} data-kind="subject" title="Subject"
        onChange={(e) => { setValue(e.target.value); onChange?.(e.target.value, e.target.name); }}
      >
        <option value="">All subjects</option>
        <>
          {Object.entries(groups).map(([label, items]) => (
            <optgroup key={label} label={label}>
              {items.map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}
            </optgroup>
          ))}
        </>
        <option value="x" disabled>Closed</option>
        <option value="h" hidden>Hidden</option>
      </NativeSelect>
    );
  }

  it('keeps id, classes (block → flex), title and data-*, shows the "" option label, lists groups', async () => {
    await show(<Native />);
    const trigger = dropdownTrigger('#subject');
    expect(trigger.className).toContain('w-full');
    expect(trigger.className).toContain('mt-1');
    expect(trigger.className.split(' ')).not.toContain('block');
    expect(trigger.getAttribute('title')).toBe('Subject');
    expect(trigger.getAttribute('data-kind')).toBe('subject');
    expect(dropdownText(trigger)).toBe('All subjects');
    expect(await optionLabels(trigger)).toEqual(['All subjects', 'Algebra', 'Geometry', 'Calculus', 'Reading', 'Closed']);
    expect(dropdownList(trigger)).toBeNull();
  });

  it('onChange gets e.target.value and e.target.name; a search box shows from 6 options', async () => {
    const onChange = vi.fn();
    await show(<Native onChange={onChange} />);
    await typeInDropdown('#subject', 'math geo');
    expect(optionRows('#subject').map((r) => r.textContent)).toEqual(['Geometry']);
    await key(document.activeElement!, 'Enter');
    expect(onChange).toHaveBeenCalledWith('geometry', 'subject');
    expect(dropdownText('#subject')).toBe('Geometry');
    expect((host.querySelector('select[name="subject"]') as HTMLSelectElement).value).toBe('geometry');
  });

  it('search folds Kazakh letters and says when nothing matches', async () => {
    await show(
      <NativeSelect id="who" defaultValue="1">
        {['Әсем', 'Қайрат', 'Ұлан', 'Іңкәр', 'Ғалым', 'Өмір'].map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </NativeSelect>,
    );
    await typeInDropdown('#who', 'кайрат');
    expect(optionRows('#who').map((r) => r.textContent)).toEqual(['Қайрат']);
    await typeInDropdown('#who', 'zzz');
    expect(optionRows('#who')).toHaveLength(0);
    expect(dropdownList('#who')?.textContent).toContain('Nothing matches');
  });

  it('uncontrolled without a default starts on the first pickable option, as a native select does', async () => {
    await show(<NativeSelect id="n"><option value="a" disabled>A</option><option value="b">B</option></NativeSelect>);
    expect(dropdownValue('#n')).toBe('b');
  });

  it('a disabled placeholder option shows muted when the value is ""', async () => {
    await show(<NativeSelect id="p" value="" onChange={() => {}}><option value="" disabled>Choose…</option><option value="a">A</option></NativeSelect>);
    const label = dropdownTrigger('#p').querySelector('.text-muted-foreground');
    expect(label?.textContent).toBe('Choose…');
  });

  it('caps a long list at 300 rows and says so', async () => {
    await show(<NativeSelect id="long">{Array.from({ length: 320 }, (_, i) => <option key={i} value={i}>Student {i}</option>)}</NativeSelect>);
    await openDropdown('#long');
    expect(optionRows('#long')).toHaveLength(300);
    expect(document.body.textContent).toContain('Showing the first 300');
    await closeDropdown('#long');
  });

  it('a disabled select does not open', async () => {
    await show(<NativeSelect id="d" disabled><option>A</option></NativeSelect>);
    expect(dropdownTrigger('#d').disabled).toBe(true);
    await expect(openDropdown('#d')).rejects.toThrow('disabled');
  });
});

describe('focus on open: the search box only under a mouse', () => {
  const pointer = (fine: boolean) => vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === '(pointer: fine)' ? fine : !fine, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }) as MediaQueryList);
  const list = () => <NativeSelect id="many">{['a', 'b', 'c', 'd', 'e', 'f'].map((v) => <option key={v} value={v}>{v.toUpperCase()}</option>)}</NativeSelect>;
  afterEach(() => { vi.restoreAllMocks(); });

  it('a fine pointer (mouse, trackpad): the search box takes focus', async () => {
    pointer(true);
    await show(list());
    const listbox = await openDropdown('#many');
    expect(document.activeElement).toBe(document.querySelector(`input[aria-controls="${listbox.id}"]`));
  });

  it('a touch screen: the list takes focus, no phone keyboard; arrows work and typing reaches the search box', async () => {
    pointer(false);
    await show(list());
    const listbox = await openDropdown('#many');
    const input = document.querySelector<HTMLInputElement>(`input[aria-controls="${listbox.id}"]`)!;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(listbox);
    await key(listbox, 'ArrowDown');
    expect(listbox.querySelector('[data-active]')?.textContent).toBe('B');
    expect(listbox.getAttribute('aria-activedescendant')).toBe(listbox.querySelector('[data-active]')?.id);
    await key(listbox, 'e');
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('e');
    expect(optionRows('#many').map((r) => r.textContent)).toEqual(['E']);
  });
});

describe('SearchableSelect (its API on the engine)', () => {
  const people = ['Aidana', 'Bolat', 'Dana', 'Erlan', 'Gulzada', 'Madi', 'Nurlan'].map((name, i) => ({ value: String(i), label: name, hint: i === 4 ? 'teacher' : undefined }));

  it('searches labels and hints and picks', async () => {
    const onChange = vi.fn();
    await show(<SearchableSelect id="person" options={people} value={null} onChange={onChange} placeholder="Who?" />);
    expect(dropdownText('#person')).toBe('Who?');
    await typeInDropdown('#person', 'teach');
    expect(optionRows('#person').map((r) => r.getAttribute('data-value'))).toEqual(['4']);
    await pickOption('#person', 'Gulzada');
    expect(onChange).toHaveBeenCalledWith('4');
  });

  it('opens and scrolls inside a Dialog, picks, and the Dialog stays open', async () => {
    const onChange = vi.fn();
    await show(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Pick</DialogTitle>
          <SearchableSelect id="in-dialog" options={people} value="1" onChange={onChange} />
        </DialogContent>
      </Dialog>,
    );
    await pickOption('#in-dialog', 'Madi');
    expect(onChange).toHaveBeenCalledWith('5');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });
});

// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});
import { dropdownTrigger } from '@/test/dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { NativeSelect } from '../native-select';
import { SearchableSelect } from '../searchable-select';
import { TRIGGER_BASE } from './Dropdown';

// The trigger's width rule (DROPDOWN_SPEC «Look»): a flex row may shrink it, but not below
// min(its container, 6rem); a long label truncates at the container instead of overflowing it.
const FLOOR = 'min-w-[min(100%,6rem)]';
const CAP = 'max-w-full';

let root: Root | null = null;
async function show(ui: ReactNode) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(ui); });
  await act(async () => { await Promise.resolve(); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});
const classes = (selector: string) => dropdownTrigger(selector).className.split(/\s+/);

function Three({ className }: { className?: string }) {
  return (
    <>
      <Select value="a">
        <SelectTrigger id="s" className={className}><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="a">Alpha</SelectItem></SelectContent>
      </Select>
      <NativeSelect id="n" className={className} value="a" onChange={() => {}}><option value="a">Alpha</option></NativeSelect>
      <SearchableSelect id="q" className={className} options={[{ value: 'a', label: 'Alpha' }]} value="a" onChange={() => {}} />
    </>
  );
}
const ALL = ['#s', '#n', '#q'];

describe('dropdown trigger width', () => {
  it('the shared base has the 6rem-or-container floor and the container cap, not a bare min-w-0', () => {
    const base = TRIGGER_BASE.split(' ');
    expect(base).toContain(FLOOR);
    expect(base).toContain(CAP);
    expect(base).not.toContain('min-w-0');
  });

  it('Select, NativeSelect and SearchableSelect triggers all carry the floor and the cap', async () => {
    await show(<Three />);
    for (const id of ALL) {
      expect(classes(id)).toContain(FLOOR);
      expect(classes(id)).toContain(CAP);
      expect(classes(id)).not.toContain('min-w-0');
    }
  });

  it('a call site can opt out with min-w-0 or set its own min/max width (one min-w, one max-w survive)', async () => {
    await show(<Three className="min-w-0" />);
    for (const id of ALL) {
      expect(classes(id)).toContain('min-w-0');
      expect(classes(id)).not.toContain(FLOOR);
    }
    await act(async () => { root!.render(<Three className="min-w-[14rem] max-w-[22rem]" />); });
    for (const id of ALL) {
      const cls = classes(id);
      expect(cls).toContain('min-w-[14rem]');
      expect(cls).toContain('max-w-[22rem]');
      expect(cls.filter((c) => c.startsWith('min-w-'))).toEqual(['min-w-[14rem]']);
      expect(cls.filter((c) => c.startsWith('max-w-'))).toEqual(['max-w-[22rem]']);
    }
  });

  it('responsive widths from the call site stay next to the base floor (e.g. /admin/events filters)', async () => {
    await show(<Three className="w-full lg:w-48 lg:shrink-0 sm:max-w-xs" />);
    for (const id of ALL) {
      const cls = classes(id);
      expect(cls).toEqual(expect.arrayContaining(['w-full', 'lg:w-48', 'lg:shrink-0', 'sm:max-w-xs', FLOOR, CAP]));
    }
  });
});

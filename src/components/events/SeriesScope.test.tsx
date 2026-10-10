// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { SeriesDeleteDialog, SeriesRow, SeriesScopePicker } from './SeriesScope';
import type { Event } from '../../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has none of these; the Radix dialog asks for them.
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
Element.prototype.scrollIntoView ??= () => {};

let root: Root | null = null;
let host: HTMLDivElement;
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const radios = () => Array.from(document.body.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
const labelOf = (input: HTMLInputElement) => input.closest('label')?.textContent ?? '';

describe('SeriesScopePicker', () => {
  it('offers this event or this and every following one', async () => {
    await show(<SeriesScopePicker value="this" onChange={() => {}} following={4} />);
    expect(radios().map(labelOf)).toEqual(['Only this event', 'This and all 3 following events']);
    expect(radios().map((r) => r.checked)).toEqual([true, false]);
  });

  it('reports the choice', async () => {
    const onChange = vi.fn();
    await show(<SeriesScopePicker value="this" onChange={onChange} following={4} />);
    await act(async () => { radios()[1].click(); });
    expect(onChange).toHaveBeenCalledWith('following');
  });

  it('is not shown when this is the last occurrence: nothing follows', async () => {
    await show(<SeriesScopePicker value="this" onChange={() => {}} following={1} />);
    expect(radios()).toHaveLength(0);
  });
});

describe('SeriesDeleteDialog', () => {
  it('cancels only this event unless told otherwise', async () => {
    const onConfirm = vi.fn();
    await show(<SeriesDeleteDialog title="NUET Math Office Hours — Akzhol" following={3} onConfirm={onConfirm} onClose={() => {}} />);
    expect(document.body.textContent).toContain('NUET Math Office Hours — Akzhol');
    const confirm = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Cancel events')!;
    await act(async () => { confirm.click(); });
    expect(onConfirm).toHaveBeenCalledWith('this');
  });

  it('can cancel this and all following', async () => {
    const onConfirm = vi.fn();
    await show(<SeriesDeleteDialog title="X" following={3} onConfirm={onConfirm} onClose={() => {}} />);
    await act(async () => { radios()[1].click(); });
    const confirm = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent === 'Cancel events')!;
    await act(async () => { confirm.click(); });
    expect(onConfirm).toHaveBeenCalledWith('following');
  });
});

describe('SeriesRow', () => {
  const next = { id: 3, title: 'NUET Math Office Hours — Akzhol', start_datetime: '2026-10-17T09:00:00Z' } as Event;

  it('shows the series in one line and opens the weeks on a click', async () => {
    await show(<SeriesRow title={next.title} total={50} upcoming={49} next={next} onEditNext={() => {}} onCancelUpcoming={() => {}}><div id="weeks">weeks</div></SeriesRow>);
    expect(host.textContent).toContain('NUET Math Office Hours — Akzhol');
    expect(host.textContent).toContain('49 upcoming');
    expect(host.textContent).toContain('50 in all');
    expect(host.querySelector('#weeks')).toBeNull();
    await act(async () => { (host.querySelector('[aria-expanded]') as HTMLElement).click(); });
    expect(host.querySelector('#weeks')).not.toBeNull();
  });

  it('edits the next occurrence and cancels the upcoming ones', async () => {
    const onEditNext = vi.fn(); const onCancelUpcoming = vi.fn();
    await show(<SeriesRow title={next.title} total={5} upcoming={4} next={next} onEditNext={onEditNext} onCancelUpcoming={onCancelUpcoming}><span /></SeriesRow>);
    const button = (name: string) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;
    await act(async () => { button('Edit next').click(); });
    await act(async () => { button('Cancel upcoming').click(); });
    expect(onEditNext).toHaveBeenCalledTimes(1);
    expect(onCancelUpcoming).toHaveBeenCalledTimes(1);
  });
});

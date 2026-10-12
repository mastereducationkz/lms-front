// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'head_teacher' } }) };
});

import { DateTimePicker } from './date-time-picker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

/**
 * LMS-FRONT-E: clearing the time box made the picker hand its caller an Invalid Date, and the
 * homework builder's `date.toISOString()` threw «RangeError: Invalid time value».
 */
let root: Root | null = null;
let host: HTMLDivElement | null = null;

async function mount(date: Date | undefined, setDate: (d: Date | undefined) => void) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<DateTimePicker date={date} setDate={setDate} />); });
  return host.querySelector('input[type="time"]') as HTMLInputElement;
}

async function typeInto(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  host?.remove();
  root = null;
  host = null;
});

describe('DateTimePicker time box', () => {
  it('a valid time moves the date to that time on the same day', async () => {
    const setDate = vi.fn();
    const input = await mount(new Date(2026, 9, 12, 9, 0), setDate);

    await typeInto(input, '14:30');

    expect(setDate).toHaveBeenCalledTimes(1);
    const next = setDate.mock.calls[0][0] as Date;
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([12, 14, 30]);
  });

  it('a cleared time box tells the caller nothing, and never an Invalid Date', async () => {
    const setDate = vi.fn();
    const input = await mount(new Date(2026, 9, 12, 9, 0), setDate);

    await typeInto(input, '');

    expect(setDate).not.toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  it('whatever it does hand over can be turned into ISO text', async () => {
    const handed: Array<Date | undefined> = [];
    const input = await mount(new Date(2026, 9, 12, 9, 0), (d) => handed.push(d));

    await typeInto(input, '');
    await typeInto(input, '16:05');

    expect(handed.length).toBe(1);
    expect(() => handed.forEach((d) => d?.toISOString())).not.toThrow();
  });

  it('an Invalid Date from the caller shows as no date instead of crashing the render', async () => {
    const input = await mount(new Date('not a date'), vi.fn());

    expect(input.value).toBe('00:00');
  });
});

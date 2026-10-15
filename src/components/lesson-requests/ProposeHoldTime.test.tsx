// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The teacher proposes the new time of their lesson on hold (owner, 2026-10-15). Nothing moves until a head
// confirms; this only sends the proposal, refuses a past time before it is sent, and shows what the server says.
vi.mock('../../services/api', () => ({ proposeHoldTime: vi.fn(async () => ({})) }));
vi.mock('../Toast', () => ({ toast: vi.fn() }));
// useT reads the signed-in user's language from AuthContext; a signed-out context is enough here.
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined) };
});

import { proposeHoldTime } from '../../services/api';
import { setActiveLocale } from '../../lib/i18n/locale';
import ProposeHoldTime from './ProposeHoldTime';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  setActiveLocale('en');
  vi.mocked(proposeHoldTime).mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const hold = (over: Record<string, unknown> = {}) => ({ id: 31, request_type: 'hold', status: 'approved', hold_state: 'waiting', ...over }) as any;
const text = () => container.textContent ?? '';
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)!;

function typeTime(value: string) {
  const input = container.querySelector('input[type="datetime-local"]') as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('proposing a time for a lesson on hold', () => {
  it('sends the time as school time and refreshes the list', async () => {
    const changed = vi.fn();
    act(() => root.render(<ProposeHoldTime req={hold()} onChanged={changed} />));
    act(() => button('Propose a time').click());
    typeTime('2099-10-24T19:00');
    await act(async () => button('Send').click());

    expect(proposeHoldTime).toHaveBeenCalledWith(31, '2099-10-24T14:00:00.000Z'); // 19:00 in Almaty is 14:00 UTC
    expect(changed).toHaveBeenCalledOnce();
  });

  it('refuses a past time before anything is sent', async () => {
    act(() => root.render(<ProposeHoldTime req={hold()} onChanged={vi.fn()} />));
    act(() => button('Propose a time').click());
    typeTime('2020-01-01T10:00');
    await act(async () => button('Send').click());

    expect(proposeHoldTime).not.toHaveBeenCalled();
    expect(text()).toContain('The new time must be in the future.');
  });

  it('says what is already proposed, and offers to change it', () => {
    act(() => root.render(<ProposeHoldTime req={hold({ hold_proposed_datetime: '2099-10-24T14:00:00Z' })} onChanged={vi.fn()} />));

    expect(text()).toContain('waiting for the head teacher to confirm');
    expect(button('Change the proposal')).toBeTruthy();
  });

  it("shows the server's own words when it refuses (a clash with another lesson, say)", async () => {
    vi.mocked(proposeHoldTime).mockRejectedValueOnce({ response: { data: { detail: 'The group already has a lesson at that time.' } } });
    act(() => root.render(<ProposeHoldTime req={hold()} onChanged={vi.fn()} />));
    act(() => button('Propose a time').click());
    typeTime('2099-10-24T19:00');
    await act(async () => button('Send').click());

    expect(text()).toContain('The group already has a lesson at that time.');
  });
});

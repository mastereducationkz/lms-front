// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { ClassPicker } from './ClassPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const future = (id: number) => ({ id, title: `Lesson ${id}`, scheduled_at: '2099-01-01T10:00:00Z', lesson_number: id, is_past: false });
const props = { value: '', onChange: () => {}, onRetry: () => {}, format: (e: { title: string }) => e.title };

describe('ClassPicker', () => {
  it('says the classes are loading', async () => {
    await show(<ClassPicker {...props} state={{ status: 'loading' }} />);
    expect(host.textContent).toContain('Loading classes');
  });

  it('a failed load is spelled out and can be retried', async () => {
    const onRetry = vi.fn();
    await show(<ClassPicker {...props} onRetry={onRetry} state={{ status: 'error', forbidden: false }} />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load");
    const retry = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Try again')!;
    await act(async () => { retry.click(); });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('a refusal says so and offers no pointless retry', async () => {
    await show(<ClassPicker {...props} state={{ status: 'error', forbidden: true }} />);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("don't have access");
    expect(Array.from(host.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(false);
  });

  it('a group with nothing upcoming is told so, with what to do', async () => {
    await show(<ClassPicker {...props} state={{ status: 'ready', events: [] }} />);
    expect(host.querySelector('[role="status"]')?.textContent).toContain('No upcoming classes');
  });

  it('with classes it shows the picker, not a message', async () => {
    await show(<ClassPicker {...props} state={{ status: 'ready', events: [future(1)] }} />);
    expect(host.querySelector('[role="combobox"]')).not.toBeNull();
    expect(host.querySelector('[role="alert"], [role="status"]')).toBeNull();
    expect(host.textContent).toContain('Pick a class');
  });
});

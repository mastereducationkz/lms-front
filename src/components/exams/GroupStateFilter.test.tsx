// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { FinishedTag, GroupStateFilter } from './GroupStateFilter';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(node); });
  return host;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('GroupStateFilter', () => {
  it('offers Running, Finished and All, with the current one pressed', async () => {
    await show(<GroupStateFilter value="finished" onChange={() => {}} />);
    const buttons = Array.from(host.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Running', 'Finished', 'All']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('reports the state that was clicked', async () => {
    const onChange = vi.fn();
    await show(<GroupStateFilter value="running" onChange={onChange} />);
    const finished = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Finished')!;
    await act(async () => { finished.click(); });
    expect(onChange).toHaveBeenCalledWith('finished');
  });

  it('is a labelled group', async () => {
    await show(<GroupStateFilter value="running" onChange={() => {}} />);
    expect(host.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Groups');
  });
});

describe('FinishedTag', () => {
  it('shows nothing for a running group', async () => {
    await show(<FinishedTag finished={false} />);
    expect(host.textContent).toBe('');
  });

  it('marks a finished group', async () => {
    await show(<FinishedTag finished />);
    expect(host.textContent).toBe('finished');
  });
});

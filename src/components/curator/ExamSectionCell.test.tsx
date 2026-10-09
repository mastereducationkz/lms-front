// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import ExamSectionCell from './ExamSectionCell';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(props: React.ComponentProps<typeof ExamSectionCell>) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<ExamSectionCell {...props} />); });
  return host;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('ExamSectionCell', () => {
  it('puts correct / total first and the score out of 120 under it', async () => {
    await show({ correct: 17, total: 22, scaled: 84 });
    const lines = Array.from(host.querySelectorAll('[data-line]')).map((n) => n.textContent);
    expect(lines).toEqual(['17/22', '84/120']);
  });

  it('shows one line for SAT and for a NUET result without counts', async () => {
    await show({ correct: 15, total: 22 });
    expect(host.textContent).toBe('15/22');
    document.body.innerHTML = '';
    await show({ correct: 84, total: null, scaled: 84 });
    expect(host.textContent).toBe('84');
  });

  it('says so when the section was not taken', async () => {
    await show({ correct: null, total: null });
    expect(host.textContent).toBe('Not taken');
  });
});

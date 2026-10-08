// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { ShortAnswerQuestion } from './ShortAnswerQuestion';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement;
async function show(key: string, value: string, extra: Record<string, boolean> = {}) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<ShortAnswerQuestion question={{ correct_answer: key }} value={value} onChange={() => undefined} showResult {...extra} />);
  });
  return host.querySelector('input')!.className;
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

// After 2026-09-23 the score counted `13,5` right while this border stayed red: the review still
// compared lower-cased strings.
describe('the review border of a typed answer', () => {
  it('is green for an answer the score counts right', async () => {
    expect(await show('13.5', '13,5')).toContain('border-green-500');
  });

  it('is green for any of the alternatives, written any accepted way', async () => {
    expect(await show('16.5|33/2', '33/2')).toContain('border-green-500');
    expect(await show('0.5', '.5')).toContain('border-green-500');
  });

  it('is red for a wrong answer', async () => {
    expect(await show('13.5', '13.6')).toContain('border-red-500');
  });

  it('does not offer the correct answer when the typed one is right', async () => {
    await show('13.5', '13,5', { revealCorrect: true });
    expect(host.textContent).not.toContain('13.5');
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { InitialScoreCell, ScoreChange } from './InitialScoreCell';
import type { InitialScore } from '../../lib/examInitial';

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

const sat: InitialScore = { total: '1000.00', verbal: 480, math: 520, listening: null, reading: null, writing: null,
  previous_text: 'March 2025 - Math 700, Verbal 650', change: '210.00' };

describe('InitialScoreCell', () => {
  it('SAT: the baseline on top, Verbal and Math under it, and the written text', async () => {
    await show(<InitialScoreCell initial={sat} examType="sat" />);
    const lines = Array.from(host.querySelectorAll('[data-line]')).map((n) => n.textContent);
    expect(lines).toEqual(['1000', 'V 480 · M 520', 'March 2025 - Math 700, Verbal 650']);
  });

  it('shows a dash for a student without an initial score', async () => {
    await show(<InitialScoreCell initial={null} examType="sat" />);
    expect(host.textContent).toBe('—');
  });

  it('shows a dash on the NUET tab and explains why', async () => {
    await show(<InitialScoreCell initial={sat} examType="nuet" />);
    expect(host.textContent).toBe('—');
    expect((host.querySelector('[title]') as HTMLElement).title).toMatch(/does not ask for a NUET score/i);
  });
});

describe('ScoreChange', () => {
  it('is a signed chip, green up and red down', async () => {
    await show(<ScoreChange change="210.00" examType="sat" />);
    expect(host.textContent).toBe('+210');
    expect(host.querySelector('span')!.className).toContain('green');
    document.body.innerHTML = '';
    await show(<ScoreChange change="-40.00" examType="sat" />);
    expect(host.textContent).toBe('−40');
    expect(host.querySelector('span')!.className).toContain('red');
  });

  it('is absent without a change', async () => {
    await show(<ScoreChange change={null} examType="sat" />);
    expect(host.textContent).toBe('');
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { PlatformPracticeSection } from './PlatformPracticeSection';

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

describe('PlatformPracticeSection', () => {
  it('shows each paper with its estimate labelled and the RW / Math counts', async () => {
    await show(
      <PlatformPracticeSection items={[
        { paper_title: 'Practice Test 7', completed_at: '2026-10-12T10:00:00Z', total_scaled_estimate: 1340, rw: { correct: 40, total: 54 }, math: { correct: 30, total: 44 } },
      ]} />,
    );
    expect(host.textContent).toContain('Platform practice tests');
    expect(host.textContent).toContain('Practice Test 7');
    expect(host.querySelector('[data-cell="score"]')?.textContent).toBe('≈1340 (estimate)');
    expect(host.textContent).toContain('40/54');
    expect(host.textContent).toContain('30/44');
    expect(host.textContent).toContain('estimates');
  });

  it('a partial paper has no score, only its counts', async () => {
    await show(
      <PlatformPracticeSection items={[
        { paper_title: 'Math drill', completed_at: '2026-10-12T10:00:00Z', is_partial: true, total_scaled_estimate: null, rw: null, math: { correct: 15, total: 22 } },
      ]} />,
    );
    expect(host.querySelector('[data-cell="score"]')?.textContent).toBe('Partial paper, no score');
    expect(host.textContent).not.toContain('≈');
    expect(host.textContent).toContain('15/22');
  });

  it('renders nothing for a student with no platform practice', async () => {
    await show(<PlatformPracticeSection items={[]} />);
    expect(host.innerHTML).toBe('');
  });
});

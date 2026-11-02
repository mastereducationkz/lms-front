// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
const addResultSections = vi.fn();
vi.mock('../../services/api/exams', () => ({
  addResultSections: (...a: unknown[]) => addResultSections(...a),
}));

import { AddSectionsDialog } from './AddSectionsDialog';
import type { ExamResultRow } from '../../services/api/exams';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = {
  student: { student_id: 7, full_name: 'S' },
  result: { id: 42, test_date: '2026-10-03', total_score: 1450, verbal_score: null, math_score: null },
} as unknown as ExamResultRow;

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  addResultSections.mockReset();
});

async function open(onSaved = vi.fn()) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<AddSectionsDialog row={row} onClose={() => {}} onSaved={onSaved} />); });
}
async function type(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const save = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save') as HTMLButtonElement;

describe('AddSectionsDialog', () => {
  it('sends the breakdown of a total-only result', async () => {
    addResultSections.mockResolvedValueOnce({ id: 42 });
    const onSaved = vi.fn();
    await open(onSaved);
    expect(save().disabled).toBe(true);
    await type('as-v', '720');
    await type('as-m', '730');
    expect(document.querySelector('[role="alert"]')).toBeNull();
    await act(async () => { save().click(); });
    expect(addResultSections).toHaveBeenCalledWith(42, { verbal_score: 720, math_score: 730 });
    expect(onSaved).toHaveBeenCalled();
  });

  it('warns when the sections add up to another total', async () => {
    await open();
    await type('as-v', '700');
    await type('as-m', '740');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('1440');
  });
});

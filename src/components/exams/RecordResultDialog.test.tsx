// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
const createExamResult = vi.fn();
vi.mock('../../services/api/exams', () => ({
  createExamResult: (...a: unknown[]) => createExamResult(...a),
  uploadResultProof: vi.fn(),
}));

import { RecordResultDialog } from './RecordResultDialog';
import type { ExamResultRow, SatOfficialDate } from '../../services/api/exams';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const official = (test_date: string): SatOfficialDate => ({
  test_date, status: 'confirmed', label: test_date, month: 10, year: Number(test_date.slice(0, 4)),
  registration_deadline: null, change_deadline: null, is_past: true,
} as SatOfficialDate);
const DATES = [official('2025-10-04'), official('2026-10-03')];
const row = { student: { student_id: 7, full_name: 'S' }, planned_test_date: '2025-10-04', attempts: [] } as unknown as ExamResultRow;

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  createExamResult.mockReset();
});

async function open() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<RecordResultDialog row={row} examType="sat" officialDates={DATES} onClose={() => {}} onSaved={() => {}} />);
  });
}
async function type(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
}
const saveButton = () => { const all = document.querySelectorAll('button'); return all[all.length - 1] as HTMLButtonElement; };
async function pickDate(value: string) {
  const select = document.querySelector('select[aria-label]') as HTMLSelectElement;
  await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
}

describe('RecordResultDialog date guard', () => {
  it('offers SAT official dates only — no free date field', async () => {
    await open();
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });

  it('asks about an old date once, then sends it again confirmed', async () => {
    createExamResult
      .mockRejectedValueOnce({ response: { status: 409, data: { detail: {
        code: 'confirm_old_date', reason: 'older_than_6_months', test_date: '2025-10-04' } } } })
      .mockResolvedValueOnce({ id: 1 });
    await open();
    await pickDate('2025-10-04');
    await type('rr-v-0', '560');
    await type('rr-m-0', '600');

    await act(async () => { saveButton().click(); });
    expect(createExamResult.mock.calls[0][0]).not.toHaveProperty('confirm_old_date');
    const tick = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(tick).not.toBeNull();
    expect(document.body.textContent).toContain('2025-10-04');

    await act(async () => { tick.click(); });
    await act(async () => { saveButton().click(); });
    expect(createExamResult.mock.calls[1][0]).toMatchObject({ test_date: '2025-10-04', confirm_old_date: true });
  });
});

describe('RecordResultDialog, October 2026 recheck', () => {
  it('starts with NO date: a stale plan used to be saved as the sitting', async () => {
    await open();
    expect((document.querySelector('select[aria-label]') as HTMLSelectElement).value).toBe('');
    expect(document.body.textContent).toContain('2025-10-04');   // shown as a hint only
    expect(saveButton().disabled).toBe(true);
  });

  it('a SAT total without sections is sent as a total, under a loud warning', async () => {
    createExamResult.mockResolvedValueOnce({ id: 1 });
    await open();
    await pickDate('2026-10-03');
    expect(document.querySelector('[data-testid="rr-total-only-0"]')).toBeNull();
    await type('rr-t-0', '1450');
    expect(document.querySelector('[data-testid="rr-total-only-0"]')).not.toBeNull();

    await act(async () => { saveButton().click(); });
    const sent = createExamResult.mock.calls[0][0];
    expect(sent).toMatchObject({ exam_type: 'sat', test_date: '2026-10-03', total_score: 1450 });
    expect(sent).not.toHaveProperty('verbal_score');
  });

  it('refuses a total off the SAT scale and one section without the other', async () => {
    await open();
    await pickDate('2026-10-03');
    await type('rr-t-0', '1455');
    expect(saveButton().disabled).toBe(true);
    await type('rr-t-0', '');
    await type('rr-v-0', '700');
    expect(saveButton().disabled).toBe(true);
    await type('rr-m-0', '650');
    expect(saveButton().disabled).toBe(false);
  });
});

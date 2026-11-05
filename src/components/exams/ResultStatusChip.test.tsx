// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { ResultStatusChip } from './ResultStatusChip';
import { isUnconfirmed } from './resultStatus';
import { datePassedNoResult } from './datePassed';
import type { ExamResultRow } from '../../services/api/exams';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

async function show(result: Parameters<typeof ResultStatusChip>[0]['result']) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<ResultStatusChip result={result} />); });
}

describe('«без подтверждения» logic', () => {
  it('flags reported without proof only', () => {
    expect(isUnconfirmed({ status: 'reported', has_proof: false })).toBe(true);
    expect(isUnconfirmed({ status: 'reported', has_proof: true })).toBe(false);
    // Master League rows are written verified and proof-less: vouched for, not flagged.
    expect(isUnconfirmed({ status: 'verified', has_proof: false })).toBe(false);
    expect(isUnconfirmed({ status: 'rejected', has_proof: false })).toBe(false);
  });
});

describe('ResultStatusChip', () => {
  it('shows the status and the badge for a reported result with no proof', async () => {
    await show({ status: 'reported', has_proof: false });
    expect(document.querySelector('[data-testid="result-status"]')?.textContent).toBe('reported');
    expect(document.querySelector('[data-testid="result-unconfirmed"]')?.textContent).toBe('no proof');
  });

  it('shows no badge for a verified row without proof, and names the verifier', async () => {
    await show({ status: 'verified', has_proof: false, verified_by_name: 'Aigerim' });
    expect(document.querySelector('[data-testid="result-unconfirmed"]')).toBeNull();
    const chip = document.querySelector('[data-testid="result-status"]')!;
    expect(chip.textContent).toBe('verified');
    expect(chip.getAttribute('title')).toContain('Aigerim');
  });

  it('shows no badge once proof is attached', async () => {
    await show({ status: 'reported', has_proof: true });
    expect(document.querySelector('[data-testid="result-unconfirmed"]')).toBeNull();
  });
});

describe('datePassedNoResult', () => {
  const row = (p: Partial<ExamResultRow>) => ({ planned_test_date: null, triage_status: 'pending', ...p } as ExamResultRow);
  it('trusts the server verdict when present', () => {
    expect(datePassedNoResult(row({ date_passed_no_result: true }), '2026-11-05')).toBe(true);
    expect(datePassedNoResult(row({ date_passed_no_result: false, planned_test_date: '2026-01-01' }), '2026-11-05')).toBe(false);
  });
  it('judges an older API response itself: past date, no result, no outcome', () => {
    expect(datePassedNoResult(row({ planned_test_date: '2026-11-03' }), '2026-11-05')).toBe(true);
    expect(datePassedNoResult(row({ planned_test_date: '2026-11-05' }), '2026-11-05')).toBe(false);
    expect(datePassedNoResult(row({ planned_test_date: '2026-11-03', sitting_has_result: true }), '2026-11-05')).toBe(false);
    expect(datePassedNoResult(row({ planned_test_date: '2026-11-03', triage_status: 'not_taking' }), '2026-11-05')).toBe(false);
    expect(datePassedNoResult(row({}), '2026-11-05')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { labelCounts, sortReports, type ReportTriage } from './reportTriage';

const t = (label: ReportTriage['effective_label'], confidence = 0.5, corrected = false): ReportTriage => ({
  label, confidence, corrected_label: corrected ? label : null, effective_label: label, facts: [],
});

describe('report triage', () => {
  const reports = [
    { id: 1, created_at: '2026-09-01', triage: t('junk', 0.9) },
    { id: 2, created_at: '2026-09-02', triage: t('key_wrong', 0.6) },
    { id: 3, created_at: '2026-09-03', triage: null },
    { id: 4, created_at: '2026-09-04', triage: t('key_wrong', 0.95) },
    { id: 5, created_at: '2026-09-05', triage: t('student_wrong', 0.2, true) },
  ];
  it('puts a wrong key first, the surest first, and unlabelled last', () => {
    expect(sortReports(reports, 'urgent').map((r) => r.id)).toEqual([4, 2, 5, 1, 3]);
    expect(sortReports(reports, 'newest')).toBe(reports);
  });
  it('counts by the label staff see', () => {
    expect(labelCounts(reports)).toEqual({ junk: 1, key_wrong: 2, none: 1, student_wrong: 1 });
  });
});

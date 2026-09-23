import { describe, expect, it } from 'vitest';
import { CRM_TASKS_URL, buildCrmTasksUrl } from './crmLinks';

describe('buildCrmTasksUrl', () => {
  it('sends an old tasks or onboarding link to the CRM «Задачи»', () => {
    expect(buildCrmTasksUrl('')).toBe(CRM_TASKS_URL);
    expect(CRM_TASKS_URL.endsWith('/curator/tasks')).toBe(true);
  });

  it('carries the filters the CRM list understands', () => {
    expect(buildCrmTasksUrl('?curator_id=7&category=exam_dates&task=42')).toBe(
      `${CRM_TASKS_URL}?curator_id=7&category=exam_dates&task=42`,
    );
  });

  it('drops what the CRM would not understand', () => {
    // `card` and `status` belonged to the retired onboarding board.
    expect(buildCrmTasksUrl('?card=3&status=new&week=2026-W39')).toBe(CRM_TASKS_URL);
  });
});

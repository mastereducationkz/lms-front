import { describe, expect, it } from 'vitest';
import { CRM_ONBOARDING_URL, CRM_TASKS_URL, buildCrmOnboardingUrl, buildCrmTasksUrl } from './crmLinks';

describe('buildCrmTasksUrl', () => {
  it('sends an old tasks link to the CRM «Задачи»', () => {
    expect(buildCrmTasksUrl('')).toBe(CRM_TASKS_URL);
    expect(CRM_TASKS_URL.endsWith('/curator/tasks')).toBe(true);
  });

  it('carries the filters the CRM list understands', () => {
    expect(buildCrmTasksUrl('?curator_id=7&category=exam_dates&task=42')).toBe(
      `${CRM_TASKS_URL}?curator_id=7&category=exam_dates&task=42`,
    );
  });

  it('drops what the CRM would not understand', () => {
    // `card` and `status` belong to the onboarding board, not to «Задачи».
    expect(buildCrmTasksUrl('?card=3&status=new&week=2026-W39')).toBe(CRM_TASKS_URL);
  });
});

describe('buildCrmOnboardingUrl', () => {
  it('sends an old onboarding link to the CRM board', () => {
    expect(buildCrmOnboardingUrl('')).toBe(CRM_ONBOARDING_URL);
    expect(CRM_ONBOARDING_URL.endsWith('/curator/onboarding')).toBe(true);
  });

  it('carries the curator filter and the card to open, and nothing else', () => {
    expect(buildCrmOnboardingUrl('?curator_id=7&card=3&category=exam_dates')).toBe(
      `${CRM_ONBOARDING_URL}?curator_id=7&card=3`,
    );
  });
});

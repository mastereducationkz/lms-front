import { describe, expect, it } from 'vitest';
import { dashboardPromptAllowed, type DashboardPromptInput } from './dashboardPrompt';

const calm: DashboardPromptInput = { tourActive: false, tipOpen: false, spotlightFirst: false, quietVisit: true, shownThisVisit: false };

describe('dashboardPromptAllowed: one prompt at a time', () => {
  it('shows on a calm, quiet visit', () => {
    expect(dashboardPromptAllowed(calm)).toBe(true);
  });

  it('waits for the Kasatik spotlight, the tour, an open tip and a busy visit', () => {
    expect(dashboardPromptAllowed({ ...calm, spotlightFirst: true })).toBe(false);
    expect(dashboardPromptAllowed({ ...calm, tourActive: true })).toBe(false);
    expect(dashboardPromptAllowed({ ...calm, tipOpen: true })).toBe(false);
    expect(dashboardPromptAllowed({ ...calm, quietVisit: false })).toBe(false);
  });

  it('once up in a visit it stays, except under a tour', () => {
    const shown = { ...calm, shownThisVisit: true };
    expect(dashboardPromptAllowed({ ...shown, tipOpen: true, quietVisit: false })).toBe(true);
    expect(dashboardPromptAllowed({ ...shown, tourActive: true })).toBe(false);
  });
});

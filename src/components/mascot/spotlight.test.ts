import { describe, expect, it } from 'vitest';
import {
  dismissSpotlight,
  isSpotlightDismissed,
  onboardingPending,
  shouldShowSpotlight,
  spotlightVersion,
  subscribeSpotlight,
  type SpotlightInput,
} from './spotlight';

const base: SpotlightInput = {
  role: 'student', mascot: null, dismissed: false, tourActive: false, assignmentZeroGate: false, pathname: '/dashboard',
};

describe('«Meet your Kasatik» spotlight rule', () => {
  it('shows for a student who still has the automatic orca', () => {
    expect(shouldShowSpotlight(base)).toBe(true);
    expect(shouldShowSpotlight({ ...base, mascot: '' })).toBe(true);
  });

  it('hides for good once they save a look', () => {
    expect(shouldShowSpotlight({ ...base, mascot: 'v1.h16.g0.e0.p1.b10' })).toBe(false);
  });

  it('is for students only', () => {
    for (const role of ['teacher', 'curator', 'head_teacher', 'head_curator', 'admin', 'parent', null]) {
      expect(shouldShowSpotlight({ ...base, role })).toBe(false);
    }
  });

  it('respects Later, the onboarding tour and the Assignment Zero gate', () => {
    expect(shouldShowSpotlight({ ...base, dismissed: true })).toBe(false);
    expect(shouldShowSpotlight({ ...base, tourActive: true })).toBe(false);
    expect(shouldShowSpotlight({ ...base, assignmentZeroGate: true })).toBe(false);
  });

  it('stays away from the gate page and the profile (where the builder is)', () => {
    expect(shouldShowSpotlight({ ...base, pathname: '/assignment-zero' })).toBe(false);
    expect(shouldShowSpotlight({ ...base, pathname: '/profile' })).toBe(false);
  });
});

describe('shared dismissed state', () => {
  it('dismisses both surfaces at once, even with no storage available', () => {
    let calls = 0;
    const unsubscribe = subscribeSpotlight(() => { calls += 1; });
    const before = spotlightVersion();
    expect(isSpotlightDismissed(777)).toBe(false);
    dismissSpotlight(777);
    expect(isSpotlightDismissed(777)).toBe(true);
    expect(isSpotlightDismissed(778)).toBe(false);
    expect(spotlightVersion()).toBe(before + 1);
    expect(calls).toBe(1);
    unsubscribe();
  });

  it('treats the tour as pending until onboarding is completed', () => {
    expect(onboardingPending(1, true)).toBe(false);
    expect(onboardingPending(1, false)).toBe(true);
  });
});

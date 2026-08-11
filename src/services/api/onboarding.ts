import { api } from './client';
import type { OnboardingCard, OnboardingStatus } from '../../types';

export async function getOnboarding(curatorId?: number): Promise<OnboardingCard[]> {
  const response = await api.get('/curator-onboarding/', {
    params: curatorId != null ? { curator_id: curatorId } : undefined,
  });
  return response.data.cards || [];
}

export async function updateOnboardingStatus(
  id: number,
  status: OnboardingStatus,
): Promise<OnboardingCard> {
  const response = await api.patch(`/curator-onboarding/${id}`, { status });
  return response.data;
}

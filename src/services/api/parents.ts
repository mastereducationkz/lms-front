import { api } from './client';

export interface ParentChild {
  id: number;
  name: string;
  email?: string;
  /** Null for a child whose platform access ended: nothing of their studies is shown. */
  group_name?: string | null;
  /** True once the CRM closed the account because the child's access ended (`access_until` is that last day, YYYY-MM-DD). */
  access_ended?: boolean;
  access_until?: string | null;
}

// The children linked to the currently logged-in parent (parent-only endpoint).
export async function getMyChildren(): Promise<ParentChild[]> {
  try {
    const response = await api.get('/parents/me/children');
    return response.data;
  } catch (error) {
    console.warn('Failed to load children:', error);
    return [];
  }
}

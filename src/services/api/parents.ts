import { api } from './client';

export interface ParentChild {
  id: number;
  name: string;
  email?: string;
  group_name?: string;
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

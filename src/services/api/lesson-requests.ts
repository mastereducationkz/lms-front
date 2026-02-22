import type { LessonRequest, CreateLessonRequest, AvailableTeacher } from '../../types';
import { api } from './client';

export async function getLessonRequests(status?: string): Promise<LessonRequest[]> {
  try {
    const params = status ? { status_filter: status } : {};
    const response = await api.get('/lesson-requests/', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get lesson requests:', error);
    throw error;
  }
}

export async function getMyLessonRequests(status?: string): Promise<LessonRequest[]> {
  try {
    const params = status ? { status_filter: status } : {};
    const response = await api.get('/lesson-requests/me', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get my lesson requests:', error);
    throw error;
  }
}

export async function getIncomingRequests(history: boolean = false): Promise<LessonRequest[]> {
  try {
    const response = await api.get('/lesson-requests/incoming', { params: { history } });
    return response.data;
  } catch (error) {
    console.error('Failed to get incoming requests:', error);
    throw error;
  }
}

export async function createLessonRequest(data: CreateLessonRequest): Promise<LessonRequest> {
  try {
    const response = await api.post('/lesson-requests/', data);
    return response.data;
  } catch (error) {
    console.error('Failed to create lesson request:', error);
    throw error;
  }
}

export async function approveLessonRequest(requestId: number, adminComment?: string): Promise<LessonRequest> {
  try {
    const response = await api.post(`/lesson-requests/${requestId}/approve`, {
      admin_comment: adminComment || null
    });
    return response.data;
  } catch (error) {
    console.error('Failed to approve lesson request:', error);
    throw error;
  }
}

export async function rejectLessonRequest(requestId: number, adminComment?: string): Promise<LessonRequest> {
  try {
    const response = await api.post(`/lesson-requests/${requestId}/reject`, {
      admin_comment: adminComment || null
    });
    return response.data;
  } catch (error) {
    console.error('Failed to reject lesson request:', error);
    throw error;
  }
}

export async function confirmLessonRequest(requestId: number): Promise<LessonRequest> {
  try {
    const response = await api.post(`/lesson-requests/${requestId}/confirm`);
    return response.data;
  } catch (error) {
    console.error('Failed to confirm lesson request:', error);
    throw error;
  }
}

export async function declineLessonRequest(requestId: number): Promise<LessonRequest> {
  try {
    const response = await api.post(`/lesson-requests/${requestId}/decline`);
    return response.data;
  } catch (error) {
    console.error('Failed to decline lesson request:', error);
    throw error;
  }
}

export async function getAvailableTeachers(datetime: string, groupId?: number): Promise<{ available_teachers: AvailableTeacher[] }> {
  try {
    const params: any = { datetime_str: datetime };
    if (groupId) params.group_id = groupId;
    const response = await api.get('/lesson-requests/teachers/available', { params });
    return response.data;
  } catch (error) {
    console.error('Failed to get available teachers:', error);
    throw error;
  }
}

export async function updateSubstitutionPreference(enabled: boolean): Promise<{ detail: string; no_substitutions: boolean }> {
  try {
    const response = await api.put('/lesson-requests/preferences/no-substitutions', null, {
      params: { enabled }
    });
    return response.data;
  } catch (error) {
    console.error('Failed to update substitution preference:', error);
    throw error;
  }
}

import type { LessonRequest, CreateLessonRequest, AvailableTeacher, CancelResolution } from '../../types';
import { api } from './client';

export async function getPendingLessonRequests(): Promise<LessonRequest[]> {
  try {
    const response = await api.get('/lesson-requests/pending-approval');
    return response.data;
  } catch (error) {
    console.error('Failed to get pending lesson requests:', error);
    throw error;
  }
}

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

export async function approveLessonRequest(
  requestId: number,
  adminComment?: string,
  cancelResolution?: CancelResolution,
): Promise<LessonRequest> {
  try {
    const response = await api.post(`/lesson-requests/${requestId}/approve`, {
      admin_comment: adminComment || null,
      // Cancel requests only. Left out (not null) when there is no choice: the server then
      // applies the teacher's proposal, else «только отменить».
      ...(cancelResolution ? { cancel_resolution: cancelResolution } : {}),
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

export async function getAvailableTeachers(datetime: string, groupId?: number, eventId?: number): Promise<{ available_teachers: AvailableTeacher[] }> {
  try {
    const params: any = { datetime_str: datetime };
    if (groupId) params.group_id = groupId;
    if (eventId) params.event_id = eventId;
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

export type TeacherRequestStats = {
  teacher_id: number;
  teacher_name: string;
  total: number;
  by_type: { substitution: number; reschedule: number; cancel: number; hold?: number };
};

export async function getTeacherRequestStats(
  year: number,
  month: number,
  minCount: number = 2,
): Promise<TeacherRequestStats[]> {
  try {
    const response = await api.get('/lesson-requests/teacher-stats', {
      params: { year, month, min_count: minCount },
    });
    return response.data;
  } catch (error) {
    console.error('Failed to get teacher request stats:', error);
    throw error;
  }
}

// ── «Временная отмена»: the queue of lessons waiting for a new time, and the ways out of it ──

/** Lessons put on hold with no new time yet, the longest-waiting first (what the caller may manage). */
export async function getWaitingHolds(): Promise<LessonRequest[]> {
  try {
    const response = await api.get('/lesson-requests/holds');
    return response.data;
  } catch (error) {
    console.error('Failed to get waiting holds:', error);
    throw error;
  }
}

/** The lesson returns at `newDatetimeIso` (UTC ISO, from `fromDatetimeLocalKZ`). */
export async function setHoldTime(requestId: number, newDatetimeIso: string): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/schedule`, { new_datetime: newDatetimeIso });
  return response.data;
}

/** The lesson will never be held: a real cancel, with or without a replacement lesson at the end. */
export async function convertHoldToCancel(requestId: number, resolution: CancelResolution): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/cancel`, { cancel_resolution: resolution });
  return response.data;
}

/** Back at the original time (only while that time is still ahead). */
export async function restoreHold(requestId: number): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/restore`);
  return response.data;
}

/** The teacher who asked for the hold proposes the lesson's new time (UTC ISO). Nothing moves until a head confirms. */
export async function proposeHoldTime(requestId: number, newDatetimeIso: string): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/propose`, { new_datetime: newDatetimeIso });
  return response.data;
}

/** One click: the lesson returns at the time the teacher proposed. */
export async function confirmHoldProposal(requestId: number): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/confirm`);
  return response.data;
}

/** The proposed time does not suit: the teacher is told and may propose another. */
export async function declineHoldProposal(requestId: number): Promise<LessonRequest> {
  const response = await api.post(`/lesson-requests/${requestId}/hold/decline`);
  return response.data;
}


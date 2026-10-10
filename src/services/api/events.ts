import type { Event, CreateEventRequest, UpdateEventRequest, EventType, EventStudent, AttendanceBulkUpdate, SubstitutionLesson } from '../../types';
import { api } from './client';
import { apiError } from './apiError';

export async function getAllEvents(params?: {
  skip?: number;
  limit?: number;
  event_type?: EventType;
  exclude_type?: EventType;
  group_id?: number;
  start_date?: string;
  end_date?: string;
}): Promise<Event[]> {
  try {
    const response = await api.get('/admin/events', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load events');
  }
}

export async function createEvent(eventData: CreateEventRequest): Promise<Event> {
  try {
    const response = await api.post('/admin/events', eventData);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to create event');
  }
}

export async function createCuratorEvent(eventData: CreateEventRequest): Promise<Event> {
  try {
    const response = await api.post('/events/curator/create', eventData);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to create event');
  }
}

/** `scope: 'following'` edits this event and every later occurrence of its series; the default is this event only. */
export async function updateEvent(eventId: number, eventData: UpdateEventRequest, scope: 'this' | 'following' = 'this'): Promise<Event> {
  try {
    const response = await api.put(`/admin/events/${eventId}`, eventData, scope === 'following' ? { params: { scope } } : undefined);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to update event');
  }
}

/** Cancels the event (and with `scope: 'following'` every later occurrence of its series); returns how many were cancelled. */
export async function deleteEvent(eventId: number, scope: 'this' | 'following' = 'this'): Promise<number> {
  try {
    const response = await api.delete(`/admin/events/${eventId}`, scope === 'following' ? { params: { scope } } : undefined);
    return response?.data?.deleted ?? 1;
  } catch (error: any) {
    throw apiError(error, 'Failed to delete event');
  }
}

export interface EventSeriesSummary {
  series_id: string | null;
  total: number;
  /** 1-based place of this event among the active occurrences; null when it is not one of them. */
  position: number | null;
  /** Occurrences from this one on, this one included. */
  following: number;
  first_start?: string | null;
  last_start?: string | null;
}

/** Where an event stands in its recurring series - what the screen needs before it offers «this and all following». */
export async function getEventSeries(eventId: number): Promise<EventSeriesSummary> {
  try {
    const response = await api.get(`/admin/events/${eventId}/series`);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load the event series');
  }
}

export async function bulkDeleteEvents(eventIds: number[]): Promise<void> {
  try {
    await api.post('/admin/events/bulk-delete', eventIds);
  } catch (error: any) {
    throw apiError(error, 'Failed to delete events');
  }
}

export async function createBulkEvents(eventsData: CreateEventRequest[]): Promise<Event[]> {
  try {
    const response = await api.post('/admin/events/bulk', eventsData);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to create bulk events');
  }
}

export async function getMyEvents(params?: {
  skip?: number;
  limit?: number;
  event_type?: EventType;
  start_date?: string;
  end_date?: string;
  upcoming_only?: boolean;
  group_id?: number;
}): Promise<Event[]> {
  try {
    const response = await api.get('/events/my', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load my events');
  }
}

export async function getCalendarEvents(
  year: number,
  month: number,
  includeFinished: boolean = false,
): Promise<Event[]> {
  try {
    const response = await api.get('/events/calendar', {
      params: { year, month, include_finished: includeFinished }
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load calendar events');
  }
}

export async function getUpcomingEvents(params?: {
  limit?: number;
  days_ahead?: number;
}): Promise<Event[]> {
  try {
    const response = await api.get('/events/upcoming', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load upcoming events');
  }
}

export async function getEventDetails(eventId: number): Promise<Event> {
  try {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load event details');
  }
}

export async function registerForEvent(eventId: number): Promise<void> {
  try {
    await api.post(`/events/${eventId}/register`);
  } catch (error: any) {
    throw apiError(error, 'Failed to register for event');
  }
}

export async function unregisterFromEvent(eventId: number): Promise<void> {
  try {
    await api.delete(`/events/${eventId}/register`);
  } catch (error: any) {
    throw apiError(error, 'Failed to unregister from event');
  }
}

export async function getEventParticipants(eventId: number, groupId?: number): Promise<EventStudent[]> {
  try {
    const response = await api.get(`/events/${eventId}/participants`, {
      params: { group_id: groupId }
    });
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load participants');
  }
}

export async function updateEventAttendance(eventId: number, data: AttendanceBulkUpdate): Promise<void> {
  try {
    await api.post(`/events/${eventId}/attendance`, data);
  } catch (error: any) {
    // FastAPI's own request-validation 422 (malformed body, wrong types) sends `detail`
    // as an array of error objects, not a string — `new Error(thatArray)` stringifies
    // it to `[object Object]`. Our excused-absence 422 (whole-batch rejection) sends a
    // plain Russian string, which must reach the caller verbatim. Only pass through the
    // string case; fall back to the generic message otherwise, same guard the grid uses.
    const detail = error.response?.data?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Failed to update attendance');
  }
}

/** «Баллы за урок»: scores only, never a mark — allowed from the lesson's start (2026-09-28). */
export async function saveActivityScores(
  eventId: number,
  scores: { student_id: number; activity_score: number }[],
): Promise<{ written: number }> {
  try {
    const response = await api.put(`/events/${eventId}/activity-scores`, { scores });
    return response.data;
  } catch (error: any) {
    const detail = error.response?.data?.detail;
    throw new Error(typeof detail === 'string' ? detail : 'Failed to save scores');
  }
}

export async function getMySubstitutions(): Promise<SubstitutionLesson[]> {
  try {
    const response = await api.get('/events/my-substitutions');
    return response.data;
  } catch (error: any) {
    throw apiError(error, 'Failed to load substitutions');
  }
}

import type { Event, CreateEventRequest, UpdateEventRequest, EventType, EventStudent, AttendanceBulkUpdate } from '../../types';
import { api } from './client';

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
    throw new Error(error.response?.data?.detail || 'Failed to create event');
  }
}

export async function createCuratorEvent(eventData: CreateEventRequest): Promise<Event> {
  try {
    const response = await api.post('/events/curator/create', eventData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to create event');
  }
}

export async function updateEvent(eventId: number, eventData: UpdateEventRequest): Promise<Event> {
  try {
    const response = await api.put(`/admin/events/${eventId}`, eventData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to update event');
  }
}

export async function deleteEvent(eventId: number): Promise<void> {
  try {
    await api.delete(`/admin/events/${eventId}`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to delete event');
  }
}

export async function bulkDeleteEvents(eventIds: number[]): Promise<void> {
  try {
    await api.post('/admin/events/bulk-delete', eventIds);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to delete events');
  }
}

export async function createBulkEvents(eventsData: CreateEventRequest[]): Promise<Event[]> {
  try {
    const response = await api.post('/admin/events/bulk', eventsData);
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to create bulk events');
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

export async function getCalendarEvents(year: number, month: number): Promise<Event[]> {
  try {
    const response = await api.get('/events/calendar', {
      params: { year, month }
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
    throw new Error(error.response?.data?.detail || 'Failed to load event details');
  }
}

export async function registerForEvent(eventId: number): Promise<void> {
  try {
    await api.post(`/events/${eventId}/register`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to register for event');
  }
}

export async function unregisterFromEvent(eventId: number): Promise<void> {
  try {
    await api.delete(`/events/${eventId}/register`);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to unregister from event');
  }
}

export async function getEventParticipants(eventId: number, groupId?: number): Promise<EventStudent[]> {
  try {
    const response = await api.get(`/events/${eventId}/participants`, {
      params: { group_id: groupId }
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to load participants');
  }
}

export async function updateEventAttendance(eventId: number, data: AttendanceBulkUpdate): Promise<void> {
  try {
    await api.post(`/events/${eventId}/attendance`, data);
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to update attendance');
  }
}

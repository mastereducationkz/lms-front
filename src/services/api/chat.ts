import { api } from './client';

export async function getUnreadMessageCount() {
  try {
    const response = await api.get('/messages/unread-count');
    return response.data;
  } catch (error) {
    console.warn('Failed to load unread count:', error);
    return { unread_count: 0 };
  }
}

export async function fetchThreads() {
  try {
    const response = await api.get('/messages/conversations');
    return response.data;
  } catch (error) {
    console.warn('Failed to load threads:', error);
    return [];
  }
}

export async function fetchMessages(partnerId: string): Promise<any[]> {
  try {
    console.log('🌐 API: Fetching messages for partner:', partnerId);
    const response = await api.get('/messages/', {
      params: { with_user_id: partnerId }
    });
    return response.data;
  } catch (error) {
    console.warn('Failed to load messages:', error);
    return [];
  }
}

export async function sendMessage(toUserId: string, content: string): Promise<any> {
  console.log('🌐 API: Sending message to user:', toUserId);
  try {
    const response = await api.post('/messages/', {
      to_user_id: parseInt(toUserId),
      content: content
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to send message');
  }
}

export async function getAvailableContacts(roleFilter?: string) {
  try {
    const params = roleFilter ? { role_filter: roleFilter } : {};
    const response = await api.get('/messages/available-contacts', { params });
    return response.data.available_contacts || [];
  } catch (error) {
    console.error('❌ API: Failed to load available contacts:', error);
    return [];
  }
}

export async function markMessageAsRead(messageId: number) {
  try {
    await api.put(`/messages/${messageId}/read`);
  } catch (error) {
    console.warn('Failed to mark message as read:', error);
  }
}

export async function markAllMessagesAsRead(partnerId: string) {
  try {
    await api.put(`/messages/mark-all-read/${partnerId}`);
  } catch (error) {
    console.warn('Failed to mark all messages as read:', error);
  }
}

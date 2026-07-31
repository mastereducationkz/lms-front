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

export async function sendMessage(
  toUserId: string,
  content: string,
  replyToMessageId?: number | null,
): Promise<any> {
  console.log('🌐 API: Sending message to user:', toUserId);
  try {
    const response = await api.post('/messages/', {
      to_user_id: parseInt(toUserId),
      content: content,
      reply_to_message_id: replyToMessageId ?? null,
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to send message');
  }
}

// --- Reactions ---------------------------------------------------------------

export async function reactToMessage(messageId: number, emoji: string) {
  const response = await api.post(`/messages/${messageId}/reactions`, { emoji });
  return response.data; // { message_id, reactions: [...] }
}

export async function removeMessageReaction(messageId: number) {
  const response = await api.delete(`/messages/${messageId}/reactions`);
  return response.data; // { message_id, reactions: [...] }
}

// --- Mute --------------------------------------------------------------------

export async function getMutedConversations(): Promise<number[]> {
  try {
    const response = await api.get('/messages/mutes');
    return response.data?.muted_partner_ids || [];
  } catch (error) {
    console.warn('Failed to load muted conversations:', error);
    return [];
  }
}

export async function muteConversation(partnerId: number) {
  const response = await api.post(`/messages/mutes/${partnerId}`);
  return response.data;
}

export async function unmuteConversation(partnerId: number) {
  const response = await api.delete(`/messages/mutes/${partnerId}`);
  return response.data;
}

// --- Shared media (chat info screen) -----------------------------------------

export async function getSharedMedia(partnerId: number): Promise<Array<{
  id: number;
  file_url: string;
  from_user_id: number;
  created_at: string | null;
}>> {
  try {
    const response = await api.get(`/messages/shared-media/${partnerId}`);
    return response.data || [];
  } catch (error) {
    console.warn('Failed to load shared media:', error);
    return [];
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

export async function fetchGroupThreads() {
  try {
    const response = await api.get('/messages/groups');
    return response.data;
  } catch (error) {
    console.warn('Failed to load group threads:', error);
    return [];
  }
}

export async function fetchGroupMessages(conversationId: number | string): Promise<any[]> {
  try {
    const response = await api.get(`/messages/groups/${conversationId}`);
    return response.data;
  } catch (error) {
    console.warn('Failed to load group messages:', error);
    return [];
  }
}

export async function sendGroupMessage(conversationId: number | string, content: string, fileUrl?: string): Promise<any> {
  const response = await api.post(`/messages/groups/${conversationId}`, { content, file_url: fileUrl });
  return response.data;
}

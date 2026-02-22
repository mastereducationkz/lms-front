import type { User, UserListResponse, CreateUserRequest, UpdateUserRequest, BulkCreateUsersResponse } from '../../types';
import { api } from './client';

export async function getUsers(params?: {
  skip?: number;
  limit?: number;
  role?: string;
  group_id?: number;
  is_active?: boolean;
  search?: string;
}): Promise<UserListResponse> {
  try {
    const response = await api.get('/admin/users', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch users');
  }
}

export async function updateUser(userId: number, userData: UpdateUserRequest): Promise<User> {
  try {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update user');
  }
}

export async function deactivateUser(userId: number): Promise<void> {
  try {
    await api.delete(`/admin/users/${userId}`);
  } catch (error) {
    throw new Error('Failed to deactivate user');
  }
}

export async function assignUserToGroup(userId: number, groupId: number): Promise<void> {
  try {
    await api.post(`/admin/users/${userId}/assign-group`, { group_id: groupId });
  } catch (error) {
    throw new Error('Failed to assign user to group');
  }
}

export async function bulkAssignUsersToGroup(userIds: number[], groupId: number): Promise<void> {
  try {
    await api.post('/admin/users/bulk-assign-group', {
      user_ids: userIds,
      group_id: groupId
    });
  } catch (error) {
    throw new Error('Failed to bulk assign users to group');
  }
}

export async function createUser(userData: CreateUserRequest): Promise<{ user: User; generated_password?: string }> {
  try {
    const response = await api.post('/admin/users/single', userData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create user');
  }
}

export async function bulkCreateUsersFromText(
  text: string,
  groupIds?: number[],
  role: string = 'student'
): Promise<BulkCreateUsersResponse> {
  try {
    const response = await api.post('/admin/users/bulk-text', {
      text,
      group_ids: groupIds,
      role,
      generate_passwords: true
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || 'Failed to bulk create users from text');
  }
}

export async function resetUserPassword(userId: number): Promise<{ new_password: string; user_email: string }> {
  try {
    const response = await api.post(`/admin/reset-password/${userId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to reset user password');
  }
}

export async function getAllTeachers(): Promise<User[]> {
  try {
    const response = await api.get('/admin/users', { params: { role: 'teacher', limit: 1000 } });
    return response.data.users;
  } catch (error) {
    throw new Error('Failed to load teachers');
  }
}

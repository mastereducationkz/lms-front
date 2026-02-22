import type { Group, CourseGroupAccess, CreateGroupRequest, UpdateGroupRequest, User } from '../../types';
import { api } from './client';

export async function getAllGroups(): Promise<any> {
  try {
    const response = await api.get('/admin/groups');
    return response.data;
  } catch (error) {
    throw new Error('Failed to get groups');
  }
}

export async function getGroups(): Promise<Group[]> {
  try {
    const response = await api.get('/admin/groups');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch groups');
  }
}

export async function getMyGroups(): Promise<Group[]> {
  try {
    const response = await api.get('/users/groups/me');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch my groups');
  }
}

export async function getTeacherGroups(): Promise<Group[]> {
  try {
    const response = await api.get('/admin/groups');
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch teacher groups');
  }
}

export async function getCourseGroups(courseId: string): Promise<CourseGroupAccess[]> {
  try {
    const response = await api.get(`/courses/${courseId}/groups`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch course groups');
  }
}

export async function grantCourseAccessToGroup(courseId: string, groupId: number): Promise<void> {
  try {
    await api.post(`/courses/${courseId}/groups/${groupId}`);
  } catch (error) {
    throw new Error('Failed to grant course access to group');
  }
}

export async function revokeCourseAccessFromGroup(courseId: string, groupId: number): Promise<void> {
  try {
    await api.delete(`/courses/${courseId}/groups/${groupId}`);
  } catch (error) {
    throw new Error('Failed to revoke course access from group');
  }
}

export async function createGroup(groupData: CreateGroupRequest): Promise<Group> {
  try {
    const response = await api.post('/admin/groups', groupData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create group');
  }
}

export async function updateGroup(groupId: number, groupData: UpdateGroupRequest): Promise<Group> {
  try {
    const response = await api.put(`/admin/groups/${groupId}`, groupData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update group');
  }
}

export async function deleteGroup(groupId: number): Promise<void> {
  try {
    await api.delete(`/admin/groups/${groupId}`);
  } catch (error) {
    throw new Error('Failed to delete group');
  }
}

export async function assignTeacherToGroup(groupId: number, teacherId: number): Promise<void> {
  try {
    await api.post(`/admin/groups/${groupId}/assign-teacher`, { teacher_id: teacherId });
  } catch (error) {
    throw new Error('Failed to assign teacher to group');
  }
}

export async function getGroupStudents(groupId: number): Promise<User[]> {
  try {
    const response = await api.get(`/admin/groups/${groupId}/students`);
    return response.data || [];
  } catch (error) {
    console.error(`Failed to fetch group students for group ${groupId}:`, error);
    return [];
  }
}

export async function addStudentToGroup(groupId: number, studentId: number): Promise<void> {
  try {
    await api.post(`/admin/groups/${groupId}/students`, { student_id: studentId });
  } catch (error) {
    throw new Error('Failed to add student to group');
  }
}

export async function removeStudentFromGroup(groupId: number, studentId: number): Promise<void> {
  try {
    await api.delete(`/admin/groups/${groupId}/students/${studentId}`);
  } catch (error) {
    throw new Error('Failed to remove student from group');
  }
}

export async function bulkAddStudentsToGroup(groupId: number, studentIds: number[]): Promise<void> {
  try {
    await api.post(`/admin/groups/${groupId}/students/bulk`, studentIds);
  } catch (error) {
    throw new Error('Failed to bulk add students to group');
  }
}

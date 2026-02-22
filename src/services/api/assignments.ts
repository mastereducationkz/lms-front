import { api } from './client';

export async function getAssignments(params = {}) {
  try {
    const response = await api.get('/assignments/', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load assignments');
  }
}

export async function getAssignment(assignmentId: string): Promise<any> {
  try {
    console.log('Fetching assignment with ID:', assignmentId);
    const response = await api.get(`/assignments/${assignmentId}`);
    console.log('Assignment response:', response.data);
    return response.data;
  } catch (error) {
    console.error('getAssignment error:', error);
    throw new Error('Failed to load assignment');
  }
}

export async function getAssignedLessonsForCourse(courseId: string): Promise<Array<{
  lesson_id: number;
  assignment_id: number;
  assignment_title: string;
  group_id: number;
  group_name: string;
  created_at: string;
}>> {
  try {
    const response = await api.get(`/assignments/assigned-lessons/${courseId}`);
    return response.data;
  } catch (error) {
    console.error('getAssignedLessonsForCourse error:', error);
    return [];
  }
}

export async function createAssignment(assignmentData: {
  title: string;
  description: string;
  assignment_type: string;
  content: any;
  max_score: number;
  time_limit_minutes?: number;
  due_date?: string;
  group_id?: number;
  group_ids?: number[];
  event_id?: number;
  event_mapping?: Record<number, number>;
  allowed_file_types: string[];
  max_file_size_mb: number;
}): Promise<any> {
  try {
    const response = await api.post('/assignments/', assignmentData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to create assignment');
  }
}

export async function updateAssignment(assignmentId: string, assignmentData: any): Promise<any> {
  try {
    const response = await api.put(`/assignments/${assignmentId}`, assignmentData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to update assignment');
  }
}

export async function submitAssignment(assignmentId: string, submissionData: any): Promise<any> {
  try {
    const response = await api.post(`/assignments/${assignmentId}/submit`, submissionData);
    return response.data;
  } catch (error) {
    throw new Error('Failed to submit assignment');
  }
}

export async function getMySubmissions(courseId = null) {
  try {
    const params = courseId ? { course_id: courseId } : {};
    const response = await api.get('/assignments/submissions/my', { params });
    return response.data;
  } catch (error) {
    throw new Error('Failed to load my submissions');
  }
}

export async function getUnseenGradedCount(): Promise<{ count: number }> {
  try {
    const response = await api.get('/assignments/submissions/unseen-graded-count');
    return response.data;
  } catch (error) {
    console.warn('Failed to get unseen graded count:', error);
    return { count: 0 };
  }
}

export async function markSubmissionSeen(submissionId: number): Promise<void> {
  try {
    await api.put(`/assignments/submissions/${submissionId}/mark-seen`);
  } catch (error) {
    console.warn('Failed to mark submission as seen:', error);
  }
}

export async function getAssignmentSubmissions(assignmentId: string) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/submissions`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load assignment submissions');
  }
}

export async function getSubmission(assignmentId: string, submissionId: string) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/submissions/${submissionId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load submission details');
  }
}

export async function debugSubmissions(assignmentId: string) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/debug-submissions`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to debug submissions');
  }
}

export async function debugDeleteSubmission(assignmentId: string, submissionId: string) {
  try {
    const response = await api.delete(`/assignments/${assignmentId}/debug-delete-submission/${submissionId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to delete submission');
  }
}

export async function gradeSubmission(assignmentId: string, submissionId: string, score: number, feedback?: string) {
  try {
    const response = await api.put(`/assignments/${assignmentId}/submissions/${submissionId}/grade`, {
      score,
      feedback
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to grade submission');
  }
}

export async function toggleAssignmentVisibility(assignmentId: string) {
  try {
    const response = await api.patch(`/assignments/${assignmentId}/toggle-visibility`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to toggle assignment visibility');
  }
}

export async function grantExtension(assignmentId: string, studentId: number, extendedDeadline: string, reason?: string) {
  try {
    const response = await api.post(`/assignments/${assignmentId}/extensions`, {
      student_id: studentId,
      extended_deadline: extendedDeadline,
      reason
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to grant extension');
  }
}

export async function getAssignmentExtensions(assignmentId: string) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/extensions`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load extensions');
  }
}

export async function revokeExtension(assignmentId: string, studentId: number) {
  try {
    const response = await api.delete(`/assignments/${assignmentId}/extensions/${studentId}`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to revoke extension');
  }
}

export async function getMyExtension(assignmentId: string) {
  try {
    const response = await api.get(`/assignments/${assignmentId}/my-extension`);
    return response.data;
  } catch (error) {
    return null;
  }
}

export async function getAssignmentStatusForStudent(assignmentId: string): Promise<any> {
  try {
    const response = await api.get(`/assignments/${assignmentId}/status`);
    return response.data;
  } catch (error) {
    console.error('getAssignmentStatusForStudent error:', error);
    return { status: 'not_started', attempts_left: 1, late: false };
  }
}

export async function getAssignmentStudentProgress(assignmentId: string): Promise<any> {
  try {
    const response = await api.get(`/assignments/${assignmentId}/student-progress`);
    return response.data;
  } catch (error) {
    throw new Error('Failed to load assignment student progress');
  }
}

export async function allowResubmission(submissionId: string | number): Promise<any> {
  try {
    const response = await api.put(`/assignments/submissions/${submissionId}/allow-resubmit`);
    return response.data;
  } catch (error) {
    console.error('Failed to allow resubmission:', error);
    throw error;
  }
}

export async function getPendingSubmissions() {
  try {
    const response = await api.get('/dashboard/teacher/pending-submissions');
    return response.data.pending_submissions || [];
  } catch (error) {
    console.warn('Failed to load pending submissions:', error);
    return [];
  }
}

export async function getRecentSubmissions(limit: number = 10) {
  try {
    const response = await api.get(`/dashboard/teacher/recent-submissions?limit=${limit}`);
    return response.data.recent_submissions || [];
  } catch (error) {
    console.warn('Failed to load recent submissions:', error);
    return [];
  }
}

export async function getTeacherStudentsProgress() {
  try {
    const response = await api.get('/dashboard/teacher/students-progress');
    return response.data.students_progress || [];
  } catch (error) {
    console.warn('Failed to load students progress:', error);
    return [];
  }
}

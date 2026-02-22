import { api, API_BASE_URL } from './client';

export async function uploadAssignmentFile(assignmentId: string, file: File): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    formData.append('file', file);
    const response = await api.post('/media/assignments/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload assignment file');
  }
}

export async function uploadTeacherFile(file: File): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'teacher_assignment');
    const response = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload teacher file');
  }
}

export async function uploadSubmissionFile(assignmentId: string, file: File): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    formData.append('file', file);
    const response = await api.post('/media/submissions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload submission file');
  }
}

export async function uploadQuestionMedia(file: File): Promise<{
  file_url: string;
  filename: string;
  original_filename: string;
  file_size: number;
}> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'question_media');
    const response = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload question media file');
  }
}

export async function downloadFile(fileType: string, filename: string): Promise<Blob> {
  try {
    const response = await api.get(`/media/files/${fileType}/${filename}`, {
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to download file');
  }
}

export function getFileUrl(fileType: string, filename: string): string {
  return `${API_BASE_URL}/media/files/${fileType}/${filename}`;
}

export async function uploadFile(formData: FormData, courseId: string): Promise<any> {
  try {
    const response = await api.post(`/media/courses/${courseId}/thumbnail`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new Error('Failed to upload file');
  }
}

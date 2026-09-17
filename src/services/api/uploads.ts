import { api, API_BASE_URL } from './client';
import { UploadFailedError, tooLargeReason, uploadFailureReason } from '../../lib/uploadFailure';

/** POST a file, refusing it up front when it is over the size limit, and fail with the real reason. */
async function postFile<T>(url: string, formData: FormData, file: File): Promise<T> {
  const tooLarge = tooLargeReason(file);
  if (tooLarge) throw new UploadFailedError(file.name, tooLarge);
  try {
    const response = await api.post(url, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw new UploadFailedError(file.name, uploadFailureReason(error));
  }
}

export async function uploadAssignmentFile(assignmentId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('assignment_id', assignmentId);
  formData.append('file', file);
  return postFile('/media/assignments/upload', formData, file);
}

export async function uploadTeacherFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', 'teacher_assignment');
  return postFile('/media/upload', formData, file);
}

export async function uploadSubmissionFile(assignmentId: string, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('assignment_id', assignmentId);
  formData.append('file', file);
  return postFile('/media/submissions/upload', formData, file);
}

export async function uploadQuestionMedia(file: File): Promise<{
  file_url: string;
  filename: string;
  original_filename: string;
  file_size: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('file_type', 'question_media');
  return postFile('/media/upload', formData, file);
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

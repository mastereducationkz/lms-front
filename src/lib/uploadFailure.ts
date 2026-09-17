// Why an upload failed, in words a teacher or student can act on. The upload helpers used to
// replace every failure with «Failed to upload teacher file», and the homework builder then
// showed «Failed to upload PDF for task:» with no reason at all.

/** The backend's and nginx's request body limit. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const MB = 1024 * 1024;

export class UploadFailedError extends Error {
  constructor(readonly fileName: string, readonly reason: string) {
    super(`Couldn't upload «${fileName}»: ${reason}`);
    this.name = 'UploadFailedError';
  }
}

/** A reason to refuse a file before sending it, or null. Past the limit nginx answers 413 without
 * CORS headers, which the browser reports as a bare network error. */
export function tooLargeReason(file: Pick<File, 'size'>): string | null {
  if (file.size <= MAX_UPLOAD_BYTES) return null;
  return `the file is ${Math.round(file.size / MB)} MB; the limit is ${MAX_UPLOAD_BYTES / MB} MB`;
}

/** The homework builder's error for a task whose file failed: which task, which file, and why. */
export function taskUploadMessage(taskIndex: number, title: string | undefined, error: unknown): string {
  const name = title?.trim();
  const task = name ? `Task ${taskIndex + 1} «${name}»` : `Task ${taskIndex + 1}`;
  const why = error instanceof Error && error.message ? error.message : 'the file could not be uploaded';
  return `${task}: ${why}`;
}

type AxiosLike = {
  isAxiosError?: boolean;
  code?: string;
  message?: string;
  config?: { uploadStalled?: boolean };
  response?: { status: number; data?: unknown };
};

function serverDetail(data: unknown): string | null {
  const detail = (data as { detail?: unknown } | null | undefined)?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && typeof detail[0]?.msg === 'string') return detail[0].msg;
  return null;
}

export function uploadFailureReason(error: unknown): string {
  const e = (error ?? {}) as AxiosLike;
  if (e.config?.uploadStalled) {
    return 'the upload stopped for 2 minutes; check the internet connection and try again';
  }
  const status = e.response?.status;
  if (status === 413) return `the file is larger than ${MAX_UPLOAD_BYTES / MB} MB`;
  if (status === 401) return 'your session has expired; sign in again and retry';
  const detail = serverDetail(e.response?.data);
  if (detail) return detail;
  if (status && status >= 500) return `the server could not save it (error ${status}); try again in a minute`;
  if (status) return `the server refused it (error ${status})`;
  if (e.code === 'ECONNABORTED') return 'the server took too long to answer; try again';
  if (e.code === 'ERR_NETWORK' || (e.isAxiosError && !e.response && e.code !== 'ERR_CANCELED')) {
    return 'the connection to the server was lost; check the internet connection and try again';
  }
  if (e.code === 'ERR_CANCELED') return 'the upload was cancelled';
  return (error instanceof Error && error.message) || e.message || 'unknown error';
}

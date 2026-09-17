import type { AxiosProgressEvent, InternalAxiosRequestConfig } from 'axios';

// A file upload fails only when nothing moves for this long, never at a fixed total time. The
// instance's 20 s timeout covered the whole request, so any file that took longer to send and
// save was aborted by the browser (nginx 499): on 17.09 a teacher's ~17 MB PDF failed four times.
// The window also covers the server saving the file after the last byte arrives.
export const UPLOAD_STALL_MS = 120_000;

type ProgressHandler = (event: AxiosProgressEvent) => void;

export type UploadRequestConfig = InternalAxiosRequestConfig & {
  /** Set when the watchdog aborted the request, so the error can say why. */
  uploadStalled?: boolean;
  /** Clears the watchdog once the request has settled. */
  stopUploadWatch?: () => void;
  /** The progress handler the caller passed, kept so a retry does not wrap our own. */
  callerUploadProgress?: ProgressHandler;
};

/** Replace the fixed timeout of an upload with an abort after `stallMs` without progress. */
export function watchUpload(config: UploadRequestConfig, stallMs = UPLOAD_STALL_MS): UploadRequestConfig {
  const alreadyWatched = typeof config.stopUploadWatch === 'function';
  if (config.signal && !alreadyWatched) return config; // the caller controls cancellation
  if (alreadyWatched) {
    config.stopUploadWatch!(); // a retry after a token refresh re-arms with a fresh signal
  } else {
    config.callerUploadProgress = config.onUploadProgress;
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      config.uploadStalled = true;
      controller.abort();
    }, stallMs);
  };

  config.onUploadProgress = (event: AxiosProgressEvent) => {
    arm();
    config.callerUploadProgress?.(event);
  };
  config.timeout = 0;
  config.uploadStalled = false;
  config.signal = controller.signal;
  config.stopUploadWatch = () => clearTimeout(timer);
  arm();
  return config;
}

import { describe, expect, it } from 'vitest';

import {
  MAX_UPLOAD_BYTES,
  UploadFailedError,
  taskUploadMessage,
  tooLargeReason,
  uploadFailureReason,
} from './uploadFailure';

const httpError = (status: number, data?: unknown) => ({ isAxiosError: true, response: { status, data } });

describe('uploadFailureReason', () => {
  it("shows the server's own explanation", () => {
    expect(uploadFailureReason(httpError(400, { detail: 'Unsupported file extension: pptx' })))
      .toBe('Unsupported file extension: pptx');
  });

  it('reads the first message of a validation error', () => {
    expect(uploadFailureReason(httpError(422, { detail: [{ msg: 'Field required', loc: ['body', 'file'] }] })))
      .toBe('Field required');
  });

  it('explains a stalled upload (what happened to Arsen on 17.09) as a connection problem', () => {
    expect(uploadFailureReason({ isAxiosError: true, code: 'ERR_CANCELED', config: { uploadStalled: true } }))
      .toMatch(/stopped for 2 minutes.*internet connection/);
  });

  it('explains a lost connection', () => {
    expect(uploadFailureReason({ isAxiosError: true, code: 'ERR_NETWORK', message: 'Network Error' }))
      .toMatch(/connection to the server was lost/);
  });

  it('explains a request that timed out instead of calling it a lost connection', () => {
    expect(uploadFailureReason({ isAxiosError: true, code: 'ECONNABORTED', message: 'timeout of 20000ms exceeded' }))
      .toMatch(/took too long/);
  });

  it('explains the size limit', () => {
    expect(uploadFailureReason(httpError(413))).toMatch(/larger than 100 MB/);
  });

  it('explains an expired session', () => {
    expect(uploadFailureReason(httpError(401, { detail: 'Invalid or expired token' }))).toMatch(/sign in again/);
  });

  it('names a server failure without a detail by its status', () => {
    expect(uploadFailureReason(httpError(502, '<html>Bad Gateway</html>'))).toMatch(/server .*502/);
  });

  it('falls back to the error message for anything else', () => {
    expect(uploadFailureReason(new Error('boom'))).toBe('boom');
    expect(uploadFailureReason(undefined)).toBe('unknown error');
  });
});

describe('tooLargeReason', () => {
  it('passes files within the limit', () => {
    expect(tooLargeReason({ size: MAX_UPLOAD_BYTES } as File)).toBeNull();
  });

  it('states the size and the limit before any bytes are sent', () => {
    expect(tooLargeReason({ size: 123.4 * 1024 * 1024 } as File)).toBe('the file is 123 MB; the limit is 100 MB');
  });
});

describe('taskUploadMessage', () => {
  const failure = new UploadFailedError('11.1) Lines & Triangles answers.pdf', 'the connection to the server was lost');

  it('names the task by number when it has no title (the builder showed «Failed to upload PDF for task:»)', () => {
    expect(taskUploadMessage(1, '', failure))
      .toBe('Task 2: Couldn\'t upload «11.1) Lines & Triangles answers.pdf»: the connection to the server was lost');
  });

  it('adds the title when the task has one', () => {
    expect(taskUploadMessage(0, '  Reading  ', failure)).toMatch(/^Task 1 «Reading»: Couldn't upload/);
  });

  it('keeps a reason even from an unexpected error', () => {
    expect(taskUploadMessage(2, undefined, 'weird')).toBe('Task 3: the file could not be uploaded');
  });
});

describe('UploadFailedError', () => {
  it('names the file and the reason', () => {
    const error = new UploadFailedError('11.1) Lines & Triangles answers.pdf', 'the connection to the server was lost');
    expect(error.message).toBe('Couldn\'t upload «11.1) Lines & Triangles answers.pdf»: the connection to the server was lost');
    expect(error.reason).toBe('the connection to the server was lost');
  });
});

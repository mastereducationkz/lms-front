import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./client', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
// `mediaUrl` reads the API host from the client module; the open call is not under test here.
vi.mock('../../lib/mediaUrl', () => ({ mediaUrl: (p: string) => `https://api.test${p}` }));

import { api } from './client';
import { LibraryUploadError, getLibrary, openLibraryItem, uploadLibraryFile } from './library';

const get = api.get as unknown as ReturnType<typeof vi.fn>;
const post = api.post as unknown as ReturnType<typeof vi.fn>;
const put = api.put as unknown as ReturnType<typeof vi.fn>;

const shelfRow = { id: 77, title: 'Book', original_name: 'Book.pdf', ext: 'pdf', mime_type: 'application/pdf', kind: 'file', size_bytes: 12, created_at: '', attached_count: 0 };

function file(size: number, name = 'Book.pdf'): File {
  return new File([new Uint8Array(size)], name, { type: 'application/pdf' });
}

function httpError(status: number, detail?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data: { detail } } });
}

beforeEach(() => {
  vi.useRealTimers();
  [get, post, put].forEach((fn) => fn.mockReset());
});

describe('uploadLibraryFile', () => {
  it('opens a session, sends every chunk in order and finishes', async () => {
    post.mockImplementation(async (url: string) => {
      if (url.endsWith('/uploads')) return { data: { upload_id: 'u1', chunk_size: 5, chunks: 3 } };
      if (url.endsWith('/uploads/u1/finish')) return { data: shelfRow };
      throw new Error(url);
    });
    put.mockResolvedValue({ data: { received: 0 } });
    const progress: number[] = [];

    const row = await uploadLibraryFile(file(12), { onProgress: (p) => progress.push(p) });

    expect(row.id).toBe(77);
    expect(post.mock.calls[0]).toEqual(['/class-materials/library/uploads', { filename: 'Book.pdf', size: 12 }]);
    expect(put.mock.calls.map((c) => c[0])).toEqual([
      '/class-materials/library/uploads/u1/chunks/0',
      '/class-materials/library/uploads/u1/chunks/1',
      '/class-materials/library/uploads/u1/chunks/2',
    ]);
    expect((put.mock.calls[2][1] as Blob).size).toBe(2);
    expect(put.mock.calls[0][2]).toMatchObject({ headers: { 'Content-Type': 'application/octet-stream' } });
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('resumes a session: asks what arrived and sends only the rest', async () => {
    get.mockResolvedValue({ data: { received: [0, 2], chunks: 3, chunk_size: 5 } });
    post.mockResolvedValue({ data: shelfRow });
    put.mockResolvedValue({ data: { received: 1 } });

    await uploadLibraryFile(file(12), { resumeId: 'u9' });

    expect(get.mock.calls[0][0]).toBe('/class-materials/library/uploads/u9');
    expect(put.mock.calls.map((c) => c[0])).toEqual(['/class-materials/library/uploads/u9/chunks/1']);
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/class-materials/library/uploads/u9/finish']);
  });

  it('starts over when the server already ended the session', async () => {
    get.mockRejectedValue(httpError(404));
    post.mockImplementation(async (url: string) => (url.endsWith('/uploads')
      ? { data: { upload_id: 'u2', chunk_size: 100, chunks: 1 } }
      : { data: shelfRow }));
    put.mockResolvedValue({ data: { received: 0 } });

    await uploadLibraryFile(file(12), { resumeId: 'gone' });

    expect(put.mock.calls.map((c) => c[0])).toEqual(['/class-materials/library/uploads/u2/chunks/0']);
  });

  it('retries a chunk after a server error, then gives up keeping the session for «Повторить»', async () => {
    vi.useFakeTimers();
    post.mockResolvedValue({ data: { upload_id: 'u3', chunk_size: 100, chunks: 1 } });
    put.mockRejectedValue(httpError(502));

    const run = uploadLibraryFile(file(12));
    const caught = run.catch((e) => e);
    await vi.runAllTimersAsync();
    const error = await caught;

    expect(put).toHaveBeenCalledTimes(3);
    expect(error).toBeInstanceOf(LibraryUploadError);
    expect((error as LibraryUploadError).uploadId).toBe('u3');
  });

  it('does not retry a refused chunk and says why', async () => {
    post.mockResolvedValue({ data: { upload_id: 'u4', chunk_size: 100, chunks: 1 } });
    put.mockRejectedValue(httpError(400, { code: 'chunk_size', message: 'Chunk 0 has the wrong size' }));

    const error = await uploadLibraryFile(file(12)).catch((e) => e);

    expect(put).toHaveBeenCalledTimes(1);
    expect((error as LibraryUploadError).reason).toBe('Chunk 0 has the wrong size');
  });

  it('refuses a file over 150 MB before sending anything', async () => {
    const big = { name: 'scan.pdf', size: 151 * 1024 * 1024, slice: () => new Blob() } as unknown as File;
    const error = await uploadLibraryFile(big).catch((e) => e);
    expect((error as LibraryUploadError).reason).toBe('File is larger than 150 MB');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('reading the library', () => {
  it('asks for the library without a trailing slash and tolerates a thin body', async () => {
    get.mockResolvedValueOnce({ data: {} });
    expect(await getLibrary()).toEqual({ programs: [], groups: [], can_create_teacher_sections: false });
    expect(get.mock.calls[0][0]).toBe('/class-materials/library');
  });

  it('turns a file open into an absolute API URL and leaves a link alone', async () => {
    post.mockResolvedValueOnce({ data: { url: '/class-materials/library/download/tok', kind: 'file', expires_at: '', mime_type: 'application/pdf', filename: 'Book.pdf' } });
    expect((await openLibraryItem(5)).url).toBe('https://api.test/class-materials/library/download/tok');
    post.mockResolvedValueOnce({ data: { url: 'https://quizlet.com/x', kind: 'link', expires_at: null, mime_type: null, filename: null } });
    expect((await openLibraryItem(6)).url).toBe('https://quizlet.com/x');
  });
});

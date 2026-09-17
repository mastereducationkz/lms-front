import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UPLOAD_STALL_MS, watchUpload, type UploadRequestConfig } from './uploadWatchdog';

const upload = (extra: Partial<UploadRequestConfig> = {}): UploadRequestConfig =>
  ({ timeout: 20000, headers: {}, data: new FormData(), ...extra }) as UploadRequestConfig;

describe('watchUpload', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('drops the fixed total timeout that aborted large files at 20 s', () => {
    const config = watchUpload(upload());
    expect(config.timeout).toBe(0);
    expect(config.signal).toBeDefined();
  });

  it('lets a slow upload run past 20 s while bytes keep moving', () => {
    const config = watchUpload(upload());
    for (let second = 0; second < 300; second += 10) {
      vi.advanceTimersByTime(10_000);
      config.onUploadProgress!({ loaded: second, bytes: 1 } as never);
    }
    expect((config.signal as AbortSignal).aborted).toBe(false);
  });

  it('aborts only when nothing has moved for the stall window, and says so', () => {
    const config = watchUpload(upload());
    vi.advanceTimersByTime(UPLOAD_STALL_MS - 1);
    config.onUploadProgress!({ loaded: 1, bytes: 1 } as never);
    vi.advanceTimersByTime(UPLOAD_STALL_MS - 1);
    expect((config.signal as AbortSignal).aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect((config.signal as AbortSignal).aborted).toBe(true);
    expect(config.uploadStalled).toBe(true);
  });

  it("still calls the caller's own progress handler", () => {
    const seen: number[] = [];
    const config = watchUpload(upload({ onUploadProgress: (event) => seen.push(event.loaded) }));
    config.onUploadProgress!({ loaded: 42, bytes: 42 } as never);
    expect(seen).toEqual([42]);
  });

  it('never fires after the request has finished', () => {
    const config = watchUpload(upload());
    config.stopUploadWatch!();
    vi.advanceTimersByTime(UPLOAD_STALL_MS * 2);
    expect((config.signal as AbortSignal).aborted).toBe(false);
  });

  it("leaves a request alone when the caller controls cancellation", () => {
    const own = new AbortController();
    const config = watchUpload(upload({ signal: own.signal }));
    expect(config.signal).toBe(own.signal);
    expect(config.timeout).toBe(20000);
  });

  it('re-arms with a fresh signal when the same request is retried after a token refresh', () => {
    const config = watchUpload(upload());
    const first = config.signal;
    config.stopUploadWatch!();
    watchUpload(config);
    expect(config.signal).not.toBe(first);
    vi.advanceTimersByTime(UPLOAD_STALL_MS);
    expect((config.signal as AbortSignal).aborted).toBe(true);
  });
});

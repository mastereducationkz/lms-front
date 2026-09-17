import { describe, expect, it, vi } from 'vitest';

import { createUploadCache } from './uploadOnce';

const aFile = (name: string) => ({ name }) as File;

describe('createUploadCache', () => {
  it('sends a file once, however many times Save is pressed', async () => {
    const cache = createUploadCache();
    const send = vi.fn(async (file: File) => ({ file_url: `/uploads/${file.name}` }));
    const pdf = aFile('answers.pdf');

    expect(await cache.upload(pdf, send)).toEqual({ file_url: '/uploads/answers.pdf' });
    expect(await cache.upload(pdf, send)).toEqual({ file_url: '/uploads/answers.pdf' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('sends a file the teacher picked instead of the old one', async () => {
    const cache = createUploadCache();
    const send = vi.fn(async (file: File) => ({ file_url: `/uploads/${file.name}` }));

    await cache.upload(aFile('first.pdf'), send);
    await cache.upload(aFile('second.pdf'), send);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries a file whose upload failed', async () => {
    const cache = createUploadCache();
    const pdf = aFile('big.pdf');
    const send = vi.fn()
      .mockRejectedValueOnce(new Error('the upload stopped for 2 minutes'))
      .mockResolvedValueOnce({ file_url: '/uploads/big.pdf' });

    await expect(cache.upload(pdf, send)).rejects.toThrow('stopped');
    expect(await cache.upload(pdf, send)).toEqual({ file_url: '/uploads/big.pdf' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('shares one upload when the same file is requested twice at once', async () => {
    const cache = createUploadCache();
    const send = vi.fn(async (file: File) => ({ file_url: `/uploads/${file.name}` }));
    const pdf = aFile('shared.pdf');

    const [first, second] = await Promise.all([cache.upload(pdf, send), cache.upload(pdf, send)]);
    expect(first).toBe(second);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

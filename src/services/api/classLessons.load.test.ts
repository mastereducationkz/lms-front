import { describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('./client', () => ({ api: { get: (...a: unknown[]) => get(...a) } }));

import { getLesson, LessonLoadError } from './classLessons';

describe('getLesson failure message', () => {
  it('carries no hard-coded English text when the server sends no detail', async () => {
    get.mockRejectedValueOnce({ response: { status: 500 } });
    const err = await getLesson(1).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LessonLoadError);
    expect((err as LessonLoadError).message).toBe('');
    expect((err as LessonLoadError).status).toBe(500);
  });

  it('keeps the server detail when there is one', async () => {
    get.mockRejectedValueOnce({ response: { status: 409, data: { detail: 'Урок отменён' } } });
    const err = (await getLesson(1).catch((e: unknown) => e)) as LessonLoadError;
    expect(err.message).toBe('Урок отменён');
  });
});

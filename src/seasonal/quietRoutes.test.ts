import { describe, expect, it } from 'vitest';
import { isQuietRoute } from './quietRoutes';

describe('isQuietRoute — screens a season never decorates (owner, 2026-10-26)', () => {
  it.each([
    '/quiz/12',
    '/homework/40',
    '/homework/40/record',
    '/lecture/7',
    '/assignment-zero',
    '/review',
    '/live/present/91',
    '/course/3/lesson/9/practice-print',
    '/meet-addon/link',
    '/watch/abc',
  ])('keeps %s plain', (path) => {
    expect(isQuietRoute(path)).toBe(true);
  });

  it.each([
    '/dashboard',
    '/courses',
    '/calendar',
    '/homework',
    '/homework/new',
    '/chat',
    '/achievements',
    '/curator/students',
    '/login',
    '/w/sat-open-day',
  ])('decorates %s', (path) => {
    expect(isQuietRoute(path)).toBe(false);
  });
});

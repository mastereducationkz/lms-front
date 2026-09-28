import { describe, expect, it } from 'vitest';
import { LMS_ORIGIN, lessonPath, lessonUrl } from './lessonLinks';

describe('lessonPath', () => {
  it('opens the lesson page', () => {
    expect(lessonPath(123)).toBe('/lessons/123');
  });
  it('lands on a section', () => {
    expect(lessonPath(123, 'materials')).toBe('/lessons/123#materials');
    expect(lessonPath(7, 'homework')).toBe('/lessons/7#homework');
  });
});

describe('lessonUrl', () => {
  it('is the production address the backend writes too', () => {
    expect(LMS_ORIGIN).toBe('https://lms.mastereducation.kz');
    expect(lessonUrl(123)).toBe('https://lms.mastereducation.kz/lessons/123');
    expect(lessonUrl(123, 'recording')).toBe('https://lms.mastereducation.kz/lessons/123#recording');
  });
});

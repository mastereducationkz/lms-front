import { describe, expect, it } from 'vitest';
import { absoluteUrl, lessonsApi, pickLesson, type LessonBrief } from './lessons';

const brief = (id: number): LessonBrief => ({ id, title: `Lesson ${id}`, start: '2026-09-28T13:00:00Z', end: '2026-09-28T14:00:00Z', status: 'finished' });

describe('pickLesson', () => {
  it('opens the lesson running in the Meet', () => {
    expect(pickLesson({ code: 'abc-defg-hij', lesson: brief(7), previous: brief(6), next: brief(8) })).toEqual({ kind: 'lesson', id: 7 });
  });

  it('offers the previous and next lesson when none runs now', () => {
    expect(pickLesson({ code: 'abc-defg-hij', lesson: null, previous: brief(6), next: brief(8) }))
      .toEqual({ kind: 'none', previous: brief(6), next: brief(8) });
  });

  it('offers nothing for a Meet link that belongs to no lesson', () => {
    expect(pickLesson({ code: 'abc-defg-hij', lesson: null, previous: null, next: null }))
      .toEqual({ kind: 'none', previous: null, next: null });
  });
});

describe('absoluteUrl', () => {
  it('puts a file download on the API host and leaves a link alone', () => {
    expect(absoluteUrl('/class-materials/download/tok', 'https://api.test')).toBe('https://api.test/class-materials/download/tok');
    expect(absoluteUrl('https://docs.google.com/x', 'https://api.test')).toBe('https://docs.google.com/x');
  });
});

describe('lessonsApi', () => {
  it('calls the lesson page endpoints with the shapes they expect', async () => {
    const seen: { path: string; init?: RequestInit }[] = [];
    const api = lessonsApi({
      request: async <T,>(path: string, init?: RequestInit) => {
        seen.push({ path, init });
        return (path.endsWith('/open') ? { url: '/class-materials/download/t', kind: 'file' } : null) as T;
      },
    });
    await api.byMeetCode('abc-defg-hij');
    await api.lesson(5);
    await api.saveNote(5, 'summary', 'Recap');
    await api.saveScores(5, [{ student_id: 9, activity_score: 7 }]);
    await api.materials(5);
    const opened = await api.openMaterial(3);
    expect(seen.map((s) => [s.path, s.init?.method ?? 'GET', s.init?.body ?? null])).toEqual([
      ['/lessons/by-meet-code/abc-defg-hij', 'GET', null],
      ['/lessons/5', 'GET', null],
      ['/lessons/5/notes/summary', 'PUT', JSON.stringify({ text: 'Recap' })],
      ['/events/5/activity-scores', 'PUT', JSON.stringify({ scores: [{ student_id: 9, activity_score: 7 }] })],
      ['/class-materials/events/5/items', 'GET', null],
      ['/class-materials/items/3/open', 'POST', null],
    ]);
    expect(opened.url).toMatch(/\/class-materials\/download\/t$/);
    expect(opened.url.startsWith('/')).toBe(false);
  });
});

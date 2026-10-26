import { describe, expect, it } from 'vitest';
import { HUNT_SIZE, markFound, readFound, spotFor } from './hunt';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => { data.delete(k); },
    setItem: (k, v) => { data.set(k, String(v)); },
  };
}

describe('spotFor — five pumpkins per role, on pages that role really opens', () => {
  it.each(['student', 'parent', 'teacher', 'curator', 'head_curator', 'head_teacher', 'admin'])(
    'gives %s exactly five distinct pages',
    (role) => {
      const pages = ['/dashboard', '/courses', '/calendar', '/achievements', '/chat', '/profile', '/settings',
        '/homework', '/teacher/class', '/curator/students', '/curator/leaderboard', '/curator/homeworks',
        '/analytics', '/admin/users', '/materials', '/recordings']
        .filter((p) => spotFor(role, p));
      expect(pages).toHaveLength(HUNT_SIZE);
    },
  );

  it('hides a student pumpkin on the dashboard but not on a page students never get', () => {
    expect(spotFor('student', '/dashboard')).not.toBeNull();
    expect(spotFor('student', '/admin/users')).toBeNull();
  });

  it('matches the page itself, not pages under it', () => {
    expect(spotFor('student', '/courses')).not.toBeNull();
    expect(spotFor('student', '/courses/12')).toBeNull();
  });

  it('has no spots for a missing role', () => {
    expect(spotFor(undefined, '/dashboard')).toBeNull();
  });
});

describe('hunt progress on this device', () => {
  it('starts empty', () => {
    expect(readFound(memoryStorage(), 7)).toEqual([]);
  });

  it('counts each pumpkin once and says when the fifth is found', () => {
    const storage = memoryStorage();
    expect(markFound(storage, 7, '/dashboard')).toEqual({ found: 1, isNew: true, complete: false });
    expect(markFound(storage, 7, '/dashboard')).toEqual({ found: 1, isNew: false, complete: false });
    ['/courses', '/achievements', '/chat'].forEach((p) => markFound(storage, 7, p));
    expect(markFound(storage, 7, '/profile')).toEqual({ found: 5, isNew: true, complete: true });
  });

  it('keeps each person on a shared device apart', () => {
    const storage = memoryStorage();
    markFound(storage, 7, '/dashboard');
    expect(readFound(storage, 8)).toEqual([]);
  });

  it('shrugs off a corrupted entry', () => {
    const storage = memoryStorage();
    storage.setItem('seasonal:halloween-2026:hunt:7', '{not json');
    expect(readFound(storage, 7)).toEqual([]);
  });

  it('still answers when storage is unavailable', () => {
    expect(readFound(null, 7)).toEqual([]);
    expect(markFound(null, 7, '/dashboard')).toEqual({ found: 1, isNew: true, complete: false });
  });
});

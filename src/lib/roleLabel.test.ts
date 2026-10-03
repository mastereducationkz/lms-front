import { describe, expect, it } from 'vitest';
import { roleLabel } from './roleLabel';

describe('roleLabel', () => {
  it('names every known role', () => {
    expect(roleLabel('head_teacher')).toBe('Head Teacher');
    expect(roleLabel('teacher')).toBe('Teacher');
    expect(roleLabel('admin')).toBe('Admin');
    expect(roleLabel('student')).toBe('Student');
    expect(roleLabel('parent')).toBe('Parent');
    expect(roleLabel('curator')).toBe('Куратор');
    expect(roleLabel('head_curator')).toBe('Руководитель кураторов');
  });

  it('title-cases an unknown role instead of printing snake_case', () => {
    expect(roleLabel('content_manager')).toBe('Content Manager');
  });

  it('falls back for a missing role', () => {
    expect(roleLabel(undefined)).toBe('Unknown');
    expect(roleLabel('')).toBe('Unknown');
  });
});

import { describe, expect, it } from 'vitest';
import { roleLabel } from './roleLabel';

describe('roleLabel', () => {
  it('names every known role in English', () => {
    expect(roleLabel('head_teacher', 'en')).toBe('Head Teacher');
    expect(roleLabel('teacher', 'en')).toBe('Teacher');
    expect(roleLabel('admin', 'en')).toBe('Admin');
    expect(roleLabel('student', 'en')).toBe('Student');
    expect(roleLabel('parent', 'en')).toBe('Parent');
    expect(roleLabel('curator', 'en')).toBe('Curator');
    expect(roleLabel('head_curator', 'en')).toBe('Head Curator');
  });

  it('keeps the curator roles’ Russian names for a Russian reader', () => {
    expect(roleLabel('curator', 'ru')).toBe('Куратор');
    expect(roleLabel('head_curator', 'ru')).toBe('Руководитель кураторов');
  });

  it('title-cases an unknown role instead of printing snake_case', () => {
    expect(roleLabel('content_manager', 'en')).toBe('Content Manager');
  });

  it('falls back for a missing role', () => {
    expect(roleLabel(undefined, 'en')).toBe('Unknown');
    expect(roleLabel('', 'en')).toBe('Unknown');
  });
});

import { describe, expect, it } from 'vitest';
import {
  canEditCourseContent, canManageCourseAccess, filterCatalog, isReadOnlyCourseViewer, isStaffPreview,
  seesCorrectAnswers, sortStaffCatalog,
} from './courseAccess';

const ROLES = ['student', 'parent', 'curator', 'head_curator', 'teacher', 'head_teacher', 'admin'];

describe('course content roles', () => {
  it('only admins and head teachers edit', () => {
    expect(ROLES.filter(canEditCourseContent)).toEqual(['head_teacher', 'admin']);
  });

  it('teachers, curators and head curators are read-only viewers', () => {
    expect(ROLES.filter(isReadOnlyCourseViewer)).toEqual(['curator', 'head_curator', 'teacher']);
  });

  it('every staff role previews without recording, admins included', () => {
    expect(ROLES.filter(isStaffPreview)).toEqual(['curator', 'head_curator', 'teacher', 'head_teacher', 'admin']);
    expect(isStaffPreview(undefined)).toBe(false);
  });

  it('every staff role sees correct answers; students and parents do not', () => {
    expect(seesCorrectAnswers('curator')).toBe(true);
    expect(seesCorrectAnswers('head_curator')).toBe(true);
    expect(seesCorrectAnswers('student')).toBe(false);
    expect(seesCorrectAnswers('parent')).toBe(false);
  });

  it('only admins manage access and delete courses', () => {
    expect(ROLES.filter(canManageCourseAccess)).toEqual(['admin']);
  });
});

describe('staff catalog', () => {
  const courses = [
    { title: 'SAT Math', in_my_groups: false },
    { title: 'IELTS', in_my_groups: true },
    { title: 'Algebra', in_my_groups: null },
    { title: 'SAT Verbal', in_my_groups: true },
  ];

  it('puts the viewer\'s own groups first, then sorts by title', () => {
    expect(sortStaffCatalog(courses).map((c) => c.title)).toEqual(['IELTS', 'SAT Verbal', 'Algebra', 'SAT Math']);
  });

  it('does not mutate its input', () => {
    const copy = [...courses];
    sortStaffCatalog(courses);
    expect(courses).toEqual(copy);
  });

  it('filters by title, case-insensitively, Cyrillic included', () => {
    expect(filterCatalog(courses, 'sat').map((c) => c.title)).toEqual(['SAT Math', 'SAT Verbal']);
    expect(filterCatalog([{ title: 'Математика' }], 'МАТЕ')).toHaveLength(1);
    expect(filterCatalog(courses, '  ')).toHaveLength(4);
  });
});

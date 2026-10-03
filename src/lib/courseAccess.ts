// Who may do what with course content — owner decisions 2026-10-03, mirrored from the backend's
// src/utils/permissions.py (is_course_content_editor / can_view_course_content / records_progress).
//
// - Admins and head teachers edit every course (content, structure, publish).
// - Teachers, curators and head curators read every published course, read-only.
// - Only students leave progress behind; every staff role previews without recording anything.

export const COURSE_CONTENT_EDITOR_ROLES = ['admin', 'head_teacher'] as const;
export const COURSE_CONTENT_VIEWER_ROLES = ['teacher', 'curator', 'head_curator'] as const;

const has = (list: readonly string[], role?: string | null) => !!role && list.includes(role);

export function canEditCourseContent(role?: string | null): boolean {
  return has(COURSE_CONTENT_EDITOR_ROLES, role);
}

/** Read-only staff: they see every lesson but get no edit affordances. */
export function isReadOnlyCourseViewer(role?: string | null): boolean {
  return has(COURSE_CONTENT_VIEWER_ROLES, role);
}

/** Any staff role previewing content: no progress, attempts or completions are sent. */
export function isStaffPreview(role?: string | null): boolean {
  return !!role && role !== 'student' && role !== 'parent';
}

/** Deleting a whole course and deciding which groups/teachers get it stay with admins. */
export function canManageCourseAccess(role?: string | null): boolean {
  return role === 'admin';
}

/** Correct answers in the quiz player: every staff role (students only after passing). */
export function seesCorrectAnswers(role?: string | null): boolean {
  return isStaffPreview(role);
}

/** Russian copy for curator roles, English for everyone else — same rule as the sidebar. */
export function usesRussianUi(role?: string | null): boolean {
  return role === 'curator' || role === 'head_curator';
}

export interface CatalogCourse {
  title: string;
  in_my_groups?: boolean | null;
}

/** Staff catalog order: courses the viewer's own groups study first, then by title. */
export function sortStaffCatalog<T extends CatalogCourse>(courses: T[]): T[] {
  return [...courses].sort((a, b) => {
    const mine = Number(!!b.in_my_groups) - Number(!!a.in_my_groups);
    if (mine !== 0) return mine;
    return (a.title || '').localeCompare(b.title || '', 'ru');
  });
}

export function filterCatalog<T extends CatalogCourse>(courses: T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase('ru');
  if (!q) return courses;
  return courses.filter((c) => (c.title || '').toLocaleLowerCase('ru').includes(q));
}

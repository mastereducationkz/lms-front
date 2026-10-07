// Shared helpers for the group picker used by the Curator Leaderboard and the
// Teacher Attendance pages, so both offer the same subject/date/teacher search.
import type { CourseType, Group } from '../types';
import { activeLocale, t, type Locale } from './i18n';
import '@/lib/i18n/catalogs/shell';

export const PROGRAM_LABELS: Record<CourseType, string> = {
  sat: 'SAT',
  ielts: 'IELTS',
  nuet: 'NUET',
  general_english: 'General English',
};

export const PROGRAM_BADGE_STYLES: Record<CourseType, string> = {
  sat: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ielts: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  nuet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  general_english: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
};

// Resolve a group's program from its stored program_type, falling back to
// keyword detection in the name.
export const getGroupProgramType = (group: Group): CourseType => {
  const stored = group.program_type as CourseType | undefined;
  if (stored === 'sat' || stored === 'ielts' || stored === 'nuet') return stored;

  const name = group.name || '';
  if (/\bielts\b/i.test(name)) return 'ielts';
  if (/\bnuet\b/i.test(name)) return 'nuet';
  if (/\bsat\b/i.test(name)) return 'sat';

  return stored || 'general_english';
};

// Label: strip the trailing " - Xxx" teacher-first-name suffix from the group
// name, then append the teacher's full name. e.g. "IELTS June 10 - Kamila" +
// "Kamila B" -> "IELTS June 10 - Kamila B"
export const formatGroupLabel = (group: Group): string => {
  const rawName = group.name || '';
  const sepIndex = rawName.lastIndexOf(' - ');
  const base = sepIndex !== -1 ? rawName.slice(0, sepIndex).trim() : rawName.trim();
  const teacher = (group.teacher_name || '').trim();
  return teacher ? `${base} - ${teacher}` : base;
};

// Subject/date portion (label minus trailing teacher suffix and minus the
// program keyword, which is shown as a badge instead). e.g. "June 38 SAT" -> "June 38"
export const getGroupDateText = (group: Group): string => {
  const rawName = group.name || '';
  const sepIndex = rawName.lastIndexOf(' - ');
  let base = sepIndex !== -1 ? rawName.slice(0, sepIndex).trim() : rawName.trim();
  const program = getGroupProgramType(group);
  if (program !== 'general_english') {
    base = base
      .replace(new RegExp(`\\b${PROGRAM_LABELS[program]}\\b`, 'i'), '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return base || rawName;
};

// The word for "groups" after a count, in the reader's language: group/groups, группа/группы/групп.
// New code should prefer the whole phrase, t('common.groups', { count }).
export const pluralizeGroups = (n: number, locale: Locale = activeLocale()): string =>
  t('shell.groups.word', { count: n }, locale);

export const sortGroupsByCreatedAt = (items: Group[]): Group[] =>
  [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

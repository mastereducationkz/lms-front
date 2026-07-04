// Shared helpers for the group picker used by the Curator Leaderboard and the
// Teacher Attendance pages, so both offer the same subject/date/teacher search.
import type { CourseType, Group } from '../types';

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

// Label: strip the leading "Xxx - " prefix from the group name, then append the
// teacher's full name. e.g. "Kamila - IELTS June 10" + "Kamila B" -> "IELTS June 10 - Kamila B"
export const formatGroupLabel = (group: Group): string => {
  const rawName = group.name || '';
  const sepIndex = rawName.indexOf(' - ');
  const base = sepIndex !== -1 ? rawName.slice(sepIndex + 3).trim() : rawName.trim();
  const teacher = (group.teacher_name || '').trim();
  return teacher ? `${base} - ${teacher}` : base;
};

// Subject/date portion (label minus leading prefix and minus the program keyword,
// which is shown as a badge instead). e.g. "June 38 SAT" -> "June 38"
export const getGroupDateText = (group: Group): string => {
  const rawName = group.name || '';
  const sepIndex = rawName.indexOf(' - ');
  let base = sepIndex !== -1 ? rawName.slice(sepIndex + 3).trim() : rawName.trim();
  const program = getGroupProgramType(group);
  if (program !== 'general_english') {
    base = base
      .replace(new RegExp(`\\b${PROGRAM_LABELS[program]}\\b`, 'i'), '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  return base || rawName;
};

// Russian plural for "групп": 1 группа, 2-4 группы, 5+ групп
export const pluralizeGroups = (n: number): string => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'группа';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'группы';
  return 'групп';
};

export const sortGroupsByCreatedAt = (items: Group[]): Group[] =>
  [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

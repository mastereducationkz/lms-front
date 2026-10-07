import { activeLocale, t, type Locale, type MessageKey } from './i18n';

/** Human names for user roles, shown wherever a role is displayed (never the raw `head_teacher`),
 *  in the viewer's language: an admin reads "Curator", a head curator «Куратор». */
const ROLE_KEYS: Record<string, MessageKey> = {
  admin: 'shell.role.admin',
  head_teacher: 'shell.role.headTeacher',
  teacher: 'shell.role.teacher',
  head_curator: 'shell.role.headCurator',
  curator: 'shell.role.curator',
  student: 'shell.role.student',
  parent: 'shell.role.parent',
};

export function roleLabel(role: string | null | undefined, locale: Locale = activeLocale()): string {
  if (!role) return t('shell.role.unknown', undefined, locale);
  const key = ROLE_KEYS[role];
  return key ? t(key, undefined, locale) : role.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

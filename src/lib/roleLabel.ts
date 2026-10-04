/** Human names for user roles, shown wherever a role is displayed (never the raw `head_teacher`).
 *  Curator roles keep their Russian names: curators work in a Russian UI. */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  head_teacher: 'Head Teacher',
  teacher: 'Teacher',
  head_curator: 'Руководитель кураторов',
  curator: 'Куратор',
  student: 'Student',
  parent: 'Parent',
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return 'Unknown';
  return ROLE_LABELS[role] ?? role.split('_').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Roles offered "Add materials" on the Materials tab. Same plausibility set as the attendance
 * grid's paperclip (`materialsBadgeVariant`): the server's `can_manage` decides who actually may
 * attach to a given lesson. */
const ADD_FROM_TAB_ROLES = ['teacher', 'head_teacher', 'admin'];

export function canStartAdding(role: string | null | undefined): boolean {
  return !!role && ADD_FROM_TAB_ROLES.includes(role);
}

/** The group the lesson picker opens on: the one the feed is filtered to, else the only group the
 * viewer has, else none yet (they pick). */
export function pickerGroupFor(groups: { id: number }[], preferred: number | null): number | null {
  if (preferred !== null && groups.some((g) => g.id === preferred)) return preferred;
  return groups.length === 1 ? groups[0].id : null;
}

/** Which of the caller's groups an exam page lists: running ones, finished ones (over or archived), or both. */
export type GroupState = 'running' | 'finished' | 'all';

export const GROUP_STATES: readonly GroupState[] = ['running', 'finished', 'all'];

/**
 * What a page shows before anyone picks: the view the role always had. Roles with a group scope (teacher,
 * curator, head teacher) only ever saw running groups; admin and head curator saw every student, finished
 * ones included, so «running» would take most of their list away. The server applies the same rule when no
 * state is sent (lms-backend `default_group_state`).
 */
export function defaultGroupState(role: string | null | undefined): GroupState {
  const normal = (role ?? '').trim().toLowerCase();
  return normal === 'admin' || normal === 'head_curator' ? 'all' : 'running';
}

/** «Name — Teacher», with « · finished» after a group that is over or archived. */
export function groupOptionLabel(
  group: { name: string; teacher_name: string | null; is_finished?: boolean },
  finishedWord: string,
): string {
  const base = group.teacher_name ? `${group.name} — ${group.teacher_name}` : group.name;
  return group.is_finished ? `${base} · ${finishedWord}` : base;
}

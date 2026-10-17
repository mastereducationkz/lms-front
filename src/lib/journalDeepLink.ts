/**
 * `/attendance?groupId=X` (an owed lesson's «Все уроки группы», the dashboard card, a Telegram link)
 * must open that group even when it is finished and «Скрыть завершённые» is ticked (owner, 2026-10-17):
 * owed work follows the lesson, not the group, so the journal of a group that ended is where it is done.
 */
export function deepLinkedFinishedGroup(groups: { id: number; is_over?: boolean }[], groupIdParam: string | null): number | null {
  if (!groupIdParam) return null;
  const id = parseInt(groupIdParam, 10);
  if (!Number.isFinite(id)) return null;
  const group = groups.find((g) => g.id === id);
  return group?.is_over ? group.id : null;
}

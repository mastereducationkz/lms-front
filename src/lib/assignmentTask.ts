export function formatAssignmentTaskLabel(title: string | null | undefined, index: number): string {
  const normalizedTitle = title?.trim();
  return normalizedTitle || `Task ${index + 1}`;
}

type GroupScheduleItem = {
  day_of_week?: number
  time_of_day?: string
}

export type GroupListItem = {
  id: number | string
  name?: string
  is_over?: boolean
  schedule_config?: {
    schedule_items?: GroupScheduleItem[]
  } | null
}

export const parseTimeOfDayToMinutes = (time?: string | null): number | null => {
  if (!time || typeof time !== 'string') return null
  const match = time.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

/** Earliest weekly lesson time from group schedule (e.g. 12:00 before 14:00). */
export const getGroupLessonTimeMinutes = (group: GroupListItem): number | null => {
  const items = group.schedule_config?.schedule_items
  if (!Array.isArray(items) || items.length === 0) return null

  const times = items
    .map((item) => parseTimeOfDayToMinutes(item?.time_of_day))
    .filter((value): value is number => value !== null)

  if (times.length === 0) return null
  return Math.min(...times)
}

export const filterNonCompletedGroups = <T extends GroupListItem>(groups: T[]): T[] =>
  groups.filter((group) => !group.is_over)

export const sortGroupsByLessonTime = <T extends GroupListItem>(groups: T[]): T[] =>
  [...groups].sort((a, b) => {
    const timeA = getGroupLessonTimeMinutes(a)
    const timeB = getGroupLessonTimeMinutes(b)

    if (timeA === null && timeB === null) {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    }
    if (timeA === null) return 1
    if (timeB === null) return -1
    if (timeA !== timeB) return timeA - timeB
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  })

export const prepareTeacherGroupList = <T extends GroupListItem>(
  groups: T[],
  options?: { includeCompleted?: boolean },
): T[] => {
  const filtered = options?.includeCompleted ? groups : filterNonCompletedGroups(groups)
  return sortGroupsByLessonTime(filtered)
}

export const sortGroupEntriesByLessonTime = <
  T extends { id: string | number; name?: string },
>(
  entries: T[],
  sourceGroups: GroupListItem[],
): T[] => {
  const byId = new Map(sourceGroups.map((group) => [String(group.id), group]))

  return [...entries].sort((a, b) => {
    if (String(a.id) === 'ungrouped') return 1
    if (String(b.id) === 'ungrouped') return -1

    const groupA = byId.get(String(a.id))
    const groupB = byId.get(String(b.id))
    const timeA = groupA ? getGroupLessonTimeMinutes(groupA) : null
    const timeB = groupB ? getGroupLessonTimeMinutes(groupB) : null

    if (timeA === null && timeB === null) {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    }
    if (timeA === null) return 1
    if (timeB === null) return -1
    if (timeA !== timeB) return timeA - timeB
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
  })
}

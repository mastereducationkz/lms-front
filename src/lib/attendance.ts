const ALMATY_TZ = 'Asia/Almaty';

/** YYYY-MM-DD in Asia/Almaty — matches how lesson dates are shown in the UI. */
export const getAlmatyDateKey = (dateStr: string | Date): string => {
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-CA', { timeZone: ALMATY_TZ });
};

/**
 * Attendance can be filled for today and past lessons (Almaty calendar day).
 * Exact UTC timestamp comparison wrongly blocks morning slots when event time
 * was stored as local Almaty hour without UTC offset.
 */
export const isAttendanceLockedLesson = (dateStr: string): boolean => {
  return getAlmatyDateKey(dateStr) > getAlmatyDateKey(new Date());
};

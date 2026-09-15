import { ALMATY_TZ, splitLessonTitle, timeRange } from './recordings';

/**
 * Point a Google Meet link at the viewer's work account.
 *
 * A browser signed into several Google accounts opens Meet on whichever one it treats as
 * the default — usually a personal account, because it was added first. Both may show the
 * same name, so the teacher has no reason to think anything is wrong. But Meet then counts
 * her as outside the organisation: she cannot record, cannot remove participants, and the
 * lesson's auto-recording does not start until someone from the organisation joins. On
 * 2026-09-10 a lesson only recorded because an admin happened to join at 18:59:59.
 *
 * `authuser` tells Google which signed-in account to use. With an email rather than an
 * index it survives the browser's account order changing, and if that account is not
 * signed in, Google asks for it instead of silently falling back to another.
 *
 * Only Meet links are touched, and only for viewers who have a work account. Students
 * have none, so their links are returned unchanged.
 */
export function meetJoinUrl(url: string | null | undefined, workspaceEmail?: string | null): string {
  if (!url) return '';
  const account = workspaceEmail?.trim().toLowerCase();
  if (!account) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.hostname !== 'meet.google.com') return url;

  parsed.searchParams.set('authuser', account);
  return parsed.toString();
}

/**
 * A ready-to-send Russian invitation to one lesson, for a group chat.
 *
 * The date is absolute ("Четверг, 10 сентября"), never "today": the message is read
 * whenever someone opens the chat. The link is the lesson's own clean Meet link — never the
 * viewer's Join link, which may carry their account (?authuser=…) and would ask every
 * student to sign in as the teacher.
 */
export function meetInvitationText(lesson: {
  title: string;
  groups?: string[] | null;
  start_datetime: string;
  end_datetime: string;
  meeting_url: string;
}): string {
  const { name, lesson: number } = splitLessonTitle(
    lesson.title,
    (lesson.groups ?? []).map((g) => ({ name: g })),
    'ru',
  );
  const day = new Intl.DateTimeFormat('ru-RU', {
    timeZone: ALMATY_TZ, weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(lesson.start_datetime));
  return [
    'Приглашение на урок',
    number ? `${name}, ${number.toLowerCase()}` : name,
    `${day[0].toLocaleUpperCase()}${day.slice(1)}, ${timeRange(lesson.start_datetime, lesson.end_datetime)} (время Алматы)`,
    `Google Meet: ${lesson.meeting_url}`,
    'Подключайтесь за пару минут до начала.',
  ].join('\n');
}

/** A Google Meet room, not just any meeting URL — only Meet rooms record and take attendance. */
export function isMeetLink(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).hostname === 'meet.google.com';
  } catch {
    return false;
  }
}

export type MeetFilter = 'all' | 'with' | 'without';

/** The calendar's Google Meet filter. Class lessons only: webinars and tests have no room to set up. */
export function matchesMeetFilter(
  event: { event_type?: string | null; meeting_url?: string | null },
  filter: MeetFilter,
): boolean {
  if (filter === 'all') return true;
  if (event.event_type !== 'class') return false;
  return filter === 'with' ? isMeetLink(event.meeting_url) : !isMeetLink(event.meeting_url);
}

/** Staff see which lessons have their Meet room; a student only needs the join button. */
export function seesMeetMarks(role?: string | null): boolean {
  return role === 'admin' || role === 'head_curator' || role === 'head_teacher' || role === 'curator' || role === 'teacher';
}

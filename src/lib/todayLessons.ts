import type { LessonSection } from './lessonLinks';
import type { TodayLesson } from '../services/api/classLessons';
import { activeLocale, t, type Locale, type MessageKey, type Params } from './i18n';
import '@/lib/i18n/catalogs/teacher';

/**
 * «Today» on the teacher dashboard (owner, 2026-09-28): what each of today's lessons still needs, as short
 * chips that open the lesson page at the right section. Kept pure so the wording is tested.
 */

export type ChipTone = 'action' | 'todo' | 'info' | 'done' | 'muted';

export interface TodayChip {
  key: string;
  label: string;
  tone: ChipTone;
  /** Where on the lesson page the chip leads; none = the page itself. */
  section?: LessonSection;
}

/** The chips of one lesson, most urgent first. */
export function lessonChips(lesson: TodayLesson, locale: Locale = activeLocale()): TodayChip[] {
  const tr = (key: MessageKey, params?: Params) => t(key, params, locale);
  if (lesson.status === 'cancelled') return [{ key: 'cancelled', label: tr('teacher.today.chips.cancelled'), tone: 'muted' }];
  const chips: TodayChip[] = [];
  const reg = lesson.register;
  if (lesson.live) {
    chips.push({ key: 'room', label: tr('teacher.today.chips.inRoom', { inRoom: lesson.live.in_room, expected: lesson.live.expected }), tone: 'info' });
  }
  if (reg?.meet_marks) {
    chips.push({ key: 'meet', label: tr('teacher.today.chips.meetMarks'), tone: 'info', section: 'register' });
  } else if (lesson.todo.includes('marks') && reg) {
    chips.push({ key: 'marks', label: tr('teacher.today.chips.unmarked', { count: reg.unmarked }), tone: 'action', section: 'register' });
  }
  if (lesson.todo.includes('scores') && reg) {
    chips.push({ key: 'scores', label: tr('teacher.today.chips.scoresMissing', { count: reg.scores_missing }), tone: 'todo', section: 'register' });
  }
  if (lesson.todo.includes('homework')) {
    chips.push({ key: 'homework', label: tr('teacher.today.chips.noHomework'), tone: 'todo', section: 'homework' });
  }
  if (lesson.todo.includes('recap')) {
    chips.push({ key: 'recap', label: tr('teacher.today.chips.noRecap'), tone: 'todo', section: 'notes' });
  }
  if (lesson.recording?.status === 'ready') {
    chips.push({ key: 'recording', label: tr('teacher.today.chips.recordingReady'), tone: 'info', section: 'recording' });
  } else if (lesson.recording?.status === 'pending') {
    chips.push({ key: 'recording', label: tr('teacher.today.chips.recordingProcessing'), tone: 'muted', section: 'recording' });
  }
  if (lesson.done) chips.unshift({ key: 'done', label: tr('teacher.today.chips.allDone'), tone: 'done' });
  return chips;
}

/** The card's header line: how many lessons, what is next or on now, and how many still need something. */
export function todaySummary(lessons: TodayLesson[], now: Date, locale: Locale, clock: (iso: string) => string): string {
  const active = lessons.filter((l) => l.status !== 'cancelled');
  const parts = [t('common.lessons', { count: active.length }, locale)];
  const live = active.find((l) => l.status === 'live');
  const next = active.find((l) => l.status === 'upcoming' && new Date(l.start).getTime() > now.getTime());
  if (live) parts.push(t('teacher.today.liveNow', undefined, locale));
  else if (next) parts.push(t('teacher.today.nextAt', { time: clock(next.start) }, locale));
  const open = active.filter((l) => l.todo.length > 0 && l.status !== 'upcoming').length;
  if (open) parts.push(t('teacher.today.needYou', { count: open }, locale));
  else if (active.length && active.every((l) => l.done)) parts.push(t('teacher.today.allDoneSummary', undefined, locale));
  return parts.join(' · ');
}

/** The group line of a row: names, and the lesson's number in the (first) group. */
export function groupLine(lesson: TodayLesson, locale: Locale = activeLocale()): string {
  const names = lesson.groups.map((g) => g.name.replace(/\s+-\s+[^-]+$/, '')).join(', ') || lesson.title;
  const n = lesson.groups[0]?.lesson_number;
  return n ? `${names} · ${t('teacher.today.lessonNumber', { number: n }, locale)}` : names;
}

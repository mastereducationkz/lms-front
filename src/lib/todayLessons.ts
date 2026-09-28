import type { LessonSection } from './lessonLinks';
import type { TodayLesson } from '../services/api/classLessons';

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

type Locale = 'ru' | 'en';

const plural = (n: number, locale: Locale, ru: [string, string, string], en: [string, string]) => {
  if (locale === 'en') return `${n} ${n === 1 ? en[0] : en[1]}`;
  const m10 = n % 10, m100 = n % 100;
  const form = m10 === 1 && m100 !== 11 ? ru[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ru[1] : ru[2];
  return `${n} ${form}`;
};

/** The chips of one lesson, most urgent first. */
export function lessonChips(lesson: TodayLesson, locale: Locale): TodayChip[] {
  const t = (ru: string, en: string) => (locale === 'ru' ? ru : en);
  if (lesson.status === 'cancelled') return [{ key: 'cancelled', label: t('Урок отменён', 'Cancelled'), tone: 'muted' }];
  const chips: TodayChip[] = [];
  const reg = lesson.register;
  if (lesson.live) {
    chips.push({ key: 'room', label: t(`В комнате ${lesson.live.in_room} из ${lesson.live.expected}`,
      `${lesson.live.in_room} of ${lesson.live.expected} in the room`), tone: 'info' });
  }
  if (reg?.meet_marks) {
    chips.push({ key: 'meet', label: t('Meet отметит посещаемость', 'Meet takes the register'), tone: 'info', section: 'register' });
  } else if (lesson.todo.includes('marks') && reg) {
    chips.push({ key: 'marks', label: plural(reg.unmarked, locale, ['не отмечен', 'не отмечены', 'не отмечены'],
      ['not marked', 'not marked']), tone: 'action', section: 'register' });
  }
  if (lesson.todo.includes('scores') && reg) {
    const label = locale === 'ru' ? `Без балла: ${reg.scores_missing}`
      : plural(reg.scores_missing, 'en', ['', '', ''], ['score missing', 'scores missing']);
    chips.push({ key: 'scores', label, tone: 'todo', section: 'register' });
  }
  if (lesson.todo.includes('homework')) {
    chips.push({ key: 'homework', label: t('Нет ДЗ', 'No homework'), tone: 'todo', section: 'homework' });
  }
  if (lesson.todo.includes('recap')) {
    chips.push({ key: 'recap', label: t('Нет итогов', 'No recap'), tone: 'todo', section: 'notes' });
  }
  if (lesson.recording?.status === 'ready') {
    chips.push({ key: 'recording', label: t('Запись готова', 'Recording ready'), tone: 'info', section: 'recording' });
  } else if (lesson.recording?.status === 'pending') {
    chips.push({ key: 'recording', label: t('Запись обрабатывается', 'Recording processing'), tone: 'muted', section: 'recording' });
  }
  if (lesson.done) chips.unshift({ key: 'done', label: t('Всё готово', 'All done'), tone: 'done' });
  return chips;
}

/** The card's header line: how many lessons, what is next or on now, and how many still need something. */
export function todaySummary(lessons: TodayLesson[], now: Date, locale: Locale, clock: (iso: string) => string): string {
  const t = (ru: string, en: string) => (locale === 'ru' ? ru : en);
  const active = lessons.filter((l) => l.status !== 'cancelled');
  const parts = [plural(active.length, locale, ['урок', 'урока', 'уроков'], ['lesson', 'lessons'])];
  const live = active.find((l) => l.status === 'live');
  const next = active.find((l) => l.status === 'upcoming' && new Date(l.start).getTime() > now.getTime());
  if (live) parts.push(t('идёт урок', 'live now'));
  else if (next) parts.push(t(`следующий в ${clock(next.start)}`, `next at ${clock(next.start)}`));
  const open = active.filter((l) => l.todo.length > 0 && l.status !== 'upcoming').length;
  if (open) parts.push(t(`ждут действий: ${open}`, `${open} need${open === 1 ? 's' : ''} you`));
  else if (active.length && active.every((l) => l.done)) parts.push(t('всё готово', 'all done'));
  return parts.join(' · ');
}

/** The group line of a row: names, and the lesson's number in the (first) group. */
export function groupLine(lesson: TodayLesson, locale: Locale): string {
  const names = lesson.groups.map((g) => g.name.replace(/\s+-\s+[^-]+$/, '')).join(', ') || lesson.title;
  const n = lesson.groups[0]?.lesson_number;
  return n ? `${names} · ${locale === 'ru' ? 'урок' : 'lesson'} ${n}` : names;
}

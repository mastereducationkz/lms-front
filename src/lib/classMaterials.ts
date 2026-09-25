import { almatyDayKey, recordingsLocale, type Locale } from './recordings';
import { parseAsUTC } from './datetime';
import { MAX_UPLOAD_BYTES } from './uploadFailure';

export type { Locale };

/**
 * «Материалы урока» — per-lesson teacher files and links. This is the pure half: copy,
 * upload pre-checks, link validation and the small formatting helpers every surface (the
 * lesson pop-up, the teacher shelf, the /materials page and Telegram notices) shares. The
 * language rule mirrors recordings: curators and head curators read Russian, everyone else
 * English.
 */
export const materialsLocale = (role?: string | null): Locale => recordingsLocale(role);

export const ALLOWED_EXTS = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp3', 'm4a',
] as const;

export const VIDEO_EXTS = [
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', '3gp', 'mpeg', 'mpg',
] as const;

export const OFFICE_EXTS = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'] as const;

export const COPY = {
  sectionTitle: { ru: 'Материалы урока', en: 'Lesson materials' },
  add: { ru: 'Добавить', en: 'Add' },
  uploadFiles: { ru: 'Загрузить файлы', en: 'Upload files' },
  fromMyFiles: { ru: 'Из моих файлов', en: 'From my files' },
  copyFromLesson: { ru: 'Скопировать из урока…', en: 'Copy from a lesson…' },
  link: { ru: 'Ссылка', en: 'Link' },
  linkUrl: { ru: 'Адрес ссылки', en: 'Link address' },
  linkTitle: { ru: 'Название (необязательно)', en: 'Title (optional)' },
  googleWarning: { ru: 'Проверьте доступ: "Все, у кого есть ссылка"', en: 'Check sharing: "Anyone with the link"' },
  afterClassChip: { ru: 'после урока', en: 'after class' },
  showAfterClass: { ru: 'Показать после урока', en: 'Show after class' },
  rename: { ru: 'Переименовать', en: 'Rename' },
  detach: { ru: 'Открепить от урока', en: 'Remove from lesson' },
  moderate: { ru: 'Удалить (модерация)', en: 'Remove (moderation)' },
  reason: { ru: 'Причина удаления', en: 'Reason for removal' },
  restore: { ru: 'Восстановить', en: 'Restore' },
  removedLabel: { ru: 'Удалено модератором', en: 'Removed by a moderator' },
  empty: { ru: 'Учитель пока не добавил материалы к этому уроку', en: "The teacher hasn't added materials to this lesson yet" },
  homeworkLink: { ru: 'Домашнее задание к уроку →', en: 'Homework for this lesson →' },
  catchUp: { ru: 'Пропустили урок и не открыли материалы', en: "Missed the lesson and haven't opened the materials" },
  officeNudge: { ru: 'Загрузите PDF — его откроют прямо в браузере', en: 'Upload a PDF — it opens right in the browser' },
  topicLabel: { ru: 'Тема урока', en: 'Lesson topic' },
  topicHint: { ru: 'Предложено по названиям файлов', en: 'Suggested from file names' },
  topicPrefix: { ru: 'Тема', en: 'Topic' },
  save: { ru: 'Сохранить', en: 'Save' },
  cancel: { ru: 'Отмена', en: 'Cancel' },
  cancelledLesson: { ru: 'Урок снят с расписания', en: 'Lesson taken off the schedule' },
  pageTitle: { ru: 'Материалы', en: 'Materials' },
  search: { ru: 'Поиск по названию или теме', en: 'Search by name or topic' },
  allGroups: { ru: 'Все группы', en: 'All groups' },
  download: { ru: 'Скачать', en: 'Download' },
  openLink: { ru: 'Открыть ссылку', en: 'Open link' },
  loadMore: { ru: 'Показать ещё', en: 'Load more' },
  noMaterialsYet: { ru: 'Материалов пока нет', en: 'No materials yet' },
  searchNothing: { ru: 'Ничего не найдено', en: 'Nothing found' },
  myFilesEmpty: { ru: 'Вы ещё не загружали файлы', en: "You haven't uploaded any files yet" },
  noLessonsToCopy: { ru: 'Нет недавних уроков с материалами', en: 'No recent lessons with materials' },
  hideFromMyFiles: { ru: 'Скрыть из моих файлов', en: 'Hide from my files' },
  notifications: { ru: 'Уведомления', en: 'Notifications' },
  noNotifications: { ru: 'Новых уведомлений нет', en: 'No new notifications' },
  markAllRead: { ru: 'Отметить все прочитанными', en: 'Mark all as read' },
  too_large: { ru: 'Файл больше 50 МБ', en: 'File is larger than 50 MB' },
  unsupported_type: { ru: 'Этот тип файла не поддерживается', en: 'This file type is not supported' },
  video_not_allowed: { ru: 'Видео добавьте ссылкой (YouTube, Google Drive)', en: 'Add videos as a link (YouTube, Google Drive)' },
  corrupt_file: { ru: 'Файл повреждён или не совпадает с расширением', en: "The file is damaged or doesn't match its extension" },
  empty_file: { ru: 'Файл пустой', en: 'The file is empty' },
  bad_url: { ru: 'Ссылка должна начинаться с http:// или https://', en: 'The link must start with http:// or https://' },
  duplicate: { ru: 'Этот файл уже прикреплён к уроку', en: 'Already attached to this lesson' },
  no_group: { ru: 'У урока нет группы', en: 'This lesson has no group' },
  reason_required: { ru: 'Укажите причину', en: 'Please give a reason' },
  storage_unavailable: { ru: 'Хранилище недоступно, попробуйте позже', en: 'Storage is unavailable, try again later' },
  somethingWrong: { ru: 'Что-то пошло не так', en: 'Something went wrong' },
} as const;

export type CopyKey = keyof typeof COPY;

export function t(key: CopyKey, locale: Locale): string {
  return COPY[key][locale];
}

/** The standard Russian 1/2-4/5+ plural rule, without the leading count. */
function ruPluralForm(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** "2 материала" / "2 materials" — the count and the word together. */
export function plural(n: number, locale: Locale, ru: [string, string, string], en: [string, string]): string {
  if (locale === 'en') return `${n} ${n === 1 ? en[0] : en[1]}`;
  return `${n} ${ruPluralForm(n, ru)}`;
}

/** "Ещё 3 материала откроются после урока" — the bell/section line for items still hidden. */
export function pendingAfterClass(n: number, locale: Locale): string {
  if (locale === 'en') return `${n} more will open after class`;
  const form = ruPluralForm(n, ['материал откроется', 'материала откроются', 'материалов откроются']);
  return `Ещё ${n} ${form} после урока`;
}

/** "Открыли 3 из 10" — the teacher-facing open-rate stat. */
export function openedCount(a: number, b: number, locale: Locale): string {
  return locale === 'ru' ? `Открыли ${a} из ${b}` : `Opened by ${a} of ${b}`;
}

/** The lower-cased extension of a filename, or '' when there isn't one. */
export function fileExt(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx === -1 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export type PreCheckError = 'too_large' | 'unsupported_type' | 'video_not_allowed' | 'empty_file';

/**
 * The client-side half of upload validation, checked before a byte is sent. Order matters:
 * a video gets its own "add it as a link" message even though it is also unsupported, and an
 * empty file is called out before the size cap (an empty file is never "too large").
 */
export function preCheckFile(file: Pick<File, 'name' | 'size'>): PreCheckError | null {
  const ext = fileExt(file.name);
  if ((VIDEO_EXTS as readonly string[]).includes(ext)) return 'video_not_allowed';
  if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) return 'unsupported_type';
  if (file.size === 0) return 'empty_file';
  if (file.size > MAX_UPLOAD_BYTES) return 'too_large';
  return null;
}

/** http(s), a real host, and a sane length — the same rule the backend enforces on attach. */
export function validateLinkUrl(url: string): 'bad_url' | null {
  if (!url || url.length > 2000) return 'bad_url';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'bad_url';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'bad_url';
  if (!parsed.hostname) return 'bad_url';
  return null;
}

/** Whether a link needs the "check sharing" nudge — Google Docs/Drive default to private. */
export function isGoogleShareLink(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'docs.google.com' || hostname === 'drive.google.com';
  } catch {
    return false;
  }
}

export function isOfficeExt(ext: string): boolean {
  return (OFFICE_EXTS as readonly string[]).includes(ext.toLowerCase());
}

const SUGGEST_TOPIC_MAX = 120;
const SKIP_TITLE_PATTERNS = [
  /^img[_-]?\d+/i,
  /^screenshot/i,
  /^снимок экрана/i,
  /^scan/i,
  /^whatsapp image/i,
  /^photo_/i,
];

/** Strip a trailing ".ext" (1–5 alphanumerics) and then a trailing " (N)", in that order. */
function cleanSuggestedTitle(raw: string): string {
  let name = raw.trim();
  name = name.replace(/\.[a-zA-Z0-9]{1,5}$/, '');
  name = name.replace(/\s*\(\d+\)$/, '');
  return name.trim();
}

/**
 * A starting guess for the lesson topic, built from the titles of files a teacher is
 * attaching: strip extensions and "(1)"-style suffixes, drop camera/screenshot names nobody
 * meant as a topic, dedupe, and keep it to two short titles joined with " · ".
 */
export function suggestTopic(titles: string[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of titles) {
    const cleaned = cleanSuggestedTitle(raw);
    if (!cleaned) continue;
    if (SKIP_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned))) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    kept.push(cleaned);
    if (kept.length === 2) break;
  }
  if (!kept.length) return '';
  const joined = kept.join(' · ');
  return joined.length > SUGGEST_TOPIC_MAX ? `${joined.slice(0, SUGGEST_TOPIC_MAX - 1)}…` : joined;
}

/** A backend error code as a sentence the viewer can act on, falling back to a generic one. */
export function errorMessage(code: string | undefined, locale: Locale): string {
  if (code && Object.prototype.hasOwnProperty.call(COPY, code)) return t(code as CopyKey, locale);
  return t('somethingWrong', locale);
}

const WEEKDAY_ABBR: Record<Locale, string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
};

/** "12.09, Fri · SAT-3 · Topic" — the lesson header used on cards and in notices, in Almaty. */
export function lessonHeading(
  l: { start_datetime: string; group_names: string[]; topic?: string | null },
  locale: Locale,
): string {
  const dayKey = almatyDayKey(parseAsUTC(l.start_datetime));
  const [year, month, day] = dayKey.split('-').map(Number);
  const weekday = WEEKDAY_ABBR[locale][new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
  const ddmm = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
  const parts = [`${ddmm}, ${weekday}`, l.group_names.join(', ')];
  if (l.topic) parts.push(l.topic);
  return parts.join(' · ');
}

/** "1.2 MB" / "1,2 МБ" above 1 MB, "850 KB" / "850 КБ" below it — files here never reach a GB. */
export function formatSize(bytes: number, locale: Locale): string {
  const MB = 1024 * 1024;
  if (bytes >= MB) {
    const value = (bytes / MB).toFixed(1);
    return `${locale === 'ru' ? value.replace('.', ',') : value} ${locale === 'ru' ? 'МБ' : 'MB'}`;
  }
  const kb = Math.round(bytes / 1024);
  return `${kb} ${locale === 'ru' ? 'КБ' : 'KB'}`;
}

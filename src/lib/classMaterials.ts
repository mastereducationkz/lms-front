import { almatyDayKey } from './recordings';
import { parseAsUTC } from './datetime';
import { MAX_UPLOAD_BYTES, uploadFailureReason } from './uploadFailure';
import { activeLocale, formatDate, formatNumber, t as tr, type Locale, type MessageKey, type Params } from './i18n';
import '@/lib/i18n/catalogs/materials';

export type { Locale };

/**
 * «Материалы урока» — per-lesson teacher files and links. This is the pure half: copy,
 * upload pre-checks, link validation and the small formatting helpers every surface (the
 * lesson pop-up, the teacher shelf, the /materials page and Telegram notices) shares. The
 * language comes from the caller (useLocale), like everywhere else.
 */

export const ALLOWED_EXTS = [
  'pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx',
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif',
  'mp3', 'm4a',
] as const;

export const VIDEO_EXTS = [
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'wmv', 'flv', '3gp', 'mpeg', 'mpg',
] as const;

export const OFFICE_EXTS = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'] as const;

/**
 * The short names every materials component passes to `t`, each backed by a catalog message
 * (lib/i18n, namespace `materials`). The names that look like `too_large` are the backend's
 * `detail.code` values, so `errorMessage` can turn a code straight into a sentence.
 */
export const COPY_KEYS = {
  sectionTitle: 'materials.section.title',
  add: 'materials.add.button',
  uploadFiles: 'materials.add.uploadFiles',
  fromMyFiles: 'materials.add.fromMyFiles',
  copyFromLesson: 'materials.add.copyFromLesson',
  link: 'materials.add.link',
  linkUrl: 'materials.link.url',
  linkTitle: 'materials.link.title',
  googleWarning: 'materials.link.googleSharingWarning',
  afterClassChip: 'materials.item.afterClassChip',
  showAfterClass: 'materials.item.showAfterClass',
  rename: 'materials.item.rename',
  moreActions: 'materials.item.moreActions',
  detach: 'materials.item.detach',
  moderate: 'materials.moderation.remove',
  reason: 'materials.moderation.reason',
  restore: 'materials.moderation.restore',
  removedLabel: 'materials.moderation.removedLabel',
  empty: 'materials.section.empty',
  homeworkLink: 'materials.homework.untitled',
  catchUp: 'materials.section.catchUp',
  officeNudge: 'materials.add.officeNudge',
  uploaded: 'materials.add.uploaded',
  topicLabel: 'materials.topic.label',
  topicHint: 'materials.topic.hint',
  topicPrefix: 'materials.topic.prefix',
  save: 'common.save',
  cancel: 'common.cancel',
  close: 'common.close',
  cancelledLesson: 'materials.lesson.cancelled',
  openLesson: 'materials.lesson.open',
  pageTitle: 'materials.page.title',
  search: 'materials.page.search',
  allGroups: 'materials.page.allGroups',
  searchGroups: 'materials.page.searchGroups',
  pickGroup: 'materials.page.pickGroup',
  download: 'materials.item.download',
  openLink: 'materials.item.openLink',
  openInNewTab: 'materials.item.openInNewTab',
  itemCount: 'materials.item.count',
  loadMore: 'materials.page.loadMore',
  noMaterialsYet: 'materials.page.noMaterialsYet',
  searchNothing: 'materials.page.nothingFound',
  myFilesEmpty: 'materials.myFiles.empty',
  noLessonsToCopy: 'materials.copy.noLessons',
  hideFromMyFiles: 'materials.myFiles.hide',
  notifications: 'materials.notifications.title',
  noNotifications: 'materials.notifications.empty',
  markAllRead: 'materials.notifications.markAllRead',
  too_large: 'materials.error.tooLarge',
  unsupported_type: 'materials.error.unsupportedType',
  video_not_allowed: 'materials.error.videoNotAllowed',
  corrupt_file: 'materials.error.corruptFile',
  empty_file: 'materials.error.emptyFile',
  bad_url: 'materials.error.badUrl',
  duplicate: 'materials.error.duplicate',
  no_group: 'materials.error.noGroup',
  reason_required: 'materials.error.reasonRequired',
  storage_unavailable: 'materials.error.storageUnavailable',
  somethingWrong: 'common.error',
  loadFailed: 'materials.error.loadFailed',
  retry: 'materials.action.retry',
  // «Библиотека» (docs/materials-library/SPEC.md §9)
  tabLessons: 'materials.tab.lessons',
  tabLibrary: 'materials.tab.library',
  libraryOf: 'materials.library.title',
  fromTeacher: 'materials.library.fromTeacher',
  mySections: 'materials.library.mySections',
  mySectionsHint: 'materials.library.mySectionsHint',
  newSection: 'materials.library.newSection',
  sectionName: 'materials.library.sectionName',
  create: 'materials.library.create',
  teachersOnly: 'materials.library.teachersOnly',
  teachersOnlyChip: 'materials.library.teachersOnlyChip',
  teachersOnlyHint: 'materials.library.teachersOnlyHint',
  shareWithGroups: 'materials.library.shareWithGroups',
  sharedWithGroups: 'materials.library.sharedWithGroups',
  notShared: 'materials.library.notShared',
  noShareableGroups: 'materials.library.noShareableGroups',
  deleteSection: 'materials.library.deleteSection',
  deleteSectionHint: 'materials.library.deleteSectionHint',
  sectionActions: 'materials.library.sectionActions',
  moveUp: 'materials.library.moveUp',
  moveDown: 'materials.library.moveDown',
  removeFromSection: 'materials.library.removeFromSection',
  sectionEmpty: 'materials.library.sectionEmpty',
  libraryEmpty: 'materials.library.empty',
  programEmpty: 'materials.library.programEmpty',
  librarySearch: 'materials.library.search',
  opensCount: 'materials.library.opensCount',
  expand: 'materials.library.expand',
  collapse: 'materials.library.collapse',
  library_too_large: 'materials.error.libraryTooLarge',
  uploadCancelled: 'materials.error.uploadCancelled',
  alreadyInSection: 'materials.error.alreadyInSection',
  removeFromGroup: 'materials.library.removeFromGroup',
} as const satisfies Record<string, MessageKey>;

export type CopyKey = keyof typeof COPY_KEYS;

export function isCopyKey(code: string): code is CopyKey {
  return Object.prototype.hasOwnProperty.call(COPY_KEYS, code);
}

/** A materials message in `locale`; `params` fill its placeholders (`count` picks a plural form). */
export function t(key: CopyKey, locale: Locale, params?: Params): string {
  return tr(COPY_KEYS[key], params, locale);
}

/** "Ещё 3 материала откроются после урока" — the bell/section line for items still hidden. */
export function pendingAfterClass(n: number, locale: Locale): string {
  return tr('materials.section.pendingAfterClass', { count: n }, locale);
}

/** "Открыли 3 из 10" — the teacher-facing open-rate stat. */
export function openedCount(a: number, b: number, locale: Locale): string {
  return tr('materials.section.openedBy', { opened: a, total: b }, locale);
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

/**
 * What the topic input shows: the teacher's own typing once they have started (`draft`), else
 * the confirmed topic, else a suggestion from the current item titles. Derived on every render
 * rather than seeded once, so a suggestion appears as soon as the first upload lands in a dialog
 * that was opened on an empty lesson.
 */
export function topicInputValue(draft: string | null, topic: string | null, titles: string[]): string {
  if (draft !== null) return draft;
  return topic ?? suggestTopic(titles);
}

/** A backend error code as a sentence the viewer can act on, falling back to a generic one. */
export function errorMessage(code: string | undefined, locale: Locale): string {
  if (code && isCopyKey(code)) return t(code, locale);
  return t('somethingWrong', locale);
}

/**
 * Why a class-material upload failed, for the queue row. A class-materials route answers with a
 * `detail.code` we have copy for; anything without one (a dropped connection, the stall watchdog,
 * nginx's bare 413, a 5xx) gets the shared upload reason instead of a generic "Something went
 * wrong". It runs outside React, so the language is the signed-in user's (activeLocale).
 */
export function uploadErrorReason(error: unknown, code: string | undefined, locale: Locale = activeLocale()): string {
  if (code) return errorMessage(code, locale);
  const reason = uploadFailureReason(error);
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

/** «Домашнее задание: Unit 3», or the untitled line when the homework has no title (the link draws its own arrow). */
export function homeworkLinkLabel(title: string | null | undefined, locale: Locale): string {
  const name = title?.trim();
  return name ? tr('materials.homework.titled', { title: name }, locale) : t('homeworkLink', locale);
}

export type CopyResultToast = { kind: 'success' | 'info'; text: string } | null;

/**
 * The toast after «Скопировать из урока…»: "+N" when something was added, the duplicate notice
 * when everything was already attached, and nothing when the source lesson had nothing to copy.
 */
export function copyResultToast(added: number, skipped: number, locale: Locale): CopyResultToast {
  if (added > 0) return { kind: 'success', text: `+${added}` };
  if (skipped > 0) return { kind: 'info', text: t('duplicate', locale) };
  return null;
}

const BELL_POLL_MS = 120_000;
const BELL_POLL_JITTER_MS = 15_000;

/**
 * The bell's next unread-count poll, 120 s ± 15 s (Ruling 21). `random` is `Math.random()`,
 * passed in so the spread is testable; the jitter keeps every open tab from polling in step.
 */
export function bellPollDelayMs(random: number): number {
  const r = Math.min(Math.max(random, 0), 1);
  return Math.round(BELL_POLL_MS + (r * 2 - 1) * BELL_POLL_JITTER_MS);
}

/** "12.09, Fri · SAT-3 · Topic" — the lesson header used on cards and in notices, in Almaty. */
export function lessonHeading(
  l: { start_datetime: string; group_names: string[]; topic?: string | null },
  locale: Locale,
): string {
  const dayKey = almatyDayKey(parseAsUTC(l.start_datetime));
  const [, month, day] = dayKey.split('-').map(Number);
  // «сб» → «Сб»: the abbreviation opens the heading, so it is capitalised in both languages.
  const short = formatDate(dayKey, { weekday: 'short' }, locale);
  const weekday = short.charAt(0).toUpperCase() + short.slice(1);
  const ddmm = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`;
  const parts = [`${ddmm}, ${weekday}`, l.group_names.join(', ')];
  if (l.topic) parts.push(l.topic);
  return parts.join(' · ');
}

/** "1.2 MB" / "1,2 МБ" above 1 MB, "850 KB" / "850 КБ" below it — files here never reach a GB. */
export function formatSize(bytes: number, locale: Locale): string {
  const MB = 1024 * 1024;
  if (bytes >= MB) {
    const size = formatNumber(bytes / MB, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }, locale);
    return tr('materials.size.megabytes', { size }, locale);
  }
  return tr('materials.size.kilobytes', { size: Math.round(bytes / 1024) }, locale);
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * "2 мин назад" / "3 h ago" — the notifications bell's per-item relative time. Falls back to
 * a plain "12.09" date (Almaty, same as `lessonHeading`) past a week: nobody reads "9 d ago"
 * as more useful than the date itself.
 */
export function relativeTime(iso: string, now: number, locale: Locale): string {
  const then = parseAsUTC(iso);
  const ms = Math.max(0, now - then.getTime());
  if (ms < MINUTE_MS) return tr('materials.time.justNow', undefined, locale);
  if (ms < HOUR_MS) return tr('materials.time.minutesAgo', { count: Math.floor(ms / MINUTE_MS) }, locale);
  if (ms < DAY_MS) return tr('materials.time.hoursAgo', { count: Math.floor(ms / HOUR_MS) }, locale);
  if (ms < WEEK_MS) return tr('materials.time.daysAgo', { count: Math.floor(ms / DAY_MS) }, locale);
  const [, month, day] = almatyDayKey(then).split('-');
  return `${day}.${month}`;
}

export type MaterialsBadgeVariant = 'count' | 'add' | null;

const MATERIALS_MANAGER_ROLES = ['teacher', 'head_teacher', 'admin'];

/**
 * What the attendance-grid paperclip badge shows for one lesson: the count once it's above zero (any
 * viewer who can see the grid), a faint "add" invitation at zero for a role that can plausibly
 * manage a lesson (teacher/head_teacher/admin — `ClassMaterialsSection`'s own `can_manage` is
 * what actually gates adding; this only decides which roles are worth the invitation), or
 * nothing at all — a curator/head_curator sees a lesson's badge only once it has materials,
 * and a lesson with no `event_id` has nothing to key the dialog on.
 */
export function materialsBadgeVariant(
  eventId: number | null | undefined,
  count: number,
  role: string | null | undefined,
): MaterialsBadgeVariant {
  if (!eventId) return null;
  if (count > 0) return 'count';
  return role && MATERIALS_MANAGER_ROLES.includes(role) ? 'add' : null;
}

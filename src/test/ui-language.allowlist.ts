/**
 * Files that may keep Russian text outside the ru catalog, each with its reason. Everything
 * else shows its copy through lib/i18n (t / useT), so every screen speaks the viewer's language,
 * whichever role they have. Only text that is never shown belongs here.
 */
export const RUSSIAN_ALLOWED: Record<string, string> = {
  // Parsing and matching tables: words people type or that appear in titles, never shown.
  'src/lib/scheduleShorthand.ts': 'parses «пн пт 18:00» shorthand',
  'src/components/announcements/programs.ts': 'matches program names in Telegram chat titles',
  'src/components/announcements/curator.ts': 'matches «с куратором» in Telegram chat titles',
};

/**
 * Text that reads the same in English and Russian, so screens show it as written instead of
 * through t(). The English ratchet (ui-language.test.ts) skips exactly these strings; anything else
 * written straight into a screen must go through the catalog.
 */
export const SAME_IN_BOTH_LANGUAGES: Record<string, string> = {
  // Names: the school, products, programs and the services we link to.
  'Master Education': 'brand', 'mastereducation.kz': 'domain', 'info@mastereducation.kz': 'address',
  IELTS: 'exam', 'SAT / NUET': 'exams', 'SAT (Gemini)': 'model picker', 'NUET (ChatGPT)': 'model picker',
  'General English': 'program name', 'Assignment Zero': 'product term', Meet: 'Google Meet', 'Meet:': 'Google Meet',
  Telegram: 'service', WhatsApp: 'service', Instagram: 'service', Snapchat: 'service', Deepgram: 'service',
  'Google Admin → Directory → Users → Download users → CSV': 'Google Admin’s own (English) menu path',
  // Official exam section and test names, used in English in both UIs.
  Math: 'SAT section', Verbal: 'SAT section', 'Practice Test': 'Bluebook test name',
  Listening: 'IELTS section', Reading: 'IELTS section', Writing: 'IELTS section', Speaking: 'IELTS section', Overall: 'IELTS band',
  // Examples of what to type, and decoration.
  'name@mastereducation.kz': 'example address', 'prospect@example.com': 'example address',
  'https://www.youtube.com/watch?v=...': 'example URL', 'https://.../image.jpg': 'example URL', 'https://…': 'example URL',
  'https://...': 'example URL', 'https://teams.microsoft.com/...': 'example URL', 'https://example.com/resource': 'example URL',
  'SAT SAT SAT SAT': 'decorative pattern on a share card',
  'STAGING ·': 'environment marker on the staging build only',
  // Not text: values the scan cannot tell from copy.
  outline: 'a button variant', '/register': 'a path', '?group=': 'a query string',
};


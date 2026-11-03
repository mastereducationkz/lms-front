// Fixtures and DOM helpers shared by the staff-training component tests (not shipped: only tests import it).
import { createContext } from 'react';
import type { ClipDetail, ClipQuestion, TaskSummary } from '@/services/api/staffTraining';

export { click, memoryStorage, mount, settle, text, unmount } from '@/pages/publicWebinarsTestKit';

/** Stand-in for AuthContext so pages that call useAuth() see a signed-in staff member. */
export const authMock = (role: string, locale?: 'ru' | 'en') => ({
  default: createContext(undefined),
  useAuth: () => ({ user: { id: 1, role, ui_language: locale ?? null }, loading: false, isAuthenticated: true }),
});

export const question = (over: Partial<ClipQuestion> = {}): ClipQuestion => ({
  id: 31, key: 'q1', kind: 'single', passed: false,
  prompt: { ru: 'Какую кнопку нажать?', en: 'Which button?' },
  options: [
    { id: 'a', text: { ru: 'Сохранить', en: 'Save' } },
    { id: 'b', text: { ru: 'Отметить', en: 'Mark' } },
  ],
  ...over,
});

export const clip = (over: Partial<ClipDetail> = {}): ClipDetail => ({
  id: 7, key: 'curator.attendance.mark_late',
  title: { ru: 'Отметить опоздание', en: 'Mark a late student' },
  summary: { ru: 'Одна строка', en: 'One line' },
  platform: 'lms', duration_ms: 104000, content_version: 2,
  video_url: '/uploads/v/T/videos/training/curator.attendance.mark_late/v2/clip.mp4',
  poster_url: '/uploads/v/T/videos/training/curator.attendance.mark_late/v2/poster.jpg',
  subtitles: [
    { lang: 'ru', label: 'Русский', url: '/uploads/v/T/x/v2/subs.ru.vtt', default: true },
    { lang: 'en', label: 'English', url: '/uploads/v/T/x/v2/subs.en.vtt', default: false },
  ],
  segments: [
    { idx: 0, start_ms: 2000, end_ms: 7400, text: { ru: 'Откройте журнал.', en: 'Open the register.' } },
    { idx: 1, start_ms: 7400, end_ms: 15000, text: { ru: 'Нажмите «Опоздал».', en: 'Press “Late”.' } },
  ],
  questions: [question()],
  next_item: { kind: 'task', id: 3 },
  progress: { watch_pct: 40, last_position_ms: 41000, watched: false, questions_passed: false },
  ...over,
});

export const task = (over: Partial<TaskSummary> = {}): TaskSummary => ({
  id: 3, key: 'curator.task.attendance', platform: 'lms',
  title: { ru: 'Отметьте посещаемость', en: 'Mark attendance' },
  body: { ru: 'Откройте урок.\n\n- Найдите Айдара\n- Нажмите «Опоздал»', en: 'Open the lesson.\n\n- Find Aidar\n- Press “Late”' },
  last_result: null,
  ...over,
});

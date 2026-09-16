/**
 * Правила уважительного пропуска, отделённые от компонентов.
 *
 * Здесь они потому, что их три раза применяют разные экраны — сетка, замены и карточка
 * урока, — и три копии одного правила расходятся. Плюс это единственная часть фичи, которую
 * в этом проекте можно покрыть тестами: компонентных тестов тут нет.
 */

/** UI-статусы, означающие пропуск. `absent` приходит от старых ответов, `missed` — от новых. */
const ABSENT_UI_STATUSES = new Set(['missed', 'absent']);

export function canBeExcused(status: string, isFuture: boolean): boolean {
  // Урок, который ещё не прошёл, приезжает как «missed» просто потому, что отметки нет.
  // Оправдывать там нечего, и значок на такой ячейке предлагал бы записать небывшее.
  if (isFuture) return false;
  return ABSENT_UI_STATUSES.has(status);
}

export function isValidExcuseNote(note: string | null | undefined): boolean {
  return Boolean((note ?? '').trim());
}

/**
 * Что отправить на сервер для одной строки.
 *
 * ``touched`` — трогал ли пользователь уважительность ИМЕННО этой строки. Если нет, поля в
 * payload быть не должно: сервер трактует их отсутствие как «не трогать», а `excused: false`
 * как «снять причину». Сетка отправляет все уроки изменённого ученика, а панель замен — весь
 * список, так что дефолтное `false` стёрло бы причины, которые ставил кто-то другой.
 */
export function excusePayload(
  touched: boolean,
  excused: boolean,
  note: string | null,
): { excused?: boolean; excuse_note?: string | null } {
  if (!touched) return {};
  if (!excused) return { excused: false, excuse_note: null };
  return { excused: true, excuse_note: (note ?? '').trim() };
}

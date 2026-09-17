/**
 * Правила уважительного пропуска, отделённые от компонентов.
 *
 * Здесь они потому, что их три раза применяют разные экраны — сетка, замены и карточка
 * урока, — и три копии одного правила расходятся. Плюс это единственная часть фичи, которую
 * в этом проекте можно покрыть тестами: компонентных тестов тут нет.
 */

/** UI-статусы, означающие пропуск. `absent` приходит от старых ответов, `missed` — от новых. */
const ABSENT_UI_STATUSES = new Set(['missed', 'absent']);

/**
 * Значит ли этот (уже нормализованный) статус пропуск урока — без учёта того,
 * будущий урок или нет. Отдельно от `canBeExcused`, потому что тот отвечает
 * на вопрос «показывать ли значок сейчас», а вызывающему коду (сетке) иногда
 * нужен именно факт «это статус пропуска», например когда меняется статус
 * посещаемости и надо решить, снимать ли уважительность.
 */
export function isAbsenceStatus(status: string): boolean {
  return ABSENT_UI_STATUSES.has(status);
}

/**
 * Does this cell READ as «Не был» on screen?
 *
 * Wider than {@link isAbsenceStatus}: `registered` is not stored as an absence, but the grid
 * paints it red «Не был» — and the backend's `attendance_status_to_ui` collapses every status
 * it does not recognise into `registered`, so the legacy spellings land here too. Anything
 * keyed to what the teacher SEES — the excuse dot, and hiding the activity star — has to ask
 * this question rather than the storage one, and ask it in one place so the two cannot drift.
 */
export function displaysAsAbsence(status: string): boolean {
  return isAbsenceStatus(status) || status === 'registered';
}

export function canBeExcused(status: string, isFuture: boolean): boolean {
  // Урок, который ещё не прошёл, приезжает как «missed» просто потому, что отметки нет.
  // Оправдывать там нечего, и значок на такой ячейке предлагал бы записать небывшее.
  if (isFuture) return false;
  return isAbsenceStatus(status);
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

/**
 * Какой статус отправить на сервер для одной строки.
 *
 * Обычно это сырой `attendance_status` ячейки — сервер и так его ждёт, и трогать его
 * незачем. Но у пропуска есть спеллинги вне `absent`/`missed`: `registered` — это то, во
 * что бэкенд (`attendance_status_to_ui`) переписывает любой легаси-статус импорта
 * (`no`, `0` и т.п.), которого нет в его собственном списке узнаваемых. Сетка красит
 * такую ячейку тем же амбером «Ув.», что и обычный пропуск — `canBeExcused` видит
 * нормализованный статус, — и позволяет поставить причину. Если отправить именно
 * `registered` вместе с `excused: true`, сервер увидит, что `normalize_status('registered')`
 * не пропуск, и откажет ВСЕМ пакетом (422) — ничего не сохранится, ни одна ячейка не
 * будет названа.
 *
 * Лечится не скрытием значка (тогда для уже уважительной такой ячейки не было бы способа
 * снять или поменять причину — см. отчёт о ревью), а тем, что летит на сервер: строка,
 * которую только что тронули и оставили уважительной, edет под спеллингом, который
 * сервер однозначно понимает как пропуск — тем же `'missed'`, что и обычный клик по циклу
 * до "Не был" (`handleCycle`).
 *
 * Нетронутая или неуважительная строка продолжает слать сырой статус как раньше — это
 * только про то, что едет вместе с `excused: true`, не про перерисовку ячейки.
 */
export function excuseAwareStatus(rawStatus: string, touched: boolean, excused: boolean): string {
  if (touched && excused) return 'missed';
  return rawStatus;
}

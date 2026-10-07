import type { serverErrors as en } from '../en/serverErrors';
import type { RuTable } from '../types';

export const serverErrors: RuTable<typeof en> = {
  'serverErrors.password_policy': 'Пароль должен быть не короче 8 символов и содержать хотя бы одну цифру',
  'serverErrors.password_too_long': 'Пароль должен быть не длиннее {max} символов',
  'serverErrors.password_whitespace': 'Пароль не может состоять только из пробелов',
  'serverErrors.password_too_common': 'Этот пароль слишком распространён, выберите другой',
  'serverErrors.reset_link_invalid': 'Недействительная или истёкшая ссылка',
  'serverErrors.reset_link_used': 'Ссылка недействительна или уже использована',
  'serverErrors.wrong_current_password': 'Текущий пароль неверен',
  'serverErrors.class_lesson_not_found': 'Урок не найден',
  'serverErrors.class_lesson_forbidden': 'Нет доступа к этому уроку',
  'serverErrors.lesson_notes_teacher_only': 'Заметки к уроку пишет педагог, который его проводит',
  'serverErrors.lesson_note_too_long': 'Не больше {max} символов',
  'serverErrors.attendance_teacher_only': 'Посещаемость отмечает педагог, который проводит это занятие',
  'serverErrors.scores_teacher_only': 'Баллы ставит педагог, который проводит это занятие',
  'serverErrors.excused_requires_note': 'Уважительный пропуск требует причину',
  'serverErrors.excused_only_absence': 'Уважительной может быть только отметка о пропуске',
  'serverErrors.lesson_already_taught': 'Урок от {date} уже проведён: по нему выставлено отметок — {marks}. Перенос сдвинул бы эти отметки на новую дату, как будто занятие прошло тогда. Если урок нужно провести ещё раз — добавьте новый урок; если отметки поставлены по ошибке — сначала снимите их.',
  'serverErrors.no_free_slot': 'Не удалось найти свободный слот для дополнительного урока группы «{group}» в ближайшие {weeks} недель. Проверьте расписание группы или выберите «только отменить».',
  'serverErrors.cancelled_lesson_not_scheduled': 'Отменяемый урок не найден в расписании, поэтому добавить урок в конец курса нельзя. Выберите «только отменить».',
  'serverErrors.webinar_series_needs_end': 'Укажите дату окончания повторов: без неё следующие вебинары не создаются — у них не будет комнаты Meet, записи и оплаты ведущему.',
  'serverErrors.lesson_not_found': 'Урок не найден. Возможно, его удалили или ссылка устарела.',
  'serverErrors.course_access_denied': 'У вас нет доступа к этому курсу. Если это ошибка, напишите куратору.',
  'serverErrors.role_denied': 'У вашей роли нет доступа к материалам урока.',
  'serverErrors.recording_not_found': 'У этого урока нет записи — удалять нечего.',
  'serverErrors.module_not_released': 'Этот модуль откроется на {module_week}-й неделе программы — сейчас идёт {current_week}-я.',
};

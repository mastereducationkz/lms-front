import type { profile as en } from '../en/profile';
import type { RuTable } from '../types';

export const profile: RuTable<typeof en> = {
  'profile.title': 'Профиль',
  'profile.editName': 'Изменить имя',
  'profile.nameLabel': 'Полное имя',
  'profile.namePlaceholder': 'Введите полное имя',
  'profile.nameSaved': 'Имя обновлено',
  'profile.nameFailed': 'Не удалось обновить имя. Попробуйте ещё раз.',
  'profile.unsavedTitle': 'Имя не сохранено',
  'profile.unsavedBody': 'Вы изменили имя, но не сохранили его. Всё равно уйти? Изменение пропадёт.',
  'profile.email': 'Почта',
  'profile.role': 'Роль',
  'profile.studentId': 'ID ученика',
  'profile.memberSince': 'С нами с {date}',
  'profile.customise': 'Настроить косатку',
  'profile.customiseDone': 'Готово',
  'profile.settingsHint': 'Тема, пароль и уведомления — в настройках.',
  'profile.openSettings': 'Открыть настройки',

  'profile.groups.student': 'Ваши группы',
  'profile.groups.teacher': 'Группы, где вы преподаёте',
  'profile.groups.curator': 'Группы, которые вы курируете',
  'profile.groups.empty': 'Вы пока не состоите в группе.',
  'profile.groups.emptyStaff': 'Групп пока нет.',
  'profile.groups.loadFailed': 'Не удалось загрузить группы.',
  'profile.groups.teacherLabel': 'Преподаватель',
  'profile.groups.curatorLabel': 'Куратор',
  'profile.groups.notAssigned': 'Пока не назначен',
  'profile.groups.message': 'Написать: {name}',

  'profile.exam.title': 'Ваш экзамен',
  'profile.exam.notSet': 'Дата не выбрана',
  'profile.exam.in': { one: 'через {count} день', few: 'через {count} дня', many: 'через {count} дней', other: 'через {count} дня' },
  'profile.exam.today': 'сегодня',
  'profile.exam.passed': 'дата прошла',
  'profile.exam.nearestOfficial': 'Ближайшая официальная дата — укажите свою, чтобы куратор знал.',
  'profile.exam.set': 'Выбрать дату',
  'profile.exam.change': 'Изменить дату',

  'profile.substitutions.title': 'Скрыть меня из запросов на замену',
  'profile.substitutions.body': 'Когда включено, другие преподаватели не увидят вас среди доступных для замены.',
};

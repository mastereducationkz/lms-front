import type { common as en } from '../en/common';
import type { RuTable } from '../types';

export const common: RuTable<typeof en> = {
  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.close': 'Закрыть',
  'common.delete': 'Удалить',
  'common.edit': 'Изменить',
  'common.back': 'Назад',
  'common.retry': 'Повторить',
  'common.loading': 'Загрузка…',
  'common.search': 'Поиск',
  'common.all': 'Все',
  'common.yes': 'Да',
  'common.no': 'Нет',
  'common.copy': 'Скопировать',
  'common.copied': 'Скопировано',
  'common.error': 'Что-то пошло не так',
  'common.lessons': { one: '{count} урок', few: '{count} урока', many: '{count} уроков', other: '{count} урока' },
  'common.students': { one: '{count} студент', few: '{count} студента', many: '{count} студентов', other: '{count} студента' },
  'common.groups': { one: '{count} группа', few: '{count} группы', many: '{count} групп', other: '{count} группы' },
  'common.minutes': { one: '{count} минута', few: '{count} минуты', many: '{count} минут', other: '{count} минуты' },
  'common.days': { one: '{count} день', few: '{count} дня', many: '{count} дней', other: '{count} дня' },
};

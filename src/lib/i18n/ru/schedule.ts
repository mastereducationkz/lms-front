import type { schedule as en } from '../en/schedule';
import type { RuTable } from '../types';

export const schedule: RuTable<typeof en> = {
  'schedule.length.minutes': '{minutes} мин',
  'schedule.length.hours': '{hours} ч',
  'schedule.length.hoursMinutes': '{hours} ч {minutes} мин',

  'schedule.generator.title': 'Создать расписание группы',
  'schedule.generator.quickEntry': 'Быстрый ввод (пн ср пт 19:00-20:30)',
  'schedule.generator.quickEntryPlaceholder': 'вт чт 20 00 сб 12 00',
  'schedule.generator.startDate': 'Дата начала',
  'schedule.generator.weekly': 'Расписание на неделю',
  'schedule.generator.badTimes': 'Время в формате ЧЧ:ММ (00:00–23:59): {days}',
  'schedule.generator.lessonsCount': 'Количество уроков',
  'schedule.generator.lessonsCountHint': 'Всего за курс, включая прошедшие уроки',
  'schedule.generator.generate': 'Создать',
  'schedule.generator.generating': 'Создаю расписание…',
  'schedule.generator.pickDay': 'Выберите хотя бы один день',
  'schedule.generator.generated': 'Расписание создано',
  'schedule.generator.generateFailed': 'Не удалось создать расписание',

  'schedule.preview.failed': 'Не удалось рассчитать — сохранение всё равно возможно',
  'schedule.preview.calculating': 'Рассчитываю…',
  'schedule.preview.showDates': 'Показать даты',
  'schedule.preview.hideDates': 'Скрыть даты',
  'schedule.preview.before': 'было: {lesson}',
  'schedule.preview.started': 'Прошло: {amount}',
  'schedule.preview.planned': 'Будет запланировано: {amount}{range}',
  'schedule.preview.total': 'Итого по курсу: {amount}',
  'schedule.preview.changes': 'Перенесено: {moved} · изменена длительность: {resized} · новых: {created} · отключено: {off}{offDates}',
  'schedule.preview.tag.move': 'перенос',
  'schedule.preview.tag.resize': 'длительность',
  'schedule.preview.tag.create': 'новый',

  'schedule.shorthand.unreadable': 'Не понял «{text}»',
  'schedule.shorthand.noDay': 'Нет дня для «{text}»',
  'schedule.shorthand.badLength': '«{text}» — длительность должна быть от {min} минут до {max} часов',
  'schedule.shorthand.noTime': 'Нет времени для: {days}',
};

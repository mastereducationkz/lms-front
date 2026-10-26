import type { seasonal as en } from '../en/seasonal';
import type { RuTable } from '../types';

// Без глаголов прошедшего времени от первого лица: они требуют рода.
export const seasonal: RuTable<typeof en> = {
  'seasonal.toggle.label': 'Оформление к Хэллоуину',
  'seasonal.toggle.hint': 'Тыквы, летучие мыши и костюмы до 31 октября. Настройка действует только на этом устройстве.',

  'seasonal.halloween.greeting.title': 'С Хэллоуином, {name}!',
  'seasonal.halloween.greeting.titleNoName': 'С Хэллоуином!',
  'seasonal.halloween.greeting.body': 'До 31 октября по LMS спрятаны пять тыкв. Найдите все пять — вас ждёт сюрприз.',
  'seasonal.halloween.greeting.done': 'Все пять тыкв найдены. Касатик вами гордится.',
  'seasonal.halloween.greeting.progress': { one: 'Найдена {count} из 5', few: 'Найдено {count} из 5', many: 'Найдено {count} из 5', other: 'Найдено {count} из 5' },
  'seasonal.halloween.greeting.close': 'Закрыть поздравление',
  'seasonal.halloween.greeting.turnOff': 'Выключить оформление',
  'seasonal.halloween.greeting.card': 'Получить карточку',

  'seasonal.halloween.pumpkin.label': 'Сладость или гадость',
  'seasonal.halloween.treat.title': 'Сладость!',
  'seasonal.halloween.treat.1': 'Ваш мозг заработал шоколадку. Потратьте её на ещё один тренировочный вопрос.',
  'seasonal.halloween.treat.2': 'Бу! Шутка. На этой неделе у вас всё отлично получается.',
  'seasonal.halloween.treat.3': 'Самое страшное слово в тестовом вопросе — «кроме». Перечитайте его дважды.',
  'seasonal.halloween.treat.4': 'Домашка, сделанная заранее, слаще любых конфет.',
  'seasonal.halloween.treat.5': 'Привидения обожают ужастики, а вы — практику. Каждый день понемногу.',
  'seasonal.halloween.treat.6': 'По LMS спрятаны пять тыкв. Одна может оказаться на следующей странице.',
  'seasonal.halloween.treat.7': 'Ошибки — не монстры. Они показывают, что потренировать дальше.',
  'seasonal.halloween.treat.8': 'Касатик советует: короткий перерыв — и ещё одна страница. У вас получится.',
  'seasonal.halloween.treat.dismiss': 'Закрыть',

  'seasonal.halloween.hunt.pumpkin': 'Спрятанная тыква. Заберите её',
  'seasonal.halloween.hunt.found': 'Тыква {count} из 5!',
  'seasonal.halloween.hunt.keepLooking': 'Ищите дальше: остальные — на других страницах.',

  'seasonal.halloween.finale.title': 'Все пять тыкв найдены!',
  'seasonal.halloween.finale.body': 'Касатик сделал круг почёта по LMS в вашу честь. Вот карточка — сохраните или поделитесь.',
  'seasonal.halloween.finale.close': 'Закрыть',
  'seasonal.halloween.card.title': '5 из 5 тыкв',
  'seasonal.halloween.card.line': 'найдено в Master LMS на Хэллоуин',
  'seasonal.halloween.card.pill': 'Хэллоуин 2026',
  'seasonal.halloween.card.alt': 'Ваша карточка Хэллоуина: найдено пять тыкв из пяти',
  'seasonal.halloween.card.drawing': 'Рисуем карточку…',
  'seasonal.halloween.card.failed': 'Не получилось нарисовать карточку на этом устройстве.',
};

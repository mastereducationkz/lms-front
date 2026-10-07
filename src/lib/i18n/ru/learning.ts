import type { learning as en } from '../en/learning';
import type { RuTable } from '../types';

export const learning: RuTable<typeof en> = {
  // Genitive after «из N», chosen by the total: «из 1 урока», «из 21 урока», «из 2 уроков», «из 11 уроков».
  'learning.completion.lessons': {
    one: '{done} из {count} урока',
    few: '{done} из {count} уроков',
    many: '{done} из {count} уроков',
    other: '{done} из {count} урока',
  },
  'learning.completion.checkpoints': 'Чекпоинты: {taken} из {opened}',
  'learning.completion.checkpointsWithAverage': 'Чекпоинты: {taken} из {opened} · средний балл {average}%',

  'learning.courses.title': 'Курсы',
  'learning.courses.manage': 'Управление курсами',
  'learning.courses.teacher': 'Преподаватель: {name}',
  'learning.courses.loadFailed': 'Не удалось загрузить курсы',
  'learning.courses.errorTitle': 'Ошибка загрузки курсов',
  'learning.courses.readOnlyNote': 'Только просмотр: открывайте любой урок, ответы к тестам видны. Ваши действия не сохраняются как прогресс.',
  'learning.courses.search': 'Поиск курса',
  'learning.courses.empty': 'Курсы не найдены',
  'learning.courses.emptyStudentHint': 'Обратитесь к преподавателю, чтобы вас записали на курс',
  'learning.courses.yourGroups': 'Ваши группы',
  'learning.courses.draft': 'Черновик',
  'learning.courses.completed': 'Курс пройден',
  'learning.courses.continue': 'Продолжить обучение',
  'learning.courses.view': 'Открыть курс',

  'learning.lesson.loadFailed': 'Не удалось загрузить урок. Обновите страницу или напишите куратору.',
  'learning.lesson.staffPreview': 'Просмотр',
  'learning.lesson.staffPreviewHint': 'Вы смотрите урок как сотрудник: прогресс, попытки и завершения не сохраняются.',
  'learning.lesson.skip': 'Дальше',
  'learning.lesson.skipHint': 'Следующий урок (ничего не отмечается)',
  'learning.lesson.back': 'Назад к курсу',
  'learning.lesson.lessons': 'Уроки',

  'learning.flashcards.easy': 'Лёгкая',
  'learning.flashcards.hard': 'Сложная',
  'learning.flashcards.reveal': 'Нажмите, чтобы увидеть ответ',
  'learning.flashcards.flipBack': 'Нажмите, чтобы перевернуть обратно',
  'learning.flashcards.remove': 'Убрать из избранного',
  'learning.flashcards.frontImage': 'Лицевая сторона',
  'learning.flashcards.backImage': 'Обратная сторона',

  'learning.quiz.answerAll': 'Ответьте на все вопросы ({answered}/{total})',
};

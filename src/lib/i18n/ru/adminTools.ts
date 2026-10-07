import type { adminTools as en } from '../en/adminTools';
import type { RuTable } from '../types';

export const adminTools: RuTable<typeof en> = {
  'adminTools.course.type': 'Тип курса',

  'adminTools.events.saveFailed': 'Ошибка при сохранении события',
  'adminTools.events.loadFailed': 'Ошибка при загрузке события',

  'adminTools.quiz.audioMode': 'Режим воспроизведения аудио',
  'adminTools.quiz.audioFlexible': 'Свободный режим',
  'adminTools.quiz.audioFlexibleHint': 'Студент может перематывать, ставить на паузу и переслушивать аудио без ограничений. Подходит для практики и обучения.',
  'adminTools.quiz.audioStrict': 'Экзаменационный режим',
  'adminTools.quiz.audioStrictHint': 'Студент не может перематывать аудио. Доступно только 2 повтора. Подходит для экзаменов и тестирования.',
};

import type { meetJoinLog as en } from '../en/meetJoinLog';
import type { RuTable } from '../types';

export const meetJoinLog: RuTable<typeof en> = {
  'meetJoinLog.joined': 'Вход {time}',
  'meetJoinLog.left': 'выход {time}',
  'meetJoinLog.rejoined': 'снова вход {time}',
  'meetJoinLog.stillIn': 'ещё в комнате',
  'meetJoinLog.noJoin': 'В комнату не заходил(а)',
  'meetJoinLog.noJoinHeld': 'Ни один подтверждённый аккаунт не заходил',
  'meetJoinLog.minutes': '{minutes} из {held} мин, нужно {required}',
  'meetJoinLog.minutesOnly': '{minutes} мин, нужно {required}',

  'meetJoinLog.why.heldGuest': 'Meet ждёт: в комнате был неподтверждённый гость, возможно, это этот ученик.',
  'meetJoinLog.why.heldAccount': 'Meet ждёт: в комнате был неподтверждённый аккаунт, возможно, это этот ученик.',
  'meetJoinLog.why.meetMark': 'Отметку ({mark}) поставил Meet по этой записи.',
  'meetJoinLog.why.agrees': 'Отметку поставил учитель, расчёт Meet с ней совпадает.',
  'meetJoinLog.why.changedBy': 'Meet решил, затем {who} изменил(а) отметку на «{mark}»: {why}.',
  'meetJoinLog.why.changed': 'Meet решил, затем отметку изменили на «{mark}»: {why}.',
  'meetJoinLog.why.shadow': 'Отметка учителя: Meet пока только наблюдает.',
  'meetJoinLog.why.skipped': 'Meet не трогал отметку: {reason}.',
  'meetJoinLog.why.reverted': 'Отметку Meet отменили.',
  'meetJoinLog.why.teacher': 'Отметка учителя.',
  'meetJoinLog.why.unmarked': 'Отметки пока нет. По расчёту Meet: {verdict}.',
  'meetJoinLog.why.noReason': 'причина не указана',

  'meetJoinLog.auto': 'авто',
  'meetJoinLog.autoHint': 'Привязано автоматически: группа уже называла этого гостя на прошлом уроке. Нажмите ×, если это другой человек — повторно он не привяжется.',
};

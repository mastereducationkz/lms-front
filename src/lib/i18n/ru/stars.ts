import type { stars as en } from '../en/stars';
import type { RuTable } from '../types';

export const stars: RuTable<typeof en> = {
  'stars.streak.title': 'Бонус за серию',
  'stars.streak.titleWith': 'Бонус за серию ×{multiplier}',
  'stars.streak.moreDays': { one: '{count} день', few: '{count} дня', many: '{count} дней', other: '{count} дня' },
  'stars.streak.notStarted': {
    one: 'Занимайтесь {count} день подряд, и каждая заработанная звезда получит ×{next}.',
    few: 'Занимайтесь {count} дня подряд, и каждая заработанная звезда получит ×{next}.',
    many: 'Занимайтесь {count} дней подряд, и каждая заработанная звезда получит ×{next}.',
    other: 'Занимайтесь {count} дня подряд, и каждая заработанная звезда получит ×{next}.',
  },
  'stars.streak.building': 'Ваша серия: {days} дн. подряд. Продержитесь ещё {more}, и каждая заработанная звезда получит ×{next}.',
  'stars.streak.active': 'Серия {days} дн. умножает каждую заработанную звезду на {multiplier}. Продержитесь ещё {more}, чтобы получить ×{next}.',
  'stars.streak.atMax': 'Серия {days} дн. умножает каждую заработанную звезду на {multiplier}, это максимум.',
  'stars.streak.rule':
    '×{start} за серию от {startDays} дней, затем +{step} за каждые {stepDays} дня, максимум ×{max}. ' +
    'Бонус добавляется к каждой награде сразу, кроме бонусов от преподавателя.',
};

import type { live as en } from '../en/live';
import type { RuTable } from '../types';

export const live: RuTable<typeof en> = {
  'live.reconnecting': 'Переподключаемся…',
  'live.offline': 'Не удалось связаться с сервером. Попробуйте ещё раз.',
  'live.failed': 'Не получилось. Попробуйте ещё раз.',
};

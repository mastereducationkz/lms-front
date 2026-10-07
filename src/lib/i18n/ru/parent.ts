import type { parent as en } from '../en/parent';
import type { RuTable } from '../types';

export const parent: RuTable<typeof en> = {
  'parent.dashboard.greeting': 'Здравствуйте, {name}!',
  'parent.dashboard.nameFallback': 'Родитель',
  'parent.dashboard.subtitle': 'Здесь ваши дети и связь с их учителями и кураторами.',
  'parent.dashboard.children': 'Мои дети',
  'parent.dashboard.noGroup': 'Без группы',
  'parent.dashboard.noChildren': 'Пока нет привязанных детей. Обратитесь к администратору, чтобы связать ваш аккаунт с ребёнком.',
  'parent.dashboard.contactTitle': 'Связь с учителями и кураторами',
  'parent.dashboard.contactBody': 'Пишите напрямую или в родительских чатах групп вашего ребёнка.',
  'parent.dashboard.openChat': 'Открыть чат',

  'parent.targets.title': 'Цели',
  'parent.targets.ielts': 'IELTS: цель {target} · сейчас {now}{details}',
  'parent.targets.sat': 'SAT: цель {target} · сейчас {now}{details}',
  'parent.targets.nuet': 'NUET: цель {target}',
  'parent.targets.satDisclaimer': 'Баллы SAT — оценка по числу правильных ответов, не официальный результат.',
};

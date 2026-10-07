import type { MessageTable } from '../types';

/** The parent's dashboard: their children, exam targets, the way to reach teachers and curators. */
export const parent = {
  'parent.dashboard.greeting': 'Hello, {name}!',
  'parent.dashboard.nameFallback': 'Parent',
  'parent.dashboard.subtitle': 'Your children, and a direct line to their teachers and curators.',
  'parent.dashboard.children': 'My children',
  'parent.dashboard.noGroup': 'No group',
  'parent.dashboard.noChildren': 'No children are linked yet. Ask an administrator to link your account to your child.',
  'parent.dashboard.contactTitle': 'Contact teachers and curators',
  'parent.dashboard.contactBody': 'Message them directly or in your child’s group parent chats.',
  'parent.dashboard.openChat': 'Open chat',

  'parent.targets.title': 'Targets',
  'parent.targets.ielts': 'IELTS: target {target} · now {now}{details}',
  'parent.targets.sat': 'SAT: target {target} · now {now}{details}',
  'parent.targets.nuet': 'NUET: target {target}',
  'parent.targets.satDisclaimer': 'SAT scores are an estimate from the number of correct answers, not an official result.',
} as const satisfies MessageTable;

import type { MessageKey } from './i18n';
import type { ChecklistStep } from '../services/api/masterLeagueSetup';
import '@/lib/i18n/catalogs/announcements';

/**
 * The Telegram setup checklist of a Master League group (`GET /master-league/telegram-checklist`).
 *
 * The server says for each step whether it is done (`ok`: true / false / null when Support did
 * not answer). What it cannot say is which open step is the one to do NOW: the steps depend on
 * each other (a chat is approved only after Telegram made it a supergroup, linked only after it is
 * approved), and acting out of order is what breaks the greeting for good. This file turns the
 * flags into four states and picks the words; the words themselves live in the announcements
 * catalog.
 */

/**
 * done: finished. waiting: open and nothing stands in its way, so this is the thing to do.
 * blocked: open, but an earlier step comes first. unknown: Support did not answer.
 */
export type StepState = 'done' | 'waiting' | 'blocked' | 'unknown';

export type StepTone = 'success' | 'attention' | 'muted' | 'neutral';

/**
 * The order a person works through the steps. The server lists them in the order it checks them
 * (admin rights after the supergroup), which is not the order things happen: making the bot an
 * administrator is what makes Telegram convert the group.
 */
const CHAIN = ['chat_found', 'one_active_row', 'bot_admin', 'supergroup', 'approved', 'linked'] as const;
/** Needs nothing from the chat steps. */
const INDEPENDENT = ['teacher_email'] as const;
const KNOWN_ORDER: readonly string[] = [...CHAIN, ...INDEPENDENT];

export interface ResolvedStep {
  step: ChecklistStep;
  state: StepState;
  /** The earlier step that is not done yet, for a blocked step. */
  blockedBy: ChecklistStep | null;
}

/** Known steps in working order, then any step this client has not heard of, as the server sent it. */
export function orderSteps(steps: ChecklistStep[]): ChecklistStep[] {
  const rank = (key: string) => {
    const at = KNOWN_ORDER.indexOf(key);
    return at === -1 ? KNOWN_ORDER.length : at;
  };
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => rank(a.step.key) - rank(b.step.key) || a.index - b.index)
    .map(({ step }) => step);
}

export function resolveSteps(steps: ChecklistStep[]): ResolvedStep[] {
  const ordered = orderSteps(steps);
  const byKey = new Map(ordered.map((step) => [step.key, step]));
  const chain = CHAIN.map((key) => byKey.get(key)).filter((step): step is ChecklistStep => !!step);
  return ordered.map((step): ResolvedStep => {
    if (step.ok === true) return { step, state: 'done', blockedBy: null };
    if (step.ok === null) return { step, state: 'unknown', blockedBy: null };
    const at = chain.indexOf(step);
    const blockedBy = at <= 0 ? null : chain.slice(0, at).find((earlier) => earlier.ok !== true) ?? null;
    return blockedBy ? { step, state: 'blocked', blockedBy } : { step, state: 'waiting', blockedBy: null };
  });
}

export function stepProgress(steps: ChecklistStep[]): { done: number; total: number } {
  return { done: steps.filter((step) => step.ok === true).length, total: steps.length };
}

/** The step to do now: the first one that is open with nothing before it. */
export function nextStep(resolved: ResolvedStep[]): ResolvedStep | null {
  return resolved.find((r) => r.state === 'waiting') ?? null;
}

export const STATE_LABEL: Record<StepState, MessageKey> = {
  done: 'announcements.mlChecklist.state.done',
  waiting: 'announcements.mlChecklist.state.waiting',
  blocked: 'announcements.mlChecklist.state.blocked',
  unknown: 'announcements.mlChecklist.state.unknown',
};

export const STATE_TONE: Record<StepState, StepTone> = {
  done: 'success',
  waiting: 'attention',
  blocked: 'muted',
  unknown: 'neutral',
};

export interface StepCopy {
  label: MessageKey;
  /** One sentence: what the step is and why it matters. */
  why: MessageKey;
  /** The exact thing to do while the step is open. */
  fix: MessageKey;
  /** A button next to the fix, for a step done on another tab. */
  action: 'openGroups' | null;
}

const COPY: Record<string, StepCopy> = {
  chat_found: {
    label: 'announcements.mlChecklist.steps.chat_found.label',
    why: 'announcements.mlChecklist.steps.chat_found.why',
    fix: 'announcements.mlChecklist.steps.chat_found.fix',
    action: null,
  },
  one_active_row: {
    label: 'announcements.mlChecklist.steps.one_active_row.label',
    why: 'announcements.mlChecklist.steps.one_active_row.why',
    fix: 'announcements.mlChecklist.steps.one_active_row.fix',
    action: null,
  },
  bot_admin: {
    label: 'announcements.mlChecklist.steps.bot_admin.label',
    why: 'announcements.mlChecklist.steps.bot_admin.why',
    fix: 'announcements.mlChecklist.steps.bot_admin.fix',
    action: null,
  },
  supergroup: {
    label: 'announcements.mlChecklist.steps.supergroup.label',
    why: 'announcements.mlChecklist.steps.supergroup.why',
    fix: 'announcements.mlChecklist.steps.supergroup.fix',
    action: null,
  },
  approved: {
    label: 'announcements.mlChecklist.steps.approved.label',
    why: 'announcements.mlChecklist.steps.approved.why',
    fix: 'announcements.mlChecklist.steps.approved.fix',
    action: 'openGroups',
  },
  linked: {
    label: 'announcements.mlChecklist.steps.linked.label',
    why: 'announcements.mlChecklist.steps.linked.why',
    fix: 'announcements.mlChecklist.steps.linked.fix',
    action: null,
  },
  teacher_email: {
    label: 'announcements.mlChecklist.steps.teacher_email.label',
    why: 'announcements.mlChecklist.steps.teacher_email.why',
    fix: 'announcements.mlChecklist.steps.teacher_email.fix',
    action: null,
  },
};

/** The words for a step, or null for a step key this client does not know (show the server's own). */
export function stepCopy(key: string, group: { hasTeacher: boolean }): StepCopy | null {
  const copy = COPY[key];
  if (!copy) return null;
  if (key === 'teacher_email' && !group.hasTeacher) {
    return { ...copy, fix: 'announcements.mlChecklist.steps.teacher_email.fixNoTeacher' };
  }
  return copy;
}

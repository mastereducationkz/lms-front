import { describe, expect, it } from 'vitest';
import { hasMessage } from './i18n';
import {
  nextStep, orderSteps, resolveSteps, STATE_LABEL, STATE_TONE, stepCopy, stepProgress,
} from './masterLeagueChecklist';
import type { ChecklistStep } from '../services/api/masterLeagueSetup';

// The order the server lists them in (lms-backend telegram_checklist.group_steps).
const SERVER_ORDER = ['chat_found', 'one_active_row', 'supergroup', 'bot_admin', 'approved', 'linked', 'teacher_email'];

const steps = (done: string[], over: Record<string, boolean | null> = {}): ChecklistStep[] =>
  SERVER_ORDER.map((key) => ({ key, label: key, ok: key in over ? over[key] : done.includes(key), hint: '' }));

const summary = (list: ChecklistStep[]) =>
  resolveSteps(list).map((r) => `${r.step.key}:${r.state}${r.blockedBy ? `<${r.blockedBy.key}` : ''}`);

describe('orderSteps', () => {
  it('puts the steps in the order a person does them: admin rights come before the supergroup', () => {
    expect(orderSteps(steps([])).map((s) => s.key)).toEqual([
      'chat_found', 'one_active_row', 'bot_admin', 'supergroup', 'approved', 'linked', 'teacher_email',
    ]);
  });

  it('keeps a step this client has not heard of after the known ones, in the server order', () => {
    const list = [...steps([]).slice(0, 2), { key: 'z_new', label: 'Z', ok: false, hint: '' }, { key: 'a_new', label: 'A', ok: true, hint: '' }];
    expect(orderSteps(list).map((s) => s.key)).toEqual(['chat_found', 'one_active_row', 'z_new', 'a_new']);
  });
});

describe('resolveSteps', () => {
  it('starts with the chat: everything after it waits its turn', () => {
    expect(summary(steps(['teacher_email']))).toEqual([
      'chat_found:waiting',
      'one_active_row:blocked<chat_found',
      'bot_admin:blocked<chat_found',
      'supergroup:blocked<chat_found',
      'approved:blocked<chat_found',
      'linked:blocked<chat_found',
      'teacher_email:done',
    ]);
  });

  it('asks for the admin rights next, and names them as what holds the supergroup back', () => {
    expect(summary(steps(['chat_found', 'one_active_row', 'teacher_email']))).toEqual([
      'chat_found:done',
      'one_active_row:done',
      'bot_admin:waiting',
      'supergroup:blocked<bot_admin',
      'approved:blocked<bot_admin',
      'linked:blocked<bot_admin',
      'teacher_email:done',
    ]);
  });

  it('waits for Telegram to convert the group before anyone approves or links', () => {
    const list = steps(['chat_found', 'one_active_row', 'bot_admin']);
    expect(summary(list).slice(2, 6)).toEqual([
      'bot_admin:done', 'supergroup:waiting', 'approved:blocked<supergroup', 'linked:blocked<supergroup',
    ]);
    expect(nextStep(resolveSteps(list))?.step.key).toBe('supergroup');
  });

  it('links last: approved is the step to do once the group is a supergroup', () => {
    const list = steps(['chat_found', 'one_active_row', 'bot_admin', 'supergroup', 'teacher_email']);
    expect(summary(list).slice(4, 6)).toEqual(['approved:waiting', 'linked:blocked<approved']);
    expect(nextStep(resolveSteps(list))?.step.key).toBe('approved');
  });

  it('leaves the teacher’s email independent of the chat: it is waiting from the start when missing', () => {
    expect(summary(steps(['chat_found', 'one_active_row', 'bot_admin', 'supergroup', 'approved', 'linked']))).toContain('teacher_email:waiting');
  });

  it('has nothing to do and nothing next when every step is done', () => {
    const list = steps(SERVER_ORDER);
    expect(resolveSteps(list).every((r) => r.state === 'done')).toBe(true);
    expect(nextStep(resolveSteps(list))).toBeNull();
  });

  it('calls the chat steps unknown, never failed, while Support is down', () => {
    const down = steps(['teacher_email'], { chat_found: null, one_active_row: null, supergroup: null, bot_admin: null, approved: null });
    expect(summary(down)).toEqual([
      'chat_found:unknown', 'one_active_row:unknown', 'bot_admin:unknown', 'supergroup:unknown', 'approved:unknown',
      'linked:blocked<chat_found', 'teacher_email:done',
    ]);
    expect(nextStep(resolveSteps(down))).toBeNull();
  });

  it('keeps a step that is done as done, even when it was done too early', () => {
    // Approved the old, ordinary group before Telegram converted it: done, but the supergroup is still open.
    const early = steps(['chat_found', 'one_active_row', 'bot_admin', 'approved', 'teacher_email']);
    expect(summary(early).slice(2, 6)).toEqual(['bot_admin:done', 'supergroup:waiting', 'approved:done', 'linked:blocked<supergroup']);
  });

  it('treats a step it does not know as something to do now', () => {
    const list = [...steps(SERVER_ORDER), { key: 'future_step', label: 'Новый шаг', ok: false, hint: 'Сделайте это' }];
    expect(summary(list).slice(-1)).toEqual(['future_step:waiting']);
  });
});

describe('stepProgress', () => {
  it('counts only steps that are done; an unchecked one is not progress', () => {
    expect(stepProgress(steps(['chat_found', 'one_active_row']))).toEqual({ done: 2, total: 7 });
    expect(stepProgress(steps(['chat_found'], { one_active_row: null }))).toEqual({ done: 1, total: 7 });
    expect(stepProgress([])).toEqual({ done: 0, total: 0 });
  });
});

describe('words', () => {
  it('has a label and a tone for every state', () => {
    expect(Object.keys(STATE_LABEL).sort()).toEqual(['blocked', 'done', 'unknown', 'waiting']);
    expect(STATE_TONE).toEqual({ done: 'success', waiting: 'attention', blocked: 'muted', unknown: 'neutral' });
  });

  it('has every message in both languages (hasMessage reads the loaded English catalog; the i18n test ties ru to it)', () => {
    const keys = [
      ...Object.values(STATE_LABEL),
      ...SERVER_ORDER.flatMap((key) => {
        const copy = stepCopy(key, { hasTeacher: true });
        return copy ? [copy.label, copy.why, copy.fix] : [];
      }),
      stepCopy('teacher_email', { hasTeacher: false })!.fix,
    ];
    expect(keys).toHaveLength(4 + 7 * 3 + 1);
    expect(keys.filter((key) => !hasMessage(key))).toEqual([]);
  });

  it('knows no words for a step it was not told about, and asks for a teacher when there is none', () => {
    expect(stepCopy('future_step', { hasTeacher: true })).toBeNull();
    expect(stepCopy('teacher_email', { hasTeacher: true })?.fix).toBe('announcements.mlChecklist.steps.teacher_email.fix');
    expect(stepCopy('teacher_email', { hasTeacher: false })?.fix).toBe('announcements.mlChecklist.steps.teacher_email.fixNoTeacher');
  });

  it('sends the approval step to the Groups tab and no other step anywhere', () => {
    expect(SERVER_ORDER.filter((key) => stepCopy(key, { hasTeacher: true })?.action === 'openGroups')).toEqual(['approved']);
  });
});

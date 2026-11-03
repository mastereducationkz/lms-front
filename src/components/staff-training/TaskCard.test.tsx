// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setActiveLocale } from '@/lib/i18n';
import type { CheckResult } from '@/services/api/staffTraining';
import TaskCard from './TaskCard';
import { click, mount, settle, task, text, unmount } from './__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('./__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ openTask: vi.fn(), checkTask: vi.fn(), resetPractice: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);

const URL_ONCE = 'https://train-lms.example/training-login?t=abc';
const failed: CheckResult = {
  status: 'failed', checked_at: '2026-11-03T10:00:00Z', task_done: false, track_done: false,
  message: { ru: 'Айдар должен быть «опоздал», а не «отсутствовал».', en: 'Aidar should be “late”, not “absent”.' },
};
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;

let tab: { location: { replace: ReturnType<typeof vi.fn> }; document: { body: { textContent: string }; title: string }; close: ReturnType<typeof vi.fn>; opener: unknown };
let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  tab = { location: { replace: vi.fn() }, document: { body: { textContent: '' }, title: '' }, close: vi.fn(), opener: 'window' };
  open = vi.fn(() => tab);
  vi.stubGlobal('open', open);
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); setActiveLocale('en'); });

const show = (over = {}, locale: 'ru' | 'en' = 'en') =>
  mount(<TaskCard task={task(over)} locale={locale} done={false} onChecked={vi.fn()} />);

describe('TaskCard: the training copy', () => {
  it('never asks for the sign-in link until the button is clicked', async () => {
    await show();
    await settle();
    expect(api.openTask).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('on click opens the tab at once and sends it to the single-use link when it arrives', async () => {
    api.openTask.mockResolvedValue({ url: URL_ONCE, expires_at: '2026-11-03T10:02:00Z' });
    await show();
    await click(button('Open the training copy'));
    await settle();
    expect(api.openTask).toHaveBeenCalledTimes(1);
    expect(api.openTask).toHaveBeenCalledWith(3);
    expect(open).toHaveBeenCalledTimes(1); // opened during the click, before the slow call returned
    expect(tab.location.replace).toHaveBeenCalledWith(URL_ONCE);
    expect(tab.opener).toBeNull();
  });

  it('falls back to a visible link when the browser blocks the new tab', async () => {
    open.mockReturnValueOnce(null).mockReturnValueOnce(null);
    api.openTask.mockResolvedValue({ url: URL_ONCE, expires_at: '' });
    await show();
    await click(button('Open the training copy'));
    await settle();
    expect(open).toHaveBeenLastCalledWith(URL_ONCE, '_blank', 'noopener');
    expect(text()).toContain('blocked the new tab');
    expect(document.querySelector(`a[href="${URL_ONCE}"]`)).not.toBeNull();
  });

  it('closes the empty tab and says so when the copy is unavailable', async () => {
    const refusal = Object.assign(new Error('The training copy is unavailable right now. Try again in a minute'), { cause: { response: { data: { reason_code: 'training_copy_unavailable' } } } });
    api.openTask.mockRejectedValue(refusal);
    await show();
    await click(button('Open the training copy'));
    await settle();
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.replace).not.toHaveBeenCalled();
    expect(text()).toContain('unavailable right now');
  });
});

describe('TaskCard: the check', () => {
  it('shows the failure sentence word for word, in the reader’s language', async () => {
    setActiveLocale('ru');
    api.checkTask.mockResolvedValue(failed);
    await show({}, 'ru');
    await click(button('Проверить'));
    await settle();
    expect(document.querySelector('[data-task-message]')?.textContent).toBe('Айдар должен быть «опоздал», а не «отсутствовал».');
    expect(document.querySelector('[data-task-result]')?.getAttribute('data-task-result')).toBe('failed');
  });

  it('shows the English sentence to an English reader, and tells the parent page', async () => {
    const onChecked = vi.fn();
    api.checkTask.mockResolvedValue(failed);
    await mount(<TaskCard task={task()} locale="en" done={false} onChecked={onChecked} />);
    await click(button('Check'));
    await settle();
    expect(document.querySelector('[data-task-message]')?.textContent).toBe('Aidar should be “late”, not “absent”.');
    expect(onChecked).toHaveBeenCalledWith(failed);
  });

  it('marks a pass, and a check that itself broke is not called a failure', async () => {
    api.checkTask.mockResolvedValue({ ...failed, status: 'passed', message: { ru: 'Готово!', en: 'Done!' }, task_done: true });
    await show();
    await click(button('Check'));
    await settle();
    expect(document.querySelector('[data-task-result]')?.getAttribute('data-task-result')).toBe('passed');
    await unmount();
    api.checkTask.mockResolvedValue({ ...failed, status: 'error', message: { ru: 'Не удалось', en: 'Could not run the check' } });
    await show();
    await click(button('Check'));
    await settle();
    expect(document.querySelector('[data-task-result]')?.getAttribute('data-task-result')).toBe('error');
    expect(text()).toContain('not your mistake');
  });

  it('renders the instructions: paragraphs and a list, no HTML', async () => {
    await show({ body: { ru: 'x', en: 'Open the lesson.\n\n- Find <b>Aidar</b>\n- Press “Late”' } });
    expect(text()).toContain('Open the lesson.');
    expect(document.querySelectorAll('[data-task-body] li')).toHaveLength(2);
    expect(document.querySelector('[data-task-body] b')).toBeNull();
    expect(text()).toContain('<b>Aidar</b>');
  });

  it('asks before starting the practice over, then resets', async () => {
    api.resetPractice.mockResolvedValue({ ok: true });
    await show();
    await click(button('Start the practice over'));
    await settle();
    expect(api.resetPractice).not.toHaveBeenCalled();
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Start the practice over').pop()!);
    await settle();
    expect(api.resetPractice).toHaveBeenCalledWith(3);
  });
});

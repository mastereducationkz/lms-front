// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnswerResult } from '@/services/api/staffTraining';
import QuestionCard from './QuestionCard';
import QuestionsSection from './QuestionsSection';
import { click, mount, question, settle, text, unmount } from './__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('./__tests__/kit')).authMock('admin'));

afterEach(unmount);

const wrong: AnswerResult = {
  correct: false, clip_questions_passed: false, clip_done: false,
  explain: { ms: 52000, text: { ru: 'Это показано на 0:52.', en: 'This is shown at 0:52.' } },
};
const right: AnswerResult = { correct: true, clip_questions_passed: true, clip_done: false };

const option = (id: string) => document.querySelector(`input[value="${id}"]`) as HTMLInputElement;
const checkButton = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Check') as HTMLButtonElement;

async function show(answer: ReturnType<typeof vi.fn>, onShowMoment = vi.fn(), over = {}) {
  await mount(<QuestionCard question={question(over)} index={0} total={3} locale="en" onAnswer={answer} onShowMoment={onShowMoment} />);
  return onShowMoment;
}

describe('QuestionCard', () => {
  it('shows no explanation before an answer, and «Check» waits for a choice', async () => {
    await show(vi.fn());
    expect(text()).toContain('Question 1 of 3');
    expect(text()).toContain('Which button?');
    expect(document.querySelector('[data-explain]')).toBeNull();
    expect(checkButton().disabled).toBe(true);
    await click(option('a'));
    expect(checkButton().disabled).toBe(false);
  });

  it('on a wrong answer shows the explaining sentence, and «Show the moment» seeks to explain.ms', async () => {
    const answer = vi.fn().mockResolvedValue(wrong);
    const onShowMoment = await show(answer);
    await click(option('b'));
    await click(checkButton());
    await settle();
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ id: 31 }), ['b']);
    expect(text()).toContain('Not quite');
    expect(text()).toContain('This is shown at 0:52.');
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Show the moment in the video')!);
    expect(onShowMoment).toHaveBeenCalledTimes(1);
    expect(onShowMoment).toHaveBeenCalledWith(52000);
  });

  it('lets a wrong answer be retried without limit, then closes on the right one with no explanation', async () => {
    const answer = vi.fn().mockResolvedValueOnce(wrong).mockResolvedValueOnce(wrong).mockResolvedValueOnce(right);
    await show(answer);
    for (const choice of ['b', 'b', 'a']) {
      await click(option(choice));
      await click(checkButton() ?? document.body);
      await settle();
    }
    expect(answer).toHaveBeenCalledTimes(3);
    expect(text()).toContain('Correct.');
    expect(document.querySelector('[data-explain]')).toBeNull();
    expect(checkButton()).toBeUndefined();
    expect(document.querySelector('[data-question]')?.getAttribute('data-passed')).toBe('true');
  });

  it('a multi-answer question takes several choices', async () => {
    const answer = vi.fn().mockResolvedValue(right);
    await show(answer, vi.fn(), { kind: 'multi' });
    await click(option('a'));
    await click(option('b'));
    await click(checkButton());
    await settle();
    expect(answer).toHaveBeenCalledWith(expect.anything(), ['a', 'b']);
  });

  it('shows an already-passed question as passed and offers no check', async () => {
    await show(vi.fn(), vi.fn(), { passed: true });
    expect(text()).toContain('Answered correctly');
    expect(checkButton()).toBeUndefined();
  });

  it('says what went wrong when the call is refused', async () => {
    const refusal = Object.assign(new Error('Watch the video first: the questions open at 90%'), { cause: { response: { data: { reason_code: 'staff_training_watch_first' } } } });
    await show(vi.fn().mockRejectedValue(refusal));
    await click(option('a'));
    await click(checkButton());
    await settle();
    expect(text()).toContain('Watch the video first: the questions open at 90%');
  });
});

describe('QuestionsSection', () => {
  const props = { questions: [question()], pct: 62, locale: 'en' as const, onAnswer: vi.fn(), onShowMoment: vi.fn() };

  it('keeps the questions shut until the video is watched, and says how far along it is', async () => {
    await mount(<QuestionsSection {...props} watched={false} />);
    expect(text()).toContain('at least 90% of the video');
    expect(text()).toContain('62%');
    expect(document.querySelector('[data-question]')).toBeNull();
  });

  it('opens one card per question once it is watched', async () => {
    await mount(<QuestionsSection {...props} questions={[question(), question({ id: 32, key: 'q2' })]} watched />);
    expect(document.querySelectorAll('[data-question]')).toHaveLength(2);
    expect(document.querySelector('[data-questions-locked]')).toBeNull();
  });

  it('renders nothing for a clip without questions', async () => {
    const host = await mount(<QuestionsSection {...props} questions={[]} watched />);
    expect(host.textContent).toBe('');
  });
});

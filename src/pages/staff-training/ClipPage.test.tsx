// @vitest-environment jsdom
import { forwardRef, useImperativeHandle } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clip, click, mount, settle, text, unmount } from '@/components/staff-training/__tests__/kit';

vi.mock('@/contexts/AuthContext', async () => (await import('@/components/staff-training/__tests__/kit')).authMock('curator'));
const api = vi.hoisted(() => ({ getTrainingClip: vi.fn(), answerQuestion: vi.fn() }));
vi.mock('@/services/api/staffTraining', () => api);
const seekTo = vi.hoisted(() => vi.fn());
// The player is its own test; here it only offers the page its two hooks: a beat, and a seek.
vi.mock('@/components/staff-training/ClipPlayer', () => ({
  default: forwardRef((props: { onBeat: (r: { watch_pct: number; watched: boolean }) => void }, ref) => {
    useImperativeHandle(ref, () => ({ seekTo }));
    return <button data-fake-beat onClick={() => props.onBeat({ watch_pct: 95, watched: true })}>beat</button>;
  }),
}));

import ClipPage from './ClipPage';

const WRONG = { correct: false, clip_questions_passed: false, clip_done: false, explain: { ms: 52000, text: { ru: 'Это на 0:52.', en: 'This is at 0:52.' } } };
const RIGHT = { correct: true, clip_questions_passed: true, clip_done: true };

const open = () => mount(
  <MemoryRouter initialEntries={['/training/clips/7']}><Routes><Route path="/training/clips/:clipId" element={<ClipPage />} /></Routes></MemoryRouter>,
);
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const option = (id: string) => document.querySelector(`input[value="${id}"]`) as HTMLInputElement;

beforeEach(() => {
  api.getTrainingClip.mockReset().mockResolvedValue(clip());
  api.answerQuestion.mockReset();
  seekTo.mockReset();
});
afterEach(unmount);

describe('the clip page', () => {
  it('keeps the questions shut until the player reports the video watched, then opens them', async () => {
    await open();
    expect(text()).toContain('Mark a late student');
    expect(text()).toContain('at least 90% of the video');
    expect(document.querySelector('[data-question]')).toBeNull();
    await click(document.querySelector('[data-fake-beat]'));
    expect(document.querySelector('[data-question]')).not.toBeNull();
  });

  it('a wrong answer explains itself and seeks the video to the explaining moment; a right one finishes the clip', async () => {
    api.getTrainingClip.mockResolvedValue(clip({ progress: { watch_pct: 100, last_position_ms: 0, watched: true, questions_passed: false } }));
    api.answerQuestion.mockResolvedValueOnce(WRONG).mockResolvedValueOnce(RIGHT);
    await open();
    expect(document.querySelector('[data-clip-done]')).toBeNull();

    await click(option('b'));
    await click(button('Check'));
    await settle();
    expect(api.answerQuestion).toHaveBeenCalledWith(31, ['b']);
    expect(text()).toContain('This is at 0:52.');
    await click(button('Show the moment in the video'));
    expect(seekTo).toHaveBeenCalledTimes(1);
    expect(seekTo).toHaveBeenCalledWith(52000);
    expect(document.querySelector('[data-clip-done]')).toBeNull();

    await click(option('a'));
    await click(button('Check'));
    await settle();
    expect(document.querySelector('[data-clip-done]')).not.toBeNull();
    expect(document.querySelector('[data-clip-done] a')?.getAttribute('href')).toBe('/training/tasks/3');
  });

  it('sends the viewer back to the track when nothing comes next', async () => {
    api.getTrainingClip.mockResolvedValue(clip({ next_item: null, questions: [], progress: { watch_pct: 100, last_position_ms: 0, watched: true, questions_passed: true } }));
    await open();
    expect(document.querySelector('[data-clip-done] a')?.getAttribute('href')).toBe('/training');
  });

  it('says it could not load, and offers a retry', async () => {
    api.getTrainingClip.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(clip());
    await open();
    expect(text()).toContain('Couldn’t load this page');
    await click(button('Try again'));
    await settle();
    expect(text()).toContain('Mark a late student');
  });
});

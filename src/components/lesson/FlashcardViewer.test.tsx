// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlashcardSet } from '../../types';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
vi.mock('../../services/api', () => ({
  addFavoriteFlashcard: vi.fn(async () => ({ id: 1 })),
  removeFavoriteByCardId: vi.fn(),
  checkIsFavorite: vi.fn(async () => ({ is_favorite: false, favorite_id: null })),
}));
vi.mock('../../lib/sentry', () => ({ reportError: vi.fn() }));

import { addFavoriteFlashcard, checkIsFavorite } from '../../services/api';
import { reportError } from '../../lib/sentry';
import FlashcardViewer from './FlashcardViewer';

const SET: FlashcardSet = {
  title: 'Words', study_mode: 'sequential', auto_flip: false, show_progress: true,
  cards: [
    { id: 'a', front_text: 'meticulous', back_text: 'careful', difficulty: 'normal', order_index: 0 },
    { id: 'b', front_text: 'negligible', back_text: 'tiny', difficulty: 'normal', order_index: 1 },
  ],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.clearAllMocks();
});

/** Let the favourite check and the save settle. */
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const button = (label: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
const flip = () => act(() => (host.querySelector('[role="button"][aria-label]') as HTMLElement).click());
const front = () => host.querySelector('[role="button"][aria-label]')?.textContent ?? '';

describe('FlashcardViewer answer buttons', () => {
  it('says "Still learning" and "Got it", never correct/incorrect', () => {
    act(() => root.render(<FlashcardViewer flashcardSet={SET} />));
    flip();
    expect(button('Still learning')).toBeTruthy();
    expect(button('Got it')).toBeTruthy();
    expect(host.textContent).not.toMatch(/\b(in)?correct\b/i);
  });

  it('brings a last card marked "Still learning" back, and completes once every card is "Got it"', () => {
    const onComplete = vi.fn();
    act(() => root.render(<FlashcardViewer flashcardSet={SET} onComplete={onComplete} />));
    flip();
    act(() => button('Got it')!.click()); // card a
    flip();
    act(() => button('Still learning')!.click()); // card b, the last one
    expect(front()).toContain('negligible');
    expect(onComplete).not.toHaveBeenCalled();
    flip();
    act(() => button('Got it')!.click());
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('"Still learning" keeps the card in My Flashcards', () => {
  const add = vi.mocked(addFavoriteFlashcard);
  const check = vi.mocked(checkIsFavorite);
  const mount = async () => {
    act(() => root.render(<FlashcardViewer flashcardSet={SET} stepId={7} lessonId={3} courseId={1} />));
    await settle();
  };
  const stillLearning = async () => {
    flip();
    act(() => button('Still learning')!.click());
    await settle();
  };

  it('saves the card on the first tap and says so quietly', async () => {
    await mount();
    await stillLearning(); // card a
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toMatchObject({ step_id: 7, flashcard_id: 'a', lesson_id: 3, course_id: 1 });
    expect(JSON.parse(add.mock.calls[0][0].flashcard_data).front_text).toBe('meticulous');
    expect(host.textContent).toContain('Saved to My Flashcards');
    expect(front()).toContain('negligible'); // the round went on
  });

  it('does not save the same card again on a second tap', async () => {
    await mount();
    await stillLearning(); // card a
    flip();
    act(() => button('Got it')!.click()); // card b; the deck comes back to a
    await settle();
    expect(front()).toContain('meticulous');
    await stillLearning(); // card a again
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('leaves a card that is already in My Flashcards alone', async () => {
    check.mockResolvedValueOnce({ is_favorite: true, favorite_id: 5 });
    await mount();
    await stillLearning();
    expect(add).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Saved to My Flashcards');
  });

  it('treats the server\'s "already in favorites" as saved, with no error', async () => {
    add.mockRejectedValueOnce(new Error('Flashcard already in favorites'));
    await mount();
    await stillLearning();
    expect(reportError).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain('Saved to My Flashcards');
  });

  it('keeps the round going when the save fails, and reports it to Sentry', async () => {
    add.mockRejectedValueOnce(new Error('Network Error'));
    await mount();
    await stillLearning();
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reportError).mock.calls[0][1]).toMatchObject({ feature: 'flashcards', action: 'still_learning_save' });
    expect(host.textContent).not.toContain('Saved to My Flashcards');
    expect(front()).toContain('negligible');
  });

  it('saves nothing outside a lesson step', async () => {
    act(() => root.render(<FlashcardViewer flashcardSet={SET} />));
    await settle();
    await stillLearning();
    expect(add).not.toHaveBeenCalled();
  });
});

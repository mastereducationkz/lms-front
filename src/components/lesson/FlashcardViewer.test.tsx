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
  addFavoriteFlashcard: vi.fn(),
  removeFavoriteByCardId: vi.fn(),
  checkIsFavorite: vi.fn(async () => ({ is_favorite: false })),
}));

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
});

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

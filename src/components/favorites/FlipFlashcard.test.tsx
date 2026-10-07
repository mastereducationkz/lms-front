// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FlipFlashcard, { type SavedFlashcard } from './FlipFlashcard';

const LOOKUP: SavedFlashcard = {
  id: 'vocab_1',
  front_text: 'meticulous',
  back_text: 'дотошный',
  difficulty: 'normal',
  tags: ['vocabulary', 'lookup'],
  order_index: 0,
  definition: 'Showing great attention to detail.',
  context: 'The archivist was meticulous, labeling every folder.',
  phonetic: '/məˈtɪkjələs/',
  source: 'lookup',
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

function mount(card: SavedFlashcard, flipped = false, onFlip = vi.fn()) {
  act(() => root.render(<FlipFlashcard card={card} flipped={flipped} onFlip={onFlip} onRemove={vi.fn()} />));
  return onFlip;
}

describe('FlipFlashcard', () => {
  it('shows no badge for "normal" (every Look Up save) and Easy/Hard for lesson cards', () => {
    mount(LOOKUP);
    expect(host.textContent).not.toMatch(/normal/i);
    mount({ ...LOOKUP, difficulty: 'easy' });
    expect(host.textContent).toContain('Easy');
    mount({ ...LOOKUP, difficulty: 'hard' });
    expect(host.textContent).toContain('Hard');
  });

  it('puts the translation, the definition and the example sentence on the back of a Look Up card', () => {
    mount(LOOKUP, true);
    const back = host.querySelector('.flip-card__back')!;
    expect(back.getAttribute('aria-hidden')).toBe('false');
    expect(host.querySelector('.flip-card__front')!.getAttribute('aria-hidden')).toBe('true');
    expect(back.textContent).toContain('дотошный');
    expect(back.textContent).toContain('Showing great attention to detail.');
    expect(back.textContent).toContain('labeling every folder');
    expect(back.querySelector('strong')?.textContent).toBe('meticulous');
  });

  it('keeps a plain lesson card to its answer', () => {
    mount({ id: 'c1', front_text: 'Q', back_text: 'x = 11', difficulty: 'hard', order_index: 0 }, true);
    const back = host.querySelector('.flip-card__back')!;
    expect(back.textContent).toContain('x = 11');
    expect(back.querySelector('strong')).toBeNull();
  });

  it('turns over on click, Enter and Space, and reports its state', () => {
    const onFlip = mount(LOOKUP);
    const card = host.querySelector<HTMLElement>('[role="button"]')!;
    expect(card.getAttribute('aria-pressed')).toBe('false');
    act(() => card.click());
    act(() => card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    act(() => card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    act(() => card.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })));
    expect(onFlip).toHaveBeenCalledTimes(3);
  });
});

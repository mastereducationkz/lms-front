// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LookupEvent, LookupLang } from '../../services/api/lookup';

// Mounted in jsdom because Look Up is all interaction: a selection settling, a new one replacing
// it, Escape, the language toggle. The network is a scripted streamLookup.
vi.mock('../../services/api/client', () => ({ api: {} }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, role: 'student', ui_state: null }, updateUser: vi.fn() }),
}));
vi.mock('../../contexts/SettingsContext', () => ({ useSettings: () => ({ isLookUpEnabled: true }) }));
vi.mock('../../services/api', () => ({ quickCreateFlashcard: vi.fn(async () => ({ success: true })) }));
vi.mock('../../services/api/uiState', () => ({ saveLookupLang: vi.fn(async () => ({ tour_version_seen: 0, tips: {} })) }));
vi.mock('../../services/api/lookup', async () => {
  const actual = await vi.importActual<typeof import('../../services/api/lookup')>('../../services/api/lookup');
  return { ...actual, streamLookup: vi.fn() };
});

import { streamLookup } from '../../services/api/lookup';
import { saveLookupLang } from '../../services/api/uiState';
import { TextLookupPopover } from './TextLookupPopover';

interface Call {
  request: { text: string; context?: string; lang: LookupLang };
  emit: (event: LookupEvent) => void;
  signal: AbortSignal;
  finish: () => void;
}

const calls: Call[] = [];
let container: HTMLDivElement;
let root: Root;

function mount(enabled = true) {
  container = document.createElement('div');
  container.innerHTML =
    '<p id="p1">The archivist was meticulous, labeling every folder by date and source.</p>' +
    '<p id="p2">On weekends she walked along the bank of the river and sketched the old mills.</p>';
  document.body.appendChild(container);
  const ref = { current: container };
  root = createRoot(document.createElement('div'));
  act(() => root.render(<TextLookupPopover containerRef={ref} enabled={enabled} />));
}

/** Selects `word` in paragraph `id` (or `text` across both) the way a person would. */
function select(id: string, word: string) {
  const node = container.querySelector(`#${id}`)!.firstChild as Text;
  const at = node.data.indexOf(word);
  const range = document.createRange();
  range.setStart(node, at);
  range.setEnd(node, at + word.length);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function pointer(type: 'pointerdown' | 'pointerup', pointerType: string, target: EventTarget = container) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => {
    target.dispatchEvent(event);
  });
}

const card = () => document.querySelector('[data-lookup-card]') as HTMLElement | null;
const settle = (ms = 300) => act(() => vi.advanceTimersByTime(ms));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  calls.length = 0;
  vi.mocked(streamLookup).mockImplementation((request, onEvent, signal) =>
    new Promise<void>((resolve) => {
      calls.push({ request, emit: (event) => act(() => onEvent(event)), signal, finish: () => act(() => resolve()) });
    }));
  // jsdom lays nothing out; floating-ui only needs a rectangle to work with.
  Range.prototype.getBoundingClientRect = () => new DOMRect(40, 40, 80, 18);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  // Node's own (flag-less) localStorage shadows jsdom's here; give the page a working one.
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Look Up', () => {
  it('starts by itself once the selection has been still for 300 ms', () => {
    mount();
    select('p1', 'meticulous');
    settle(299);
    expect(calls).toHaveLength(0);
    settle(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].request).toEqual({
      text: 'meticulous', lang: 'ru', mode: 'word',
      context: 'The archivist was meticulous, labeling every folder by date and source.',
    });
    expect(card()?.getAttribute('role')).toBe('dialog');
  });

  it('waits for the mouse button while a drag is still choosing', () => {
    mount();
    pointer('pointerdown', 'mouse');
    select('p1', 'meticulous');
    settle(2000);
    expect(calls).toHaveLength(0);
    pointer('pointerup', 'mouse');
    settle(300);
    expect(calls).toHaveLength(1);
  });

  it('a new selection aborts the old lookup and never shows its answer', () => {
    mount();
    select('p1', 'meticulous');
    settle();
    calls[0].emit({ type: 'meta', mode: 'word', lang: 'ru', cached: false });
    select('p2', 'bank');
    settle();
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].emit({ type: 'field', field: 'translation', value: 'скрупулёзный' });
    calls[1].emit({ type: 'field', field: 'translation', value: 'берег' });
    expect(card()?.textContent).toContain('берег');
    expect(card()?.textContent).not.toContain('скрупулёзный');
  });

  it('shows the dictionary card for a word and translate-and-explain for a sentence', () => {
    mount();
    select('p1', 'meticulous');
    settle();
    expect(card()?.dataset.lookupCard).toBe('word');
    calls[0].emit({ type: 'done', result: { mode: 'word', translation: 'скрупулёзный', headword: 'meticulous', pos: 'adjective', definition: 'very careful', example: 'She is meticulous.' } });
    expect(card()?.textContent).toContain('adjective');
    expect(card()?.textContent).toContain('Save to flashcards');

    select('p2', 'she walked along the bank of the river');
    settle();
    expect(calls[1].request).toMatchObject({ mode: 'phrase' });
    expect(card()?.dataset.lookupCard).toBe('phrase');
    calls[1].emit({ type: 'done', result: { mode: 'phrase', translation: 'она гуляла вдоль берега реки', glosses: [{ term: 'bank', meaning: 'берег', note: 'land by a river' }] } });
    expect(card()?.textContent).toContain('Words to know');
    expect(card()?.textContent).toContain('Save as a phrase card');
  });

  it('asks for less than two sentences instead of staying silent', () => {
    mount();
    const range = document.createRange();
    range.selectNodeContents(container);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    container.querySelector('#p2')!.textContent += ' x'.repeat(200);
    document.dispatchEvent(new Event('selectionchange'));
    settle();
    expect(calls).toHaveLength(0);
    expect(card()?.dataset.lookupCard).toBe('too_long');
    expect(card()?.textContent).toContain('Select up to a sentence or two');
  });

  it('keeps the part of a triple-clicked paragraph that is inside the lesson text', () => {
    mount();
    const after = document.createElement('nav');
    after.textContent = 'Previous Next';
    document.body.appendChild(after);
    const node = container.querySelector('#p2')!.firstChild as Text;
    const range = document.createRange();
    range.setStart(node, 0);
    range.setEnd(after.firstChild!, 0);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
    settle();
    expect(calls).toHaveLength(1);
    expect(calls[0].request.text).toBe('On weekends she walked along the bank of the river and sketched the old mills.');
    after.remove();
  });

  it('stays off where it would leak answers', () => {
    mount(false);
    select('p1', 'meticulous');
    settle(1000);
    expect(calls).toHaveLength(0);
    expect(card()).toBeNull();
  });

  it('switches the translation language, remembers it and asks again', () => {
    mount();
    select('p1', 'meticulous');
    settle();
    const kz = card()!.querySelector('button[aria-label="Translate into Kazakh"]') as HTMLButtonElement;
    act(() => kz.click());
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].request.lang).toBe('kk');
    expect(saveLookupLang).toHaveBeenCalledWith('kk');
    expect(window.localStorage.getItem('lookup:lang:7')).toBe('kk');
    expect(kz.getAttribute('aria-pressed')).toBe('true');
  });

  it('closes on Escape and aborts what was streaming', () => {
    mount();
    select('p1', 'meticulous');
    settle();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(card()).toBeNull();
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('offers a Try again that asks again after an error', () => {
    mount();
    select('p1', 'meticulous');
    settle();
    calls[0].emit({ type: 'error', code: 'ai_unavailable', message: 'The dictionary is unavailable right now.' });
    const retry = Array.from(card()!.querySelectorAll('button')).find((b) => b.textContent?.includes('Try again'))!;
    act(() => retry.click());
    expect(calls).toHaveLength(2);
  });

  it('on a touch screen waits for a tap on the chip', () => {
    mount();
    pointer('pointerdown', 'touch');
    select('p1', 'meticulous');
    pointer('pointerup', 'touch');
    settle();
    expect(calls).toHaveLength(0);
    const chip = document.querySelector('[data-lookup-chip]') as HTMLButtonElement;
    expect(chip.textContent).toContain('Look up');
    act(() => chip.click());
    expect(calls).toHaveLength(1);
    expect(card()).not.toBeNull();
  });
});

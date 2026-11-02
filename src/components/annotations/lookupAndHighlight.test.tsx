// @vitest-environment jsdom
/**
 * Look Up and the highlighter work on the same selection in lesson text (owner, 2026-11-02:
 * «Look Up no longer opens since the highlighter shipped»). Neither may treat the other's
 * floating UI as a click elsewhere or as a new choice of text: on a phone, a tap on Look Up's
 * chip re-opened the highlight toolbar 300 ms later, on top of the translation card.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api/client', () => ({ api: {} }));
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return {
    default: createContext(undefined),
    useAuth: () => ({ user: { id: 7, role: 'student', ui_state: null }, updateUser: vi.fn() }),
  };
});
vi.mock('../../contexts/SettingsContext', () => ({ useSettings: () => ({ isLookUpEnabled: true }) }));
vi.mock('../../services/api', () => ({ quickCreateFlashcard: vi.fn(async () => ({ success: true })) }));
vi.mock('../../services/api/uiState', () => ({ saveLookupLang: vi.fn(async () => ({ tour_version_seen: 0, tips: {} })) }));
vi.mock('../../services/api/lookup', async () => {
  const actual = await vi.importActual<typeof import('../../services/api/lookup')>('../../services/api/lookup');
  return { ...actual, streamLookup: vi.fn(() => new Promise<void>(() => {})) };
});
vi.mock('../../services/api/annotations', () => ({
  listAnnotations: vi.fn(async () => ({ attempt_no: 0, annotations: [] })),
  createAnnotation: vi.fn(async (_s: string, _t: number, body: object) => ({ ...body, id: 1, attempt_no: 0 })),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  importAnnotations: vi.fn(),
}));
vi.mock('../../services/api/usage', () => ({ reportUsage: vi.fn() }));
vi.mock('../../lib/sentry', () => ({ reportError: vi.fn() }));
vi.mock('../Toast', () => ({ toast: vi.fn() }));

import { TextLookupPopover } from '../lesson/TextLookupPopover';
import { AnnotationLayer } from './AnnotationLayer';

let container: HTMLDivElement;
let root: Root;

const card = () => document.querySelector<HTMLElement>('[data-lookup-card]');
const chip = () => document.querySelector<HTMLButtonElement>('[data-lookup-chip]');
const toolbar = () => document.querySelector<HTMLElement>('[data-annotation-toolbar]');
const settle = (ms = 350) => act(() => { vi.advanceTimersByTime(ms); });

function mount() {
  container = document.createElement('div');
  container.innerHTML =
    '<div data-annotation-scope="lesson:1" data-annotation-block="body">' +
    '<p id="p1">Read the goal first, then find the two notes that serve it.</p></div>';
  document.body.appendChild(container);
  const ref = { current: container };
  root = createRoot(document.createElement('div'));
  act(() => root.render(
    <>
      <TextLookupPopover containerRef={ref} enabled />
      <AnnotationLayer surface="lesson" targetId={1} scope="lesson:1" lookupBelow />
    </>,
  ));
}

function pointer(type: 'pointerdown' | 'pointerup', pointerType: string, target: EventTarget) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  act(() => { target.dispatchEvent(event); });
}

/** A tap or click the way the browser delivers it: pointer down, pointer up, click. */
function tap(target: HTMLElement, pointerType: 'touch' | 'mouse') {
  pointer('pointerdown', pointerType, target);
  pointer('pointerup', pointerType, target);
  act(() => target.click());
}

function selectWords(words: string, pointerType: 'touch' | 'mouse') {
  const p = container.querySelector('#p1')!;
  pointer('pointerdown', pointerType, p);
  const node = p.firstChild as Text;
  const at = node.data.indexOf(words);
  const range = document.createRange();
  range.setStart(node, at);
  range.setEnd(node, at + words.length);
  act(() => {
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  pointer('pointerup', pointerType, p);
  settle();
}

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  vi.useFakeTimers();
  Range.prototype.getBoundingClientRect = () => new DOMRect(40, 40, 80, 18);
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  const store = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear() },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Look Up and the highlighter on one selection', () => {
  it('phone: tapping «Look up» opens the card and the toolbar moves above it — it never re-opens on top', async () => {
    mount();
    await act(async () => { await Promise.resolve(); });
    selectWords('Read the goal', 'touch');
    expect(chip()).not.toBeNull();
    const before = toolbar();
    expect(before).not.toBeNull();

    tap(chip()!, 'touch');
    settle(400);
    // The card's arrival reaches the layer through a MutationObserver (a microtask), then a frame.
    await act(async () => { await Promise.resolve(); });
    act(() => { vi.runOnlyPendingTimers(); });

    expect(card()).not.toBeNull();
    // The same toolbar, still open (not closed and re-opened by the tap), now above the text.
    expect(toolbar()).toBe(before);
    // Was under the selection (the OS menu is above), now above it, clear of the card.
    expect(toolbar()?.dataset.placement).toBe('top');
  });

  it('desktop: both open; using one never closes the other', async () => {
    mount();
    await act(async () => { await Promise.resolve(); });
    selectWords('two notes', 'mouse');
    expect(card()).not.toBeNull();
    const bar = toolbar();
    expect(bar).not.toBeNull();

    // A click inside the Look Up card keeps the toolbar, and doesn't re-open it.
    const kz = Array.from(card()!.querySelectorAll('button')).find((b) => /KZ|ҚАЗ|kk/i.test(b.textContent || ''))
      ?? card()!.querySelector('button')!;
    tap(kz, 'mouse');
    settle(400);
    expect(toolbar()).toBe(bar);

    // A colour in the toolbar saves the highlight and leaves the translation open.
    tap(toolbar()!.querySelector('button')!, 'mouse');
    settle(400);
    expect(card()).not.toBeNull();
    expect(bar?.dataset.placement).toBe('top');
  });
});

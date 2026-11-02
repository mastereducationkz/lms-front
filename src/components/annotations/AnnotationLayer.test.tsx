// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  listAnnotations: vi.fn(),
  createAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
  importAnnotations: vi.fn(),
}));
const usage = vi.hoisted(() => ({ reportUsage: vi.fn() }));
vi.mock('../../services/api/annotations', () => api);
vi.mock('../../services/api/usage', () => usage);
vi.mock('../../lib/sentry', () => ({ reportError: vi.fn() }));
vi.mock('../Toast', () => ({ toast: vi.fn() }));
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext({ user: { role: 'student' } }) };
});

import { AnnotationLayer, type LegacyHighlight } from './AnnotationLayer';
import { t } from '../../lib/i18n';
import '@/lib/i18n/catalogs/lessonPlayer';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEXT = 'Its permafrost location keeps the seeds frozen.';
const saved = {
  id: 7, block_key: 'q:1:p', color: 'yellow', start_offset: 4, end_offset: 23, quote: 'permafrost location',
  prefix: 'Its ', suffix: ' keeps the seeds frozen.', note: null, attempt_no: 1,
};

let root: Root | null = null;
let block: HTMLParagraphElement;
let rerender: () => Promise<void>;

async function show(props: Partial<React.ComponentProps<typeof AnnotationLayer>> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  rerender = () => act(async () => {
    root!.render(
      <div>
        <p data-annotation-scope="quiz:5" data-annotation-block="q:1:p">{TEXT}</p>
        <AnnotationLayer surface="quiz" targetId={5} scope="quiz:5" {...props} />
      </div>,
    );
  });
  await rerender();
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  block = document.querySelector('p')!;
}

const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const button = (label: string) =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-annotation-toolbar] button')).find((b) => b.getAttribute('aria-label') === label);

beforeEach(() => {
  vi.clearAllMocks();
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  // jsdom has no layout: give every range one box so taps can find highlights.
  Range.prototype.getClientRects = function () {
    return [{ left: 0, right: 200, top: 0, bottom: 20, width: 200, height: 20 }] as unknown as DOMRectList;
  };
  Range.prototype.getBoundingClientRect = function () { return new DOMRect(0, 0, 200, 20); };
  api.listAnnotations.mockResolvedValue({ attempt_no: 1, annotations: [] });
  api.createAnnotation.mockImplementation(async (_s: string, _t: number, body: object) => ({ ...body, id: 99, attempt_no: 1 }));
  api.updateAnnotation.mockImplementation(async (id: number, patch: object) => ({ ...saved, id, ...patch }));
  api.deleteAnnotation.mockResolvedValue(undefined);
  api.importAnnotations.mockResolvedValue({ imported: 1 });
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('AnnotationLayer', () => {
  it('opens the toolbar on a settled selection and saves the highlight with its anchor', async () => {
    await show();
    expect(api.listAnnotations).toHaveBeenCalledWith('quiz', 5, 'current');
    expect(usage.reportUsage).toHaveBeenCalledWith('quiz.highlight', 'exposed');

    const range = document.createRange();
    range.setStart(block.firstChild!, 4);
    range.setEnd(block.firstChild!, 23);
    await act(async () => {
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
      document.dispatchEvent(new Event('selectionchange'));
    });
    await wait(350);

    expect(usage.reportUsage).toHaveBeenCalledWith('quiz.highlight', 'offered');
    await act(async () => { button(t('lessonPlayer.annotate.pink'))!.click(); });
    expect(api.createAnnotation).toHaveBeenCalledWith('quiz', 5, expect.objectContaining({
      block_key: 'q:1:p', color: 'pink', start_offset: 4, end_offset: 23, quote: 'permafrost location', prefix: 'Its ',
    }));
    expect(usage.reportUsage).toHaveBeenCalledWith('quiz.highlight', 'add');
    expect(document.querySelector('[data-annotation-toolbar]')).toBeNull();
  });

  it('a tap on a highlight lets the student recolour it, add a note, or remove it', async () => {
    api.listAnnotations.mockResolvedValue({ attempt_no: 1, annotations: [saved] });
    await show();

    const tap = () => act(async () => { block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 })); });
    await tap();
    await act(async () => { button(t('lessonPlayer.annotate.blue'))!.click(); });
    expect(api.updateAnnotation).toHaveBeenCalledWith(7, { color: 'blue' });

    await tap();
    await act(async () => { button(t('lessonPlayer.annotate.note'))!.click(); });
    const textarea = document.querySelector<HTMLTextAreaElement>('[data-annotation-toolbar] textarea')!;
    expect(textarea.maxLength).toBe(500);
    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setValue.call(textarea, 'location = why it works');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { textarea.form!.requestSubmit(); });
    expect(api.updateAnnotation).toHaveBeenCalledWith(7, { note: 'location = why it works' });

    await tap();
    await act(async () => { button(t('lessonPlayer.annotate.delete'))!.click(); });
    await wait(0);
    expect(api.deleteAnnotation).toHaveBeenCalledWith(7);
    expect(usage.reportUsage).toHaveBeenCalledWith('quiz.highlight', 'remove');
  });

  it('read-only (a finished attempt) shows highlights but opens no toolbar', async () => {
    api.listAnnotations.mockResolvedValue({ attempt_no: 1, annotations: [saved] });
    await show({ readOnly: true, attempt: 'latest' });
    expect(api.listAnnotations).toHaveBeenCalledWith('quiz', 5, 'latest');
    await act(async () => { block.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 10, clientY: 10 })); });
    expect(document.querySelector('[data-annotation-toolbar]')).toBeNull();
  });

  it('moves the old device-only highlights to the server once and keeps the ones it could not place', async () => {
    const old: LegacyHighlight[] = [
      { blockKeys: ['q:1:p'], quote: 'seeds  frozen', color: 'blue' },
      { blockKeys: ['q:2:p'], quote: 'elsewhere', color: 'pink' },
    ];
    const keep = vi.fn();
    await show({ legacy: { read: () => old, keep } });
    await wait(0);
    expect(api.importAnnotations).toHaveBeenCalledTimes(1);
    expect(api.importAnnotations).toHaveBeenCalledWith('quiz', 5, [expect.objectContaining({
      block_key: 'q:1:p', color: 'blue', quote: 'seeds frozen', start_offset: 34, end_offset: 46,
    })]);
    expect(keep).toHaveBeenCalledWith([old[1]]);
  });

  it('tries the import once per visit: a refused batch is not resent on every render', async () => {
    api.importAnnotations.mockRejectedValue(Object.assign(new Error('422'), { response: { status: 422 } }));
    const old: LegacyHighlight[] = [{ blockKeys: ['q:1:p'], quote: 'seeds frozen', color: 'blue' }];
    const keep = vi.fn();
    await show({ legacy: { read: () => old, keep } });
    await wait(0);
    // more renders of the page around the layer
    for (let i = 0; i < 3; i++) {
      await rerender();
      await wait(20);
    }
    expect(api.importAnnotations).toHaveBeenCalledTimes(1);
    expect(keep).not.toHaveBeenCalled();
  });
});


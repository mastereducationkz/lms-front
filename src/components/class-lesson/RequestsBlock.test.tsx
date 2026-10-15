// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RequestsBlock } from './LessonBlocks';
import type { LessonView } from '../../services/api/classLessons';

// The lesson page's request block (owner, 2026-10-15: «the button is not here»). A teacher's own lesson
// offers every kind of request, «Временная отмена» included; a kind already waiting for an answer is
// not offered twice.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const view = (over: Partial<LessonView> = {}) =>
  ({ requests: [], request_new_url: '/lesson-requests/new?event_id=7&group_id=3', ...over }) as LessonView;

const render = (v: LessonView, locale: 'en' | 'ru' = 'en') =>
  act(() => root.render(<MemoryRouter><RequestsBlock view={v} locale={locale} /></MemoryRouter>));

const buttons = () => Array.from(container.querySelectorAll('button'));

describe('the request block of a lesson page', () => {
  it('offers «Временная отмена» beside substitute, reschedule and cancel', () => {
    render(view());
    expect(buttons().map((b) => b.textContent)).toEqual(['Substitute', 'Reschedule', 'Cancel lesson', 'Temporary cancel']);
    render(view(), 'ru');
    expect(buttons().map((b) => b.textContent)).toContain('Временная отмена');
  });

  it('does not offer a kind that is already waiting for an answer', () => {
    render(view({ requests: [{ id: 1, type: 'hold', status: 'pending', created_at: null, requester: 'Айша' }] }));
    const hold = buttons().find((b) => b.textContent === 'Temporary cancel')!;
    expect(hold.disabled).toBe(true);
    expect(buttons().find((b) => b.textContent === 'Reschedule')!.disabled).toBe(false);
  });

  it('says where an approved hold is, not just «approved»', () => {
    render(view({ requests: [{ id: 2, type: 'hold', status: 'approved', hold_state: 'waiting', created_at: null, requester: 'Айша' }] }));
    expect(container.textContent).toContain('Temporary cancel');
    expect(container.textContent).toContain('waiting for a new time');
    expect(container.textContent).not.toContain('approved');
  });

  it('offers nothing to someone who cannot request, and says so when there is nothing to list', () => {
    render(view({ request_new_url: null }));
    expect(buttons()).toHaveLength(0);
    expect(container.textContent).toContain('No requests for this lesson.');
  });
});

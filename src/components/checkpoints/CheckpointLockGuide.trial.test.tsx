// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The guide's checkpoint helpers sit next to the API client, which reads stored tokens on import.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  });
});

import { setActiveLocale } from '../../lib/i18n/locale';
import CheckpointLockGuide from './CheckpointLockGuide';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function show(reasonCode: string | null, detail: string) {
  act(() => root.render(
    <CheckpointLockGuide
      lock={null}
      unitTitle="Unit 3"
      courseId="15"
      detail={detail}
      reasonCode={reasonCode}
      onNavigate={() => {}}
    />,
  ));
  return container.textContent ?? '';
}

beforeEach(() => {
  setActiveLocale('en');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('CheckpointLockGuide for a trial prospect', () => {
  it('says the lesson is outside the trial and offers the full course, not checkpoints', () => {
    const text = show('trial_locked', 'Not included in your trial');
    expect(text).toContain('This lesson isn’t part of your trial.');
    expect(text).toContain('Not included in your trial');
    expect(text).toContain('To get the whole course, write to us');
    expect(text).not.toContain('My checkpoints');
    expect(text).not.toContain('curator');
    const contact = container.querySelector('a');
    expect(contact?.getAttribute('href')).toBe('https://wa.me/77071064065');
    expect(contact?.textContent).toBe('Get the full course');
  });

  it('keeps the usual advice for every other lock', () => {
    const text = show('course_access_denied', "You don't have access to this course.");
    expect(text).toContain('My checkpoints');
    expect(text).not.toContain('Get the full course');
  });
});

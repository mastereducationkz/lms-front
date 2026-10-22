// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The banner reads the signed-in user; a stand-in context gives it one without the API client.
let signedIn: Record<string, unknown> | null = null;
vi.mock('../contexts/AuthContext.tsx', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined), useAuth: () => ({ user: signedIn }) };
});
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined), useAuth: () => ({ user: signedIn }) };
});

import { setActiveLocale } from '../lib/i18n/locale';
import AccessEndingBanner from './AccessEndingBanner';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const student = (days: number, extra: Record<string, unknown> = {}) => ({
  id: '5', role: 'student', access_until: '2026-12-07', access_days_left: days, ...extra,
});

function show() {
  act(() => root.render(<AccessEndingBanner />));
  return container.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-30T07:00:00Z')); // 12:00 Almaty
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
  setActiveLocale('ru');
  signedIn = student(7);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AccessEndingBanner', () => {
  it('tells a student, in Russian, when access ends and whom to write to', () => {
    expect(show()).toContain('Ваш доступ к платформе заканчивается 7 декабря 2026. Чтобы продлить, напишите менеджеру: @master_education_manager');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://t.me/master_education_manager');
    expect(link?.textContent).toBe('@master_education_manager');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('says it in English for a student who reads English', () => {
    setActiveLocale('en');
    expect(show()).toContain('Your access to the platform ends on 7 December 2026. To extend it, message the manager: @master_education_manager');
  });

  it('on the last day says that today is the last day', () => {
    signedIn = student(0, { access_until: '2026-11-30' });
    expect(show()).toContain('Сегодня последний день вашего доступа к платформе. Чтобы продлить, напишите менеджеру');
    setActiveLocale('en');
    expect(show()).toContain('Today is the last day of your access to the platform.');
  });

  it('is shown from 30 days out and not before, nor without a date, nor to anyone but a student', () => {
    signedIn = student(30);
    expect(show()).toContain('Ваш доступ');
    for (const user of [student(31), student(-1), student(7, { access_until: null }), student(7, { role: 'parent' }), student(7, { role: 'teacher' }), null]) {
      signedIn = user;
      expect(show()).toBe('');
    }
  });

  it('hides for the day when dismissed, and returns the next day', () => {
    expect(show()).toContain('Ваш доступ');
    const close = container.querySelector('button');
    expect(close?.getAttribute('aria-label')).toBe('Скрыть до завтра');
    act(() => close!.click());
    expect(container.textContent).toBe('');
    // A new visit the same day (a fresh mount) stays hidden…
    act(() => root.unmount());
    root = createRoot(container);
    expect(show()).toBe('');
    // …and the next Almaty day it is back.
    vi.setSystemTime(new Date('2026-12-01T07:00:00Z'));
    signedIn = student(6);
    act(() => root.unmount());
    root = createRoot(container);
    expect(show()).toContain('Ваш доступ');
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(undefined) };
});
vi.mock('../../services/api/targets', () => ({
  getStudentTargets: vi.fn(() => new Promise(() => {})),
  band: (n: unknown) => String(n),
  score: (n: unknown) => String(n),
}));

import { getStudentTargets } from '../../services/api/targets';
import { setActiveLocale } from '../../lib/i18n/locale';
import { ChildCard } from './ChildCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const live = { id: 7, name: 'Aigerim Sadykova', group_name: 'SAT Dreamville', access_ended: false, access_until: null };
const ended = { id: 8, name: 'Dana Sadykova', group_name: null, access_ended: true, access_until: '2026-11-06' };

let container: HTMLDivElement;
let root: Root;

function show(child: Parameters<typeof ChildCard>[0]['child']) {
  act(() => root.render(<ChildCard child={child} />));
  return container;
}

beforeEach(() => {
  vi.mocked(getStudentTargets).mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('ChildCard', () => {
  it('shows a studying child as before: name, group, and their targets are asked for', () => {
    setActiveLocale('en');
    const card = show(live);
    expect(card.textContent).toContain('Aigerim Sadykova');
    expect(card.textContent).toContain('SAT Dreamville');
    expect(card.textContent).not.toContain('ended on');
    expect(getStudentTargets).toHaveBeenCalledWith(7);
  });

  it('lists a child whose access ended with the day and the manager', () => {
    setActiveLocale('ru');
    const card = show(ended);
    expect(card.textContent).toContain('Dana Sadykova');
    expect(card.textContent).toContain('Доступ ребёнка к платформе закончился 6 ноября 2026.');
    expect(card.textContent).toContain('Чтобы продлить, напишите менеджеру: @master_education_manager');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('https://t.me/master_education_manager');
  });

  it('shows nothing of that child’s studies and asks the server for none', () => {
    setActiveLocale('ru');
    const card = show(ended);
    expect(card.textContent).not.toContain('Без группы');
    expect(card.textContent).not.toContain('Цели');
    expect(getStudentTargets).not.toHaveBeenCalled();
  });

  it('says it in English for a parent who reads English', () => {
    setActiveLocale('en');
    expect(show(ended).textContent).toContain('Your child’s access to the platform ended on 6 November 2026. To extend it, message the manager: @master_education_manager');
  });
});

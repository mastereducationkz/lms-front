// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin' } }) };
});

import EventRowMenu from './EventRowMenu';
import type { Event } from '../../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

const lesson = { id: 7, title: 'Lesson', event_type: 'class' } as unknown as Event;
const officeHour = { id: 8, title: 'IELTS Speaking Club', event_type: 'webinar' } as unknown as Event;
const deadline = { id: 99, title: 'Homework due', event_type: 'assignment' } as unknown as Event;

let root: Root | null = null;
let host: HTMLDivElement;
function Where() { return <span data-where>{useLocation().pathname + useLocation().hash}</span>; }
async function open(event: Event, virtual = false) {
  const onViewDetails = vi.fn();
  const onDelete = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <MemoryRouter initialEntries={['/admin/events']}>
        <EventRowMenu event={event} virtual={virtual} onViewDetails={onViewDetails} onDelete={onDelete} />
        <Where />
      </MemoryRouter>,
    );
  });
  const button = host.querySelector('button') as HTMLButtonElement;
  await act(async () => {
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
  });
  return { onViewDetails, onDelete };
}
const items = () => Array.from(document.body.querySelectorAll('[role="menuitem"]'));
const item = (label: string) => items().find((i) => i.textContent?.includes(label)) as HTMLElement;
const where = () => host.querySelector('[data-where]')?.textContent;

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('Manage events: the ⋯ menu of a row', () => {
  it('View Details hands the row to the detail card instead of leaving the page', async () => {
    const { onViewDetails } = await open(lesson);
    await act(async () => { item('View Details').click(); });
    expect(onViewDetails).toHaveBeenCalledWith(lesson);
    expect(where()).toBe('/admin/events');
  });

  it('Participants of a class lesson opens its register, a page that exists', async () => {
    await open(lesson);
    await act(async () => { item('Participants').click(); });
    expect(where()).toBe('/lessons/7#register');
  });

  it('an office hour has no Participants: it is linked to a course, not to groups', async () => {
    await open(officeHour);
    expect(items().map((i) => i.textContent?.trim())).toEqual(['View Details', 'Delete']);
  });

  it('a generated deadline cannot be deleted and has no Participants either', async () => {
    await open(deadline, true);
    expect(items().map((i) => i.textContent?.trim())).toEqual(['View Details', 'Delete']);
    expect(item('Delete').getAttribute('aria-disabled')).toBe('true');
  });
});

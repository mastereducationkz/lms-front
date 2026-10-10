// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { id: 7, role: 'student' } }) };
});

// The recording section and the platform links reach for the API client, which the card of a webinar never uses.
vi.mock('./LessonRecordingSection', () => ({ default: () => null }));
vi.mock('../../lib/platformLinks', () => ({ openPlatformPage: vi.fn(), parsePlatformUrl: () => null }));

import EventDetailDialog from './EventDetailDialog';
import type { Event } from '../../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;

let root: Root | null = null;
async function show(event: Partial<Event>) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const full = { id: 1, title: 'NUET Math Office Hours', event_type: 'webinar', start_datetime: '2099-01-03T09:00:00Z', end_datetime: '2099-01-03T10:00:00Z',
    is_online: true, created_by: 1, is_active: true, is_recurring: false, participant_count: 0, meeting_url: 'https://meet.google.com/abc-defg-hij', ...event } as Event;
  await act(async () => {
    root!.render(<MemoryRouter><EventDetailDialog event={full} open onOpenChange={() => {}} user={{ id: 7, role: 'student' }} /></MemoryRouter>);
  });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const hostRow = () => Array.from(document.body.querySelectorAll('[data-host]'));

describe('event card: the host of a webinar', () => {
  it('names the host on its own line, apart from the title', async () => {
    await show({ teacher_name: 'Орынбасар Ақжол Ерғалиұлы' });
    expect(hostRow()).toHaveLength(1);
    expect(hostRow()[0].textContent).toBe('Host: Орынбасар Ақжол Ерғалиұлы');
    expect(document.body.textContent).toContain('NUET Math Office Hours');
  });

  it('has no host line when the webinar has no teacher', async () => {
    await show({ teacher_name: undefined });
    expect(hostRow()).toHaveLength(0);
  });

  it('a class lesson keeps its short card: the lesson page names the teacher', async () => {
    await show({ event_type: 'class', teacher_name: 'Орынбасар Ақжол Ерғалиұлы' });
    expect(hostRow()).toHaveLength(0);
  });
});

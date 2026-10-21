// @vitest-environment jsdom
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, unmount } from './publicWebinarsTestKit';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role, ui_language: 'en' } }) };
});
const getEventDetails = vi.hoisted(() => vi.fn());
vi.mock('../services/api', () => ({ getEventDetails }));

// The form and the card have their own tests and talk to the API client: markers stand in, carrying what the pages hand them.
vi.mock('../components/EventForm', async () => {
  const { createElement } = await import('react');
  return {
    default: (p: { accessError?: string | null; onAccessFailed?: (event: { id: number; title: string }, message: string) => void }) =>
      createElement('div', { 'data-form': p.accessError ?? 'none' },
        createElement('button', { id: 'fail', onClick: () => p.onAccessFailed?.({ id: 501, title: 'Open day' }, 'This address is already used by another webinar.') }, 'fail')),
  };
});
vi.mock('../components/open-webinars/OpenAccessCard', async () => {
  const { createElement } = await import('react');
  return { default: (p: { eventId: number; initialError?: string | null }) => createElement('i', { 'data-card': p.eventId, 'data-error': p.initialError ?? '' }) };
});

import CreateEvent from './CreateEvent';
import EditEvent from './EditEvent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Where() {
  const location = useLocation();
  return <p data-where>{location.pathname}|{JSON.stringify(location.state)}</p>;
}
beforeEach(() => {
  auth.role = 'admin';
  getEventDetails.mockReset();
  getEventDetails.mockResolvedValue({ id: 501, title: 'Open day', event_type: 'webinar' });
});
afterEach(unmount);

describe('create page: the event was made but its public access did not save', () => {
  it.each([['/admin/events/create'], ['/curator/events/create']])('%s opens the event’s edit page and hands over the reason', async (path) => {
    await mount(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={<CreateEvent />} />
          <Route path="/admin/events/:eventId/edit" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    await click(document.querySelector('#fail'));
    expect(document.querySelector('[data-where]')?.textContent).toBe('/admin/events/501/edit|{"accessError":"This address is already used by another webinar."}');
  });
});

describe('edit page', () => {
  const open = (state?: unknown) => mount(
    <MemoryRouter initialEntries={[{ pathname: '/admin/events/501/edit', state }]}>
      <Routes><Route path="/admin/events/:eventId/edit" element={<EditEvent />} /></Routes>
    </MemoryRouter>,
  );

  it('passes the reason the access did not save on to the form, so its card can show it', async () => {
    await open({ accessError: 'This address is already used by another webinar.' });
    await settle();
    expect(document.querySelector('[data-form]')?.getAttribute('data-form')).toBe('This address is already used by another webinar.');
  });

  it('has no reason to show when it is opened normally', async () => {
    await open();
    await settle();
    expect(document.querySelector('[data-form]')?.getAttribute('data-form')).toBe('none');
  });

  it('a head curator, who cannot edit events, gets the public access card alone, with the reason', async () => {
    auth.role = 'head_curator';
    await open({ accessError: 'This address is already used by another webinar.' });
    await settle();
    expect(document.querySelector('[data-form]')).toBeNull();
    expect(document.querySelector('[data-card]')?.getAttribute('data-card')).toBe('501');
    expect(document.querySelector('[data-card]')?.getAttribute('data-error')).toBe('This address is already used by another webinar.');
    expect(text()).toContain('Open day');
  });
});

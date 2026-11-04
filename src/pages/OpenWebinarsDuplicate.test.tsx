// @vitest-environment jsdom
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, unmount } from './publicWebinarsTestKit';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role, ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOverview: vi.fn(), retryFailedLeads: vi.fn(), getOpenAccess: vi.fn(), listRegistrations: vi.fn(), retryLead: vi.fn(),
  getRecordingStatus: vi.fn(), publishRecording: vi.fn(), withdrawRecording: vi.fn(),
}));
vi.mock('../services/api/openWebinars', () => api);
const getEventDetails = vi.hoisted(() => vi.fn());
vi.mock('../services/api/events', () => ({ getEventDetails }));
vi.mock('../services/api', () => ({ getEventDetails }));
// The create page's form is covered by EventForm.duplicate.test.tsx; here only what the page hands it matters.
vi.mock('../components/EventForm', () => ({
  default: ({ duplicate }: { duplicate?: unknown }) => <pre data-form>{JSON.stringify(duplicate ?? null)}</pre>,
}));

import OverviewCard from '../components/open-webinars/OverviewCard';
import OpenWebinarRegistrationsPage from './OpenWebinarRegistrationsPage';
import CreateEvent from './CreateEvent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ITEM = {
  event_id: 77, title: 'SAT Math open day', start_datetime: '2099-03-03T09:00:00Z', end_datetime: '2099-03-03T10:30:00Z', is_active: true,
  access_mode: 'registration', slug: 'sat-math-open-day', registered: 4, consultations: 1, joined: 0, leads_sent: 4, leads_pending: 0, leads_failed: 0,
};
const funnel = { registered: 4, joined: 0, consultation_requests: 1, leads_sent: 4, leads_pending: 0, leads_failed: 0, existing_students: 0 };
const ACCESS = {
  event_id: 77, open: true, access_mode: 'registration', slug: 'sat-math-open-day', speaker_id: 3, presenter: 'host', lead_pipeline_id: 10520038,
  banner_url: '/uploads/webinar_banners/a.png', ask_profile: true, funnel,
};
const SOURCE = {
  id: 77, title: 'SAT Math open day', description: 'Bring a calculator.', event_type: 'webinar', start_datetime: '2099-03-03T09:00:00',
  end_datetime: '2099-03-03T10:30:00', is_online: true, course_ids: [3], group_ids: [], teacher_id: 5,
};

function Where() {
  const location = useLocation();
  return <span data-where>{location.pathname + location.search}</span>;
}
const duplicateLinks = () => Array.from(document.querySelectorAll('a[data-duplicate]')) as HTMLAnchorElement[];

beforeEach(() => {
  auth.role = 'admin';
  Object.values(api).forEach((fn) => fn.mockReset());
  getEventDetails.mockReset();
  api.getOverview.mockResolvedValue({ failed_total: 0, items: [ITEM] });
  api.getOpenAccess.mockResolvedValue(ACCESS);
  api.listRegistrations.mockResolvedValue([]);
  api.getRecordingStatus.mockResolvedValue({ has_recording: false, recording_status: null, ready: false, duration_seconds: null, published: false, published_at: null, withdrawn_at: null, views: 0 });
  getEventDetails.mockResolvedValue(SOURCE);
});
afterEach(unmount);

describe('«Duplicate» on the open-webinar overview', () => {
  const show = () => mount(
    <MemoryRouter initialEntries={['/admin/open-webinars']}>
      <Routes><Route path="*" element={<><OverviewCard /><Where /></>} /></Routes>
    </MemoryRouter>,
  );

  it.each([['admin', '/admin/events/create?duplicate=77'], ['head_teacher', '/admin/events/create?duplicate=77'], ['head_curator', '/curator/events/create?duplicate=77']])(
    '%s gets it on each row, and it opens the create form with the source', async (role, href) => {
      auth.role = role;
      await show();
      const [link] = duplicateLinks();
      expect(link.textContent).toBe('Duplicate');
      expect(link.getAttribute('href')).toBe(href);
      await click(link);
      // The row's own click (open the registrations) does not fire as well.
      expect(document.querySelector('[data-where]')?.textContent).toBe(href);
    },
  );

  it.each(['teacher', 'curator'])('%s does not', async (role) => {
    auth.role = role;
    await show();
    expect(document.querySelector('[data-event="77"]')).not.toBeNull();
    expect(duplicateLinks()).toHaveLength(0);
  });
});

describe('«Duplicate» on a webinar’s own page', () => {
  const show = () => mount(
    <MemoryRouter initialEntries={['/admin/open-webinars/77']}>
      <Routes><Route path="/admin/open-webinars/:eventId" element={<OpenWebinarRegistrationsPage />} /></Routes>
    </MemoryRouter>,
  );

  it.each(['admin', 'head_teacher', 'head_curator'])('%s gets it', async (role) => {
    auth.role = role;
    await show();
    expect(duplicateLinks().map((a) => a.dataset.duplicate)).toEqual(['77']);
  });

  it('a role that does not run open webinars does not', async () => {
    auth.role = 'teacher';
    await show();
    expect(duplicateLinks()).toHaveLength(0);
  });
});

describe('the create page with ?duplicate=', () => {
  const show = (url: string) => mount(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="*" element={<CreateEvent />} /></Routes>
    </MemoryRouter>,
  );
  const handed = () => JSON.parse(document.querySelector('[data-form]')?.textContent ?? 'null');

  it('loads the source webinar and its access, and hands the form the copy', async () => {
    await show('/admin/events/create?duplicate=77');
    await settle();
    expect(getEventDetails).toHaveBeenCalledWith(77);
    expect(api.getOpenAccess).toHaveBeenCalledWith(77);
    expect(handed()).toMatchObject({
      sourceTitle: 'SAT Math open day', durationMinutes: 90,
      seed: { event_type: 'webinar', description: 'Bring a calculator.', teacher_id: 5, course_ids: [3] },
      access: { mode: 'registration', pipelineId: 10520038, askProfile: true, presenter: 'host', slug: '', bannerUrl: null, speakerId: null },
    });
  });

  it('without the parameter the form is the usual empty one', async () => {
    await show('/admin/events/create');
    expect(getEventDetails).not.toHaveBeenCalled();
    expect(handed()).toBeNull();
  });

  it('a curator cannot copy an open webinar: the parameter is ignored', async () => {
    auth.role = 'curator';
    await show('/curator/events/create?duplicate=77');
    expect(api.getOpenAccess).not.toHaveBeenCalled();
    expect(handed()).toBeNull();
  });

  it('when the source cannot be loaded, says so above an empty form', async () => {
    api.getOpenAccess.mockRejectedValue(new Error('Not found'));
    await show('/admin/events/create?duplicate=77');
    await settle();
    expect(document.querySelector('[data-duplicate-failed]')?.textContent).toContain('Couldn’t load the webinar to copy');
    expect(handed()).toBeNull();
  });
});

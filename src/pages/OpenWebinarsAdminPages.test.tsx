// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, type, unmount } from './publicWebinarsTestKit';

vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin', ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOpenSettings: vi.fn(), saveOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), createGuestSpeaker: vi.fn(), updateGuestSpeaker: vi.fn(),
  retireGuestSpeaker: vi.fn(), getOpenAccess: vi.fn(), listRegistrations: vi.fn(), retryLead: vi.fn(),
}));
vi.mock('../services/api/openWebinars', () => api);
const getEventDetails = vi.hoisted(() => vi.fn());
vi.mock('../services/api/events', () => ({ getEventDetails }));

import OpenWebinarRegistrationsPage from './OpenWebinarRegistrationsPage';
import OpenWebinarsAdminPage from './OpenWebinarsAdminPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const settings = (over = {}) => ({
  policy_text: '', policy_version: '', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }], ...over,
});
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;
const setTextarea = async (el: HTMLTextAreaElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  const { act } = await import('react');
  await act(async () => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  getEventDetails.mockReset();
});
afterEach(unmount);

describe('Admin → Open webinars', () => {
  beforeEach(() => {
    api.getOpenSettings.mockResolvedValue(settings());
    api.listGuestSpeakers.mockResolvedValue([]);
  });
  const show = () => mount(<MemoryRouter><OpenWebinarsAdminPage /></MemoryRouter>);

  it('says no policy is published yet, and publishes one that was typed', async () => {
    api.saveOpenSettings.mockResolvedValue(settings({ policy_text: 'We keep your data safe.', policy_version: 'a1b2c3d4', policy_updated_at: '2026-10-16T10:00:00' }));
    await show();
    expect(text()).toContain('Not published yet');
    await setTextarea(document.querySelector('textarea[aria-label="Privacy policy"]') as HTMLTextAreaElement, 'We keep your data safe.');
    await click(button('Save'));
    await settle();
    expect(api.saveOpenSettings).toHaveBeenCalledWith({ policy_text: 'We keep your data safe.', consent_text_ru: 'ru', consent_text_en: 'en' });
    expect(text()).toContain('Published version a1b2c3d4');
    expect(text()).toContain('Saved');
  });

  it('adds a guest speaker as a profile and lists them', async () => {
    api.createGuestSpeaker.mockResolvedValue({ id: 5, name: 'Dr. Guest', organisation: 'Some University', bio: null, photo_url: null, email: null, is_active: true });
    await show();
    expect(text()).toContain('No guest speakers yet.');
    await click(button('Add speaker'));
    await type('#ow-sp-name', 'Dr. Guest');
    await type('#ow-sp-organisation', 'Some University');
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Save').pop() ?? null);
    await settle();
    expect(api.createGuestSpeaker).toHaveBeenCalledWith({ name: 'Dr. Guest', organisation: 'Some University', bio: null, photo_url: null, email: null });
    expect(text()).toContain('Dr. Guest');
    expect(text()).toContain('Some University');
  });

  it('removes a speaker from the list', async () => {
    api.listGuestSpeakers.mockResolvedValue([{ id: 5, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
    api.retireGuestSpeaker.mockResolvedValue({ ok: true });
    await show();
    await click(button('Remove'));
    await settle();
    expect(api.retireGuestSpeaker).toHaveBeenCalledWith(5);
    expect(text()).not.toContain('Dr. Guest');
  });
});

describe('a webinar’s registrations', () => {
  const funnel = { registered: 3, joined: 1, consultation_requests: 1, leads_sent: 2, leads_pending: 0, leads_failed: 1, existing_students: 0 };
  const row = (id: number, over = {}) => ({
    id, kind: 'registration', name: `Person ${id}`, phone: `+7700000000${id}`, email: `p${id}@example.com`, registered_at: '2026-10-16T10:00:00Z',
    joined: false, lead_state: 'sent', lead_outcome: 'created', lead_error: null, lead_attempts: 1, amo_lead_id: 100 + id, utm: {}, ...over,
  });
  async function show() {
    api.getOpenAccess.mockResolvedValue({ event_id: 7, open: true, access_mode: 'registration', slug: 'my-webinar', speaker_id: null, lead_pipeline_id: 10520038, funnel });
    getEventDetails.mockResolvedValue({ title: 'IELTS Writing Office Hours' });
    await mount(<MemoryRouter initialEntries={['/admin/open-webinars/7']}><Routes><Route path="/admin/open-webinars/:eventId" element={<OpenWebinarRegistrationsPage />} /></Routes></MemoryRouter>);
  }

  it('shows the funnel, every person and where their lead stands', async () => {
    api.listRegistrations.mockResolvedValue([
      row(1, { joined: true }), row(2, { lead_outcome: 'tagged_existing' }), row(3, { kind: 'consultation', email: null, lead_state: 'failed', lead_error: 'CRM: HTTP 502' }),
      row(4, { lead_state: 'pending', lead_outcome: null }), row(5, { lead_state: 'skipped_student', lead_outcome: 'existing_client' }),
    ]);
    await show();
    expect(text()).toContain('Registrations: IELTS Writing Office Hours');
    expect(document.querySelector('[data-tile="registered"]')?.textContent).toContain('3');
    expect(document.querySelector('[data-tile="sent"]')?.textContent).toContain('2');
    const lead = (id: number) => document.querySelector(`[data-row="${id}"] td:last-child`)?.textContent ?? '';
    expect(lead(1)).toBe('New lead');
    expect(lead(2)).toBe('Added to an existing deal');
    expect(lead(3)).toContain('Failed');
    expect(lead(3)).toContain('CRM: HTTP 502');
    expect(lead(4)).toBe('Waiting');
    expect(lead(5)).toBe('Already a student');
    expect(document.querySelector('[data-row="1"]')?.textContent).toContain('✓');
    expect(document.querySelector('[data-row="3"]')?.textContent).toContain('Call-back');
  });

  it('retries a failed lead from the row and reloads', async () => {
    api.listRegistrations.mockResolvedValueOnce([row(3, { lead_state: 'failed', lead_error: 'boom' })]).mockResolvedValue([row(3, { lead_state: 'pending', lead_outcome: null })]);
    api.retryLead.mockResolvedValue({ id: 3, lead_state: 'pending' });
    await show();
    await click(button('Retry'));
    await settle();
    expect(api.retryLead).toHaveBeenCalledWith(3);
    expect(document.querySelector('[data-row="3"] td:last-child')?.textContent).toBe('Waiting');
  });

  it('says so when nobody has registered', async () => {
    api.listRegistrations.mockResolvedValue([]);
    await show();
    expect(text()).toContain('Nobody has registered yet.');
  });
});

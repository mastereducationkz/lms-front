// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, type, unmount } from './publicWebinarsTestKit';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role, ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOpenSettings: vi.fn(), saveOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), createGuestSpeaker: vi.fn(), updateGuestSpeaker: vi.fn(),
  retireGuestSpeaker: vi.fn(), uploadSpeakerPhoto: vi.fn(), getOpenAccess: vi.fn(), listRegistrations: vi.fn(), retryLead: vi.fn(),
  getRecordingStatus: vi.fn(), publishRecording: vi.fn(), withdrawRecording: vi.fn(), getOverview: vi.fn(), retryFailedLeads: vi.fn(),
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

const noRecording = { has_recording: false, recording_status: null, ready: false, duration_seconds: null, published: false, published_at: null, withdrawn_at: null, views: 0 };
beforeEach(() => {
  auth.role = 'admin';
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getRecordingStatus.mockResolvedValue(noRecording);
  api.getOverview.mockResolvedValue({ failed_total: 0, items: [] });
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
    expect(api.createGuestSpeaker).toHaveBeenCalledWith({ name: 'Dr. Guest', organisation: 'Some University', bio: null, name_en: null, bio_en: null, photo_url: null, email: null });
    expect(text()).toContain('Dr. Guest');
    expect(text()).toContain('Some University');
  });

  it('adds a speaker with an English name and bio, sent with the rest', async () => {
    api.createGuestSpeaker.mockResolvedValue({ id: 5, name: 'Др. Гость', organisation: null, bio: 'Лингвист', name_en: 'Dr. Guest', bio_en: 'A linguist', photo_url: null, email: null, is_active: true });
    await show();
    await click(button('Add speaker'));
    expect(document.querySelector('label[for="ow-sp-name_en"]')?.textContent).toBe('Name (English)');
    expect(document.querySelector('label[for="ow-sp-bio_en"]')?.textContent).toBe('About (English)');
    await type('#ow-sp-name', 'Др. Гость');
    await type('#ow-sp-name_en', 'Dr. Guest');
    await setTextarea(document.querySelector('#ow-sp-bio') as HTMLTextAreaElement, 'Лингвист');
    await setTextarea(document.querySelector('#ow-sp-bio_en') as HTMLTextAreaElement, 'A linguist');
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Save').pop() ?? null);
    await settle();
    expect(api.createGuestSpeaker).toHaveBeenCalledWith({ name: 'Др. Гость', organisation: null, bio: 'Лингвист', name_en: 'Dr. Guest', bio_en: 'A linguist', photo_url: null, email: null });
  });

  it('shows a speaker’s saved English text for editing, and a save that touches nothing else sends it back unchanged', async () => {
    api.listGuestSpeakers.mockResolvedValue([{ id: 5, name: 'Др. Гость', organisation: 'Вуз', bio: 'Лингвист', name_en: 'Dr. Guest', bio_en: 'A linguist', photo_url: '/uploads/webinar_speakers/a.jpg', email: 'g@example.com', is_active: true }]);
    api.updateGuestSpeaker.mockImplementation(async (id: number, body: object) => ({ id, is_active: true, ...body }));
    await show();
    await click(button('Edit'));
    expect((document.querySelector('#ow-sp-name_en') as HTMLInputElement).value).toBe('Dr. Guest');
    expect((document.querySelector('#ow-sp-bio_en') as HTMLTextAreaElement).value).toBe('A linguist');
    await type('#ow-sp-organisation', 'Университет');
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Save').pop() ?? null);
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, {
      name: 'Др. Гость', organisation: 'Университет', bio: 'Лингвист', name_en: 'Dr. Guest', bio_en: 'A linguist', photo_url: '/uploads/webinar_speakers/a.jpg', email: 'g@example.com',
    });
  });

  it('clears a speaker’s English text when the fields are emptied', async () => {
    api.listGuestSpeakers.mockResolvedValue([{ id: 5, name: 'Др. Гость', organisation: null, bio: null, name_en: 'Dr. Guest', bio_en: 'A linguist', photo_url: null, email: null, is_active: true }]);
    api.updateGuestSpeaker.mockImplementation(async (id: number, body: object) => ({ id, is_active: true, ...body }));
    await show();
    await click(button('Edit'));
    await type('#ow-sp-name_en', '  ');
    await setTextarea(document.querySelector('#ow-sp-bio_en') as HTMLTextAreaElement, '');
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Save').pop() ?? null);
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, expect.objectContaining({ name_en: null, bio_en: null }));
  });

  it('edits a speaker an older server sent without any English fields', async () => {
    api.listGuestSpeakers.mockResolvedValue([{ id: 5, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
    api.updateGuestSpeaker.mockImplementation(async (id: number, body: object) => ({ id, is_active: true, ...body }));
    await show();
    await click(button('Edit'));
    expect((document.querySelector('#ow-sp-name_en') as HTMLInputElement).value).toBe('');
    await click(Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === 'Save').pop() ?? null);
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'Dr. Guest', name_en: null, bio_en: null }));
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

describe('Admin → Open webinars: the overview', () => {
  const item = (event_id: number, over = {}) => ({
    event_id, title: `Webinar ${event_id}`, start_datetime: '2026-10-20T09:00:00Z', end_datetime: '2026-10-20T10:00:00Z', is_active: true,
    access_mode: 'registration', slug: `w-${event_id}`, registered: 12, consultations: 1, joined: 5, leads_sent: 9, leads_pending: 0, leads_failed: 0, ...over,
  });
  beforeEach(() => {
    api.getOpenSettings.mockResolvedValue(settings());
    api.listGuestSpeakers.mockResolvedValue([]);
  });
  const show = (role = 'admin') => {
    auth.role = role;
    return mount(<MemoryRouter initialEntries={['/admin/open-webinars']}><Routes>
      <Route path="/admin/open-webinars" element={<OpenWebinarsAdminPage />} />
      <Route path="/admin/open-webinars/:eventId" element={<p data-opened>OPENED</p>} />
    </Routes></MemoryRouter>);
  };
  const row = (id: number) => document.querySelector(`[data-event="${id}"]`) as HTMLElement;

  it('lists every open webinar with its date, mode, registrations and failed leads', async () => {
    api.getOverview.mockResolvedValue({ failed_total: 2, items: [item(7, { access_mode: 'open', registered: 30 }), item(8, { leads_failed: 2, is_active: false })] });
    await show();
    expect(text()).toContain('Webinars open to everyone');
    expect(row(7).textContent).toContain('Webinar 7');
    expect(row(7).textContent).toContain('Anyone with the link');
    expect(row(7).textContent).toContain('30');
    expect(row(8).textContent).toContain('Anyone who registers');
    expect(row(8).textContent).toContain('Cancelled');
    expect(row(8).querySelector('td:last-child')?.className).toContain('text-red');
    expect(row(7).querySelector('td:last-child')?.className).not.toContain('text-red');
    expect(document.querySelector('[data-failed-total]')?.textContent).toBe('2 failed leads in total');
  });

  it('has a call-backs column: an open-link webinar has no registrations, only people who left their number', async () => {
    api.getOverview.mockResolvedValue({ failed_total: 0, items: [item(7, { access_mode: 'open', registered: 0, consultations: 4 }), item(8, { registered: 12, consultations: 0 })] });
    await show();
    const headers = Array.from(document.querySelectorAll('[data-overview] thead th')).map((th) => th.textContent);
    expect(headers).toEqual(['Webinar', 'Date', 'Access', 'Registered', 'Call-backs', 'Failed leads']);
    expect(row(7).querySelector('[data-consultations]')?.textContent).toBe('4');
    expect(row(7).querySelector('td:nth-child(4)')?.textContent).toBe('0');
    expect(row(8).querySelector('[data-consultations]')?.textContent).toBe('0');
    expect(row(8).querySelector('td:nth-child(4)')?.textContent).toBe('12');
  });

  it('opens a webinar’s registrations when its row is clicked', async () => {
    api.getOverview.mockResolvedValue({ failed_total: 0, items: [item(7)] });
    await show();
    await click(row(7));
    expect(text()).toContain('OPENED');
  });

  it('says so when nothing has been opened yet', async () => {
    await show();
    expect(text()).toContain('No webinar has been opened to everyone yet.');
  });

  it('retries every failed lead of every webinar in one click, says how many, and reloads', async () => {
    api.getOverview.mockResolvedValueOnce({ failed_total: 3, items: [item(7, { leads_failed: 3 })] }).mockResolvedValue({ failed_total: 0, items: [item(7)] });
    api.retryFailedLeads.mockResolvedValue({ retried: 3 });
    await show();
    await click(button('Retry all failed'));
    await settle();
    expect(api.retryFailedLeads).toHaveBeenCalledWith();
    expect(text()).toContain('Sent again: 3');
    expect(document.querySelector('[data-failed-total]')?.textContent).toBe('No failed leads.');
    expect(button('Retry all failed').disabled).toBe(true);
  });

  it('has nothing to retry when no lead failed, and shows a failure to retry', async () => {
    api.getOverview.mockResolvedValue({ failed_total: 0, items: [item(7)] });
    await show();
    expect(button('Retry all failed').disabled).toBe(true);
    await unmount();
    api.getOverview.mockResolvedValue({ failed_total: 1, items: [item(7, { leads_failed: 1 })] });
    api.retryFailedLeads.mockRejectedValue(new Error('CRM is down'));
    await show();
    await click(button('Retry all failed'));
    await settle();
    expect(text()).toContain('CRM is down');
  });

  it('says it could not load the list, and the rest of the page still works', async () => {
    api.getOverview.mockRejectedValue(new Error('boom'));
    await show();
    expect(text()).toContain('Couldn’t load the list of webinars.');
    expect(text()).toContain('Privacy policy');
  });
});

describe('Admin → Open webinars: who may change the settings', () => {
  beforeEach(() => {
    api.getOpenSettings.mockResolvedValue(settings({ policy_text: 'We keep your data safe.' }));
    api.listGuestSpeakers.mockResolvedValue([{ id: 5, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
  });
  const show = (role: string) => { auth.role = role; return mount(<MemoryRouter><OpenWebinarsAdminPage /></MemoryRouter>); };

  it('an admin edits the policy and the consent wording', async () => {
    await show('admin');
    expect(document.querySelector('[data-settings-readonly]')).toBeNull();
    expect((document.querySelector('textarea[aria-label="Privacy policy"]') as HTMLTextAreaElement).readOnly).toBe(false);
    expect(button('Save')).toBeTruthy();
  });

  it('an admin stops sending to amoCRM and turns it back on; the card says what off means', async () => {
    await show('admin');
    expect(document.querySelector('[data-leads-state]')?.textContent).toBe('Registrations and call-back requests are sent to amoCRM.');
    api.saveOpenSettings.mockResolvedValueOnce(settings({ policy_text: 'We keep your data safe.', leads_enabled: false }));
    await click(button('Stop sending to amoCRM'));
    await settle();
    expect(api.saveOpenSettings).toHaveBeenLastCalledWith({ leads_enabled: false });
    expect(document.querySelector('[data-leads-state]')?.textContent).toContain('stay in the LMS only');
    api.saveOpenSettings.mockResolvedValueOnce(settings({ policy_text: 'We keep your data safe.', leads_enabled: true }));
    await click(button('Send to amoCRM again'));
    await settle();
    expect(api.saveOpenSettings).toHaveBeenLastCalledWith({ leads_enabled: true });
  });

  it('a head teacher sees the state but has no switch', async () => {
    api.getOpenSettings.mockResolvedValue(settings({ policy_text: 'We keep your data safe.', leads_enabled: false }));
    await show('head_teacher');
    expect(document.querySelector('[data-leads-state]')?.textContent).toContain('stay in the LMS only');
    expect(button('Send to amoCRM again')).toBeUndefined();
  });

  it.each(['head_teacher', 'head_curator'])('a %s reads them, cannot save, and still manages the guest speakers', async (role) => {
    await show(role);
    expect(document.querySelector('[data-settings-readonly]')?.textContent).toContain('Only an admin can change');
    for (const el of Array.from(document.querySelectorAll('textarea')).slice(0, 3)) expect((el as HTMLTextAreaElement).readOnly).toBe(true);
    expect((document.querySelector('textarea[aria-label="Privacy policy"]') as HTMLTextAreaElement).value).toBe('We keep your data safe.');
    expect(button('Save')).toBeUndefined();
    expect(button('Add speaker')).toBeTruthy();
    expect(button('Remove')).toBeTruthy();
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
    expect(lead(1)).toBe('In amoCRM: «Распределение», responsible РОП');
    expect(lead(2)).toBe('Tag and note added to the client’s open deal');
    expect(lead(3)).toContain('Failed');
    expect(lead(3)).toContain('CRM: HTTP 502');
    expect(lead(4)).toBe('Waiting');
    expect(lead(5)).toBe('Already a student');
    expect(document.querySelector('[data-row="1"]')?.textContent).toContain('✓');
    expect(document.querySelector('[data-row="3"]')?.textContent).toContain('Call-back');
  });

  it('shows the extra questions’ answers under the person’s name', async () => {
    api.listRegistrations.mockResolvedValue([
      row(1, { answers: { role: 'parent', grade: '10', city: 'Almaty', intake_year: 'later', sat_score: 1450, ielts_score: 6.5, other_phone: '+77012223344', child_name: 'Erlan B' } }),
      row(2, { answers: null }),
    ]);
    await show();
    expect(document.querySelector('[data-row="1"] [data-answers]')?.textContent).toBe(
      'A parent · Child: Erlan B · Grade 10 · Almaty · Admission: Later · SAT 1450 · IELTS 6.5 · Student’s phone: +77012223344');
    expect(document.querySelector('[data-row="2"] [data-answers]')).toBeNull();
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


describe('a webinar’s registrations: paging, retry and lead labels', () => {
  const funnel = { registered: 130, joined: 1, consultation_requests: 0, leads_sent: 100, leads_pending: 0, leads_failed: 2, existing_students: 0 };
  const row = (id: number, over = {}) => ({
    id, kind: 'registration', name: `Person ${id}`, phone: `+7700${id}`, email: `p${id}@example.com`, registered_at: '2026-10-16T10:00:00Z',
    joined: false, lead_state: 'sent', lead_outcome: 'created', lead_error: null, lead_attempts: 1, amo_lead_id: 100 + id, utm: {}, ...over,
  });
  const many = (from: number, n: number) => Array.from({ length: n }, (_, i) => row(from + i));
  async function show(f = funnel) {
    api.getOpenAccess.mockResolvedValue({ event_id: 7, open: true, access_mode: 'registration', slug: 'my-webinar', speaker_id: null, lead_pipeline_id: 10520038, funnel: f });
    getEventDetails.mockResolvedValue({ title: 'Big webinar' });
    await mount(<MemoryRouter initialEntries={['/admin/open-webinars/7']}><Routes><Route path="/admin/open-webinars/:eventId" element={<OpenWebinarRegistrationsPage />} /></Routes></MemoryRouter>);
  }
  const rowCount = () => document.querySelectorAll('[data-row]').length;

  it('reads 100 at a time and offers «Load more» until a page comes back shorter', async () => {
    api.listRegistrations.mockImplementation(async (_id: number, page: { limit: number; offset: number }) => (page.offset === 0 ? many(1, 100) : page.offset === 100 ? many(101, 30) : []));
    await show();
    expect(api.listRegistrations).toHaveBeenCalledWith(7, { limit: 100, offset: 0 });
    expect(rowCount()).toBe(100);
    expect(document.querySelector('[data-shown]')?.textContent).toBe('Showing 100');
    await click(button('Load more'));
    await settle();
    expect(api.listRegistrations).toHaveBeenLastCalledWith(7, { limit: 100, offset: 100 });
    expect(rowCount()).toBe(130);
    expect(document.querySelector('[data-shown]')?.textContent).toBe('Showing 130');
    expect(button('Load more')).toBeUndefined();
    expect(document.querySelector('[data-row="130"]')).not.toBeNull();
  });

  it('has no «Load more» when everything fit on the first page', async () => {
    api.listRegistrations.mockResolvedValue(many(1, 99));
    await show();
    expect(rowCount()).toBe(99);
    expect(button('Load more')).toBeUndefined();
  });

  it('keeps every page on screen when a retry reloads the list', async () => {
    api.listRegistrations.mockImplementation(async (_id: number, page: { offset: number }) => (page.offset === 0 ? many(1, 100) : many(101, 30)));
    api.retryFailedLeads.mockResolvedValue({ retried: 2 });
    await show();
    await click(button('Load more'));
    await settle();
    await click(button('Retry all failed'));
    await settle();
    expect(rowCount()).toBe(130);
  });

  it('retries all of this webinar’s failed leads, says how many, and reloads', async () => {
    api.listRegistrations.mockResolvedValueOnce([row(1, { lead_state: 'failed', lead_error: 'boom' }), row(2, { lead_state: 'failed', lead_error: 'boom' })])
      .mockResolvedValue([row(1, { lead_state: 'pending', lead_outcome: null }), row(2, { lead_state: 'pending', lead_outcome: null })]);
    api.retryFailedLeads.mockResolvedValue({ retried: 2 });
    await show();
    await click(button('Retry all failed'));
    await settle();
    expect(api.retryFailedLeads).toHaveBeenCalledWith(7);
    expect(document.querySelector('[data-note]')?.textContent).toBe('Sent again: 2');
    expect(document.querySelector('[data-row="1"] td:last-child')?.textContent).toBe('Waiting');
  });

  it('offers no «Retry all failed» when no lead failed', async () => {
    api.listRegistrations.mockResolvedValue([row(1)]);
    await show({ ...funnel, leads_failed: 0 });
    expect(button('Retry all failed')).toBeUndefined();
  });

  it('says in plain words what became of each lead', async () => {
    api.listRegistrations.mockResolvedValue([
      row(1, { lead_outcome: 'created' }), row(2, { lead_outcome: 'tagged_existing' }), row(3, { lead_outcome: 'existing_client' }),
      row(4, { lead_state: 'skipped_student', lead_outcome: null }), row(5, { lead_state: 'failed', lead_outcome: null, lead_error: 'amoCRM: 502' }),
    ]);
    await show();
    const lead = (id: number) => document.querySelector(`[data-row="${id}"] td:last-child`)?.textContent ?? '';
    expect(lead(1)).toBe('In amoCRM: «Распределение», responsible РОП');
    expect(lead(2)).toBe('Tag and note added to the client’s open deal');
    expect(lead(3)).toBe('Already a client: nothing created');
    expect(lead(4)).toBe('Already a student');
    expect(lead(5)).toContain('Failed');
    expect(lead(5)).toContain('amoCRM: 502');
  });
});

describe('a webinar’s recording on the admin page', () => {
  const ready = { ...noRecording, has_recording: true, recording_status: 'ready', ready: true, duration_seconds: 3600 };
  const published = { ...ready, published: true, published_at: '2026-10-16T10:00:00Z', views: 7 };
  async function show() {
    api.getOpenAccess.mockResolvedValue({ event_id: 7, open: true, access_mode: 'open', slug: 'my-webinar', speaker_id: null, lead_pipeline_id: 10520038,
      funnel: { registered: 0, joined: 0, consultation_requests: 0, leads_sent: 0, leads_pending: 0, leads_failed: 0, existing_students: 0 } });
    api.listRegistrations.mockResolvedValue([]);
    getEventDetails.mockResolvedValue({ title: 'W' });
    await mount(<MemoryRouter initialEntries={['/admin/open-webinars/7']}><Routes><Route path="/admin/open-webinars/:eventId" element={<OpenWebinarRegistrationsPage />} /></Routes></MemoryRouter>);
  }
  const panel = () => document.querySelector('[data-recording-panel]')?.textContent ?? '';

  it('says there is no recording yet, then that a ready one is not public until published', async () => {
    await show();
    expect(panel()).toContain('No recording yet.');
    expect(Array.from(document.querySelectorAll('[data-recording-panel] button')).length).toBe(0);
    await unmount();
    api.getRecordingStatus.mockResolvedValue(ready);
    await show();
    expect(panel()).toContain('The recording is ready. It is not public until you publish it.');
    expect(panel()).not.toContain('Withdrawing removes the public page only.');
    expect(panel()).toContain('Anyone with the link can watch it.');
  });

  it('publishes on a click, shows the link and the views, and withdraws on another', async () => {
    api.getRecordingStatus.mockResolvedValue(ready);
    api.publishRecording.mockResolvedValue(published);
    api.withdrawRecording.mockResolvedValue({ ...published, published: false, withdrawn_at: '2026-10-17T10:00:00Z' });
    await show();
    await click(button('Publish'));
    await settle();
    expect(api.publishRecording).toHaveBeenCalledWith(7);
    expect(panel()).toContain('7 views');
    expect(document.querySelector('[data-recording-panel] a[href$="/r/my-webinar"]')).not.toBeNull();
    expect(panel()).toContain('Withdrawing removes the public page only. The recording stays in the staff archive.');
    await click(button('Withdraw'));
    await settle();
    expect(api.withdrawRecording).toHaveBeenCalledWith(7);
    expect(panel()).toContain('Withdrawn');
    expect(button('Publish again')).toBeTruthy();
  });

  it('cannot publish a recording that was removed from the library', async () => {
    api.getRecordingStatus.mockResolvedValue({ ...ready, ready: false, recording_status: 'removed' });
    await show();
    expect(panel()).toContain('removed from the library');
    expect(Array.from(document.querySelectorAll('[data-recording-panel] button')).length).toBe(0);
  });
});

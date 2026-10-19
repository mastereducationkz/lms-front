// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, type, unmount } from '../../pages/publicWebinarsTestKit';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin', ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOpenAccess: vi.fn(), getOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), saveOpenAccess: vi.fn(), closeOpenAccess: vi.fn(),
}));
vi.mock('../../services/api/openWebinars', () => api);

import OpenAccessCard from './OpenAccessCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const funnel = { registered: 0, joined: 0, consultation_requests: 0, leads_sent: 0, leads_pending: 0, leads_failed: 0, existing_students: 0 };
const host = { id: 5, name: 'Aldiyar Zhumadilda', role: 'admin', has_workspace: true };
const closed = { event_id: 7, open: false, access_mode: 'students', slug: null, speaker_id: null, lead_pipeline_id: null, host, has_meeting_url: false, funnel };
const opened = { ...closed, open: true, access_mode: 'registration', slug: 'ielts-writing-2030-03-03', lead_pipeline_id: 10736538, funnel: { ...funnel, registered: 12, joined: 5 } };
const settings = (policy = 'Policy text') => ({
  policy_text: policy, policy_version: 'abc', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }, { id: 10736538, name: 'NUET + IELTS' }],
});

async function show(hostUnsaved = false) {
  await mount(<MemoryRouter><OpenAccessCard eventId={7} hostUnsaved={hostUnsaved} /></MemoryRouter>);
}
const radio = (value: string) => document.querySelector(`input[name="access-mode"][value="${value}"]`);
const saveButton = () => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Save') as HTMLButtonElement;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getOpenAccess.mockResolvedValue(closed);
  api.getOpenSettings.mockResolvedValue(settings());
  api.listGuestSpeakers.mockResolvedValue([{ id: 3, name: 'Dr. Guest', organisation: 'Some University', bio: null, photo_url: null, email: null, is_active: true }]);
  api.saveOpenAccess.mockResolvedValue({ event_id: 7, access_mode: 'registration', slug: 'ielts-writing-2030-03-03' });
  api.closeOpenAccess.mockResolvedValue({ ok: true });
});
afterEach(unmount);

describe('a webinar’s public access card', () => {
  it('starts as «students only» with nothing else to fill in', async () => {
    await show();
    expect((radio('students') as HTMLInputElement).checked).toBe(true);
    expect(document.querySelector('#ow-slug')).toBeNull();
  });

  it('opens a webinar to everyone who registers, with its speaker and pipeline, and saves the address', async () => {
    await show();
    await click(radio('registration'));
    await type('#ow-slug', 'my-webinar');
    const speaker = document.querySelector('#ow-speaker') as HTMLSelectElement;
    expect(Array.from(speaker.options).map((o) => o.textContent)).toEqual(['No guest speaker', 'Dr. Guest, Some University']);
    speaker.value = '3'; speaker.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    api.getOpenAccess.mockResolvedValue(opened);
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess).toHaveBeenCalledWith(7, { access_mode: 'registration', slug: 'my-webinar', speaker_id: 3, lead_pipeline_id: 10520038 });
    expect(text()).toContain('Saved');
    expect(text()).toContain('Registered 12 · joined 5');
    expect(document.querySelector('a[href$="/w/ielts-writing-2030-03-03"]')).not.toBeNull();
  });

  it('will not offer registration until a privacy policy is published, and says where to publish it', async () => {
    api.getOpenSettings.mockResolvedValue(settings('  '));
    await show();
    await click(radio('registration'));
    expect(text()).toContain('Registration needs a published privacy policy.');
    expect(document.querySelector('a[href="/admin/open-webinars"]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
    await click(radio('open'));
    expect(saveButton().disabled).toBe(false);
  });

  it('says who the host is and that the room is made by itself, when the host has a Workspace account', async () => {
    await show();
    await click(radio('open'));
    expect(text()).toContain('Host: Aldiyar Zhumadilda. The Meet room is made automatically three days before the start.');
    expect(saveButton().disabled).toBe(false);
  });

  it('blocks Save and names the host when they have no Workspace account — the server would refuse', async () => {
    api.getOpenAccess.mockResolvedValue({ ...closed, host: { ...host, name: 'Dana Curator', role: 'curator', has_workspace: false } });
    await show();
    await click(radio('open'));
    expect(text()).toContain('Dana Curator has no Google Workspace account linked in the LMS');
    expect(document.querySelector('a[href="/admin/users"]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
    await click(radio('students'));
    expect(saveButton().disabled).toBe(false);
  });

  it('blocks Save when the webinar has no host and no link, and unblocks it for a pasted Meet link', async () => {
    api.getOpenAccess.mockResolvedValue({ ...closed, host: null });
    await show();
    await click(radio('open'));
    expect(text()).toContain('This webinar has no host.');
    expect(saveButton().disabled).toBe(true);
    await unmount();
    api.getOpenAccess.mockResolvedValue({ ...closed, host: null, has_meeting_url: true });
    await show();
    await click(radio('open'));
    expect(text()).toContain('A Meet link is already set on the event');
    expect(saveButton().disabled).toBe(false);
  });

  it('asks to save the event first when the Host in the form was changed but not saved', async () => {
    await show(true);
    await click(radio('open'));
    expect(text()).toContain('You changed the host but have not saved the event yet.');
    expect(saveButton().disabled).toBe(true);
  });

  it('closes the public access when set back to students only, keeping the registrations', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    await click(radio('students'));
    api.getOpenAccess.mockResolvedValue(closed);
    await click(saveButton());
    await settle();
    expect(api.closeOpenAccess).toHaveBeenCalledWith(7);
    expect(api.saveOpenAccess).not.toHaveBeenCalled();
    expect(text()).toContain('Registrations already made are kept.');
  });

  it('shows the server’s refusal in words and keeps what was typed', async () => {
    api.saveOpenAccess.mockRejectedValue(new Error('This address is already used by another webinar.'));
    await show();
    await click(radio('open'));
    await type('#ow-slug', 'taken');
    await click(saveButton());
    await settle();
    expect(text()).toContain('This address is already used by another webinar.');
    expect((document.querySelector('#ow-slug') as HTMLInputElement).value).toBe('taken');
  });
});

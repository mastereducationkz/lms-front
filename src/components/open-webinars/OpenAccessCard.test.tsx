// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../../services/api/apiError';
import { act } from 'react';
import { button, click, mount, pick, settle, text, type, unmount, upload } from '../../pages/publicWebinarsTestKit';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin', ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOpenAccess: vi.fn(), getOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), saveOpenAccess: vi.fn(), closeOpenAccess: vi.fn(), uploadBanner: vi.fn(),
}));
vi.mock('../../services/api/openWebinars', () => api);

import OpenAccessCard from './OpenAccessCard';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const funnel = { registered: 0, joined: 0, consultation_requests: 0, leads_sent: 0, leads_pending: 0, leads_failed: 0, existing_students: 0 };
const host = { id: 5, name: 'Aldiyar Zhumadilda', role: 'admin', has_workspace: true };
const closed = {
  event_id: 7, open: false, access_mode: 'students', slug: null, speaker_id: null, presenter: 'host', lead_pipeline_id: null, host, has_meeting_url: false, funnel,
  banner_url: null, starts_at: '2099-03-03T09:00:00Z', ends_at: '2099-03-03T10:00:00Z', started: false, ended: false, registrations_total: 0,
  slug_locked: false, can_close: true, close_blocked_reason: null, is_recurring: false,
};
const opened = { ...closed, open: true, access_mode: 'registration', slug: 'ielts-writing-2030-03-03', lead_pipeline_id: 10736538, funnel: { ...funnel, registered: 12, joined: 5 } };
const settings = (policy = 'Policy text') => ({
  policy_text: policy, policy_version: 'abc', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }, { id: 10736538, name: 'NUET + IELTS' }],
});
const speaker = { id: 3, name: 'Dr. Guest', organisation: 'Some University', bio: null, photo_url: null, email: null, is_active: true };

async function show(props: { hostUnsaved?: boolean; initialError?: string } = {}) {
  await mount(<MemoryRouter><OpenAccessCard eventId={7} {...props} /></MemoryRouter>);
}
const radio = (value: string) => document.querySelector(`input[name="access-mode"][value="${value}"]`) as HTMLInputElement;
const saveButton = () => button('Save');
const choosePipeline = (id = '10520038') => pick('#ow-pipeline', id);
const presenter = (value: string) => document.querySelector(`input[name="presenter"][value="${value}"]`) as HTMLInputElement;
/** A server refusal as the app's API layer throws it: the localized detail, with the AxiosError (and its reason_code) as the cause. */
const refusal = (detail: string, reason_code: string) => apiError({ response: { data: { detail, reason_code } } }, 'failed');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getOpenAccess.mockResolvedValue(closed);
  api.getOpenSettings.mockResolvedValue(settings());
  api.listGuestSpeakers.mockResolvedValue([speaker]);
  api.saveOpenAccess.mockResolvedValue({ event_id: 7, access_mode: 'registration', slug: 'ielts-writing-2030-03-03', banner_url: null });
  api.closeOpenAccess.mockResolvedValue({ ok: true });
});
afterEach(unmount);

describe('a webinar’s public access card', () => {
  it('starts as «students only» with nothing else to fill in', async () => {
    await show();
    expect(radio('students').checked).toBe(true);
    expect(document.querySelector('#ow-pipeline')).toBeNull();
  });

  it('opens a webinar to everyone who registers, with its speaker and pipeline, and saves the address', async () => {
    await show();
    await click(radio('registration'));
    await click(button('Edit address'));
    await type('#ow-slug', 'my-webinar');
    await click(presenter('speaker'));
    const speakers = document.querySelector('#ow-speaker') as HTMLSelectElement;
    expect(Array.from(speakers.options).map((o) => o.textContent)).toEqual(['Choose the guest speaker', 'Dr. Guest, Some University']);
    await pick('#ow-speaker', '3');
    await choosePipeline();
    api.getOpenAccess.mockResolvedValue(opened);
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess).toHaveBeenCalledWith(7, {
      access_mode: 'registration', slug: 'my-webinar', speaker_id: 3, presenter: 'speaker', lead_pipeline_id: 10520038, banner_url: null, title_en: '', description_en: '',
    });
    expect(text()).toContain('Saved');
    expect(text()).toContain('Registered 12 · joined 5');
    expect(document.querySelector('a[href$="/w/ielts-writing-2030-03-03"]')).not.toBeNull();
  });

  it('never preselects a pipeline: the field says «Choose the pipeline» and Save waits for a choice — in both public modes', async () => {
    await show();
    for (const mode of ['open', 'registration']) {
      await click(radio(mode));
      const select = document.querySelector('#ow-pipeline') as HTMLSelectElement;
      expect(select.value).toBe('');
      expect(select.options[0].textContent).toBe('Choose the pipeline');
      expect(saveButton().disabled).toBe(true);
    }
    await choosePipeline('10736538');
    expect(saveButton().disabled).toBe(false);
  });

  it('keeps the saved pipeline of a webinar that is already open', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    expect((document.querySelector('#ow-pipeline') as HTMLSelectElement).value).toBe('10736538');
  });

  it('will not offer registration until a privacy policy is published, and says where to publish it', async () => {
    api.getOpenSettings.mockResolvedValue(settings('  '));
    await show();
    await click(radio('registration'));
    await choosePipeline();
    expect(text()).toContain('Registration needs a published privacy policy.');
    expect(document.querySelector('a[href="/admin/open-webinars"]')).not.toBeNull();
    expect(saveButton().disabled).toBe(true);
    await click(radio('open'));
    expect(saveButton().disabled).toBe(false);
  });

  it('says who the host is and that the room is made by itself, when the host has a Workspace account', async () => {
    await show();
    await click(radio('open'));
    await choosePipeline();
    expect(text()).toContain('Host: Aldiyar Zhumadilda. The Meet room is made automatically three days before the start.');
    expect(saveButton().disabled).toBe(false);
  });

  it('blocks Save and names the host when they have no Workspace account — the server would refuse', async () => {
    api.getOpenAccess.mockResolvedValue({ ...closed, host: { ...host, name: 'Dana Curator', role: 'curator', has_workspace: false } });
    await show();
    await click(radio('open'));
    await choosePipeline();
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
    await choosePipeline();
    expect(text()).toContain('This webinar has no host.');
    expect(saveButton().disabled).toBe(true);
    await unmount();
    api.getOpenAccess.mockResolvedValue({ ...closed, host: null, has_meeting_url: true });
    await show();
    await click(radio('open'));
    await choosePipeline();
    expect(text()).toContain('A Meet link is already set on the event');
    expect(saveButton().disabled).toBe(false);
  });

  it('asks to save the event first when the Host in the form was changed but not saved', async () => {
    await show({ hostUnsaved: true });
    await click(radio('open'));
    await choosePipeline();
    expect(text()).toContain('You changed the host but have not saved the event yet.');
    expect(saveButton().disabled).toBe(true);
  });

  it('shows the server’s refusal in words and keeps what was typed', async () => {
    api.saveOpenAccess.mockRejectedValue(refusal('This address is already used by another webinar.', 'slug_taken'));
    await show();
    await click(radio('open'));
    await click(button('Edit address'));
    await type('#ow-slug', 'taken');
    await choosePipeline();
    await click(saveButton());
    await settle();
    expect(text()).toContain('This address is already used by another webinar.');
    expect((document.querySelector('#ow-slug') as HTMLInputElement).value).toBe('taken');
  });

  it('shows the page address under an «Edit address» toggle instead of an empty box', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    expect(document.querySelector('#ow-slug')).toBeNull();
    expect(document.querySelector('[data-address]')?.textContent).toMatch(/\/w\/ielts-writing-2030-03-03$/);
    await click(button('Edit address'));
    expect((document.querySelector('#ow-slug') as HTMLInputElement).value).toBe('ielts-writing-2030-03-03');
  });
});

describe('closing public access', () => {
  it('closes it when set back to students only', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    await click(radio('students'));
    api.getOpenAccess.mockResolvedValue(closed);
    await click(saveButton());
    await settle();
    expect(api.closeOpenAccess).toHaveBeenCalledWith(7);
    expect(api.saveOpenAccess).not.toHaveBeenCalled();
    expect(text()).toContain('Back to students only.');
  });

  it('disables «Students only» and says why once the webinar has started', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, started: true, can_close: false, close_blocked_reason: 'started' });
    await show();
    expect(radio('students').disabled).toBe(true);
    expect(document.querySelector('[data-students-blocked]')?.textContent).toContain('already started');
  });

  it('disables «Students only» and points to cancelling once people have registered', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, registrations_total: 4, can_close: false, close_blocked_reason: 'has_registrations' });
    await show();
    expect(radio('students').disabled).toBe(true);
    expect(document.querySelector('[data-students-blocked]')?.textContent).toContain('Cancel the webinar instead');
  });

  it('reloads the card when the server says closing is no longer allowed (someone registered meanwhile)', async () => {
    api.getOpenAccess.mockResolvedValueOnce(opened).mockResolvedValue({ ...opened, registrations_total: 1, can_close: false, close_blocked_reason: 'has_registrations' });
    api.closeOpenAccess.mockRejectedValue(refusal('People have registered, so public access cannot be closed.', 'close_has_registrations'));
    await show();
    await click(radio('students'));
    await click(saveButton());
    await settle();
    expect(text()).toContain('People have registered, so public access cannot be closed.');
    expect(radio('students').disabled).toBe(true);
    expect(radio('registration').checked).toBe(true);
  });
});

describe('the address', () => {
  it('is shown read-only once people have registered, and is not sent on Save', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, slug_locked: true, registrations_total: 12 });
    await show();
    expect(button('Edit address')).toBeUndefined();
    expect(document.querySelector('#ow-slug')).toBeNull();
    expect(text()).toContain('The address can no longer change');
    await click(saveButton());
    await settle();
    const body = api.saveOpenAccess.mock.calls[0][1];
    expect(body).not.toHaveProperty('slug');
    expect(body.lead_pipeline_id).toBe(10736538);
  });

  it('turns read-only when the server refuses a change because registrations appeared meanwhile', async () => {
    api.getOpenAccess.mockResolvedValueOnce(opened).mockResolvedValue({ ...opened, slug_locked: true });
    api.saveOpenAccess.mockRejectedValue(refusal('People have registered through this address, so it can no longer change.', 'slug_locked'));
    await show();
    await click(button('Edit address'));
    await type('#ow-slug', 'another');
    await click(saveButton());
    await settle();
    expect(text()).toContain('so it can no longer change');
    expect(button('Edit address')).toBeUndefined();
  });
});

describe('the presenter on the public page', () => {
  it('starts as «The host», names who that is, and offers no speaker list', async () => {
    await show();
    await click(radio('open'));
    expect(presenter('host').checked).toBe(true);
    expect(document.querySelector('[data-presenter-hint="host"]')?.textContent).toBe('Shown as: Aldiyar Zhumadilda. Their name only: no photo, no bio.');
    expect(document.querySelector('#ow-speaker')).toBeNull();
  });

  it('offers the three choices, and sends the choice with no guest speaker unless one is the presenter', async () => {
    await show();
    await click(radio('open'));
    await choosePipeline();
    expect(Array.from(document.querySelectorAll('input[name="presenter"]')).map((r) => (r as HTMLInputElement).value)).toEqual(['speaker', 'host', 'none']);
    expect(text()).toContain('For a host who only starts the recording');
    await click(presenter('none'));
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ access_mode: 'open', presenter: 'none', speaker_id: null });
  });

  it('keeps the picked speaker out of the request once the host is named instead', async () => {
    await show();
    await click(radio('open'));
    await choosePipeline();
    await click(presenter('speaker'));
    await pick('#ow-speaker', '3');
    await click(presenter('host'));
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ presenter: 'host', speaker_id: null });
  });

  it('will not save «Guest speaker» without a speaker, and says what to do', async () => {
    await show();
    await click(radio('open'));
    await choosePipeline();
    await click(presenter('speaker'));
    expect(document.querySelector('[data-speaker-required]')?.textContent).toBe('Choose the guest speaker, or name the host or nobody.');
    expect(saveButton().disabled).toBe(true);
    await pick('#ow-speaker', '3');
    expect(saveButton().disabled).toBe(false);
  });

  it('shows the saved choice of an open webinar', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, presenter: 'none' });
    await show();
    expect(presenter('none').checked).toBe(true);
  });

  it('reads an older server’s answer (no presenter): a speaker means «Guest speaker», no speaker means the host', async () => {
    const { presenter: _drop, ...older } = opened;
    api.getOpenAccess.mockResolvedValue({ ...older, speaker_id: 3 });
    await show();
    expect(presenter('speaker').checked).toBe(true);
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).not.toHaveProperty('presenter');
    expect(api.saveOpenAccess.mock.calls[0][1].speaker_id).toBe(3);
    await unmount();
    api.getOpenAccess.mockResolvedValue({ ...older, speaker_id: null });
    await show();
    expect(presenter('host').checked).toBe(true);
  });
});

describe('the guest speaker', () => {
  it('keeps a removed speaker in the list, marked, and asks for them by id', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, speaker_id: 9, presenter: 'speaker' });
    api.listGuestSpeakers.mockResolvedValue([speaker, { ...speaker, id: 9, name: 'Dr. Gone', organisation: null, is_active: false }]);
    await show();
    expect(api.listGuestSpeakers).toHaveBeenCalledWith(9);
    const select = document.querySelector('#ow-speaker') as HTMLSelectElement;
    expect(select.value).toBe('9');
    expect(Array.from(select.options).map((o) => o.textContent)).toContain('Dr. Gone (removed)');
  });
});

describe('the banner', () => {
  const png = (size = 1000, type = 'image/png') => new File([new Uint8Array(size)], 'poster.png', { type });

  it('uploads a picture, previews it, and saves its path with the access', async () => {
    api.uploadBanner.mockResolvedValue({ url: '/uploads/webinar_banners/42.png' });
    await show();
    await click(radio('open'));
    await choosePipeline();
    expect(document.querySelector('[data-banner-preview]')).toBeNull();
    await upload('#ow-banner', png());
    expect(api.uploadBanner).toHaveBeenCalledTimes(1);
    expect((document.querySelector('[data-banner-preview]') as HTMLImageElement).src).toMatch(/\/uploads\/webinar_banners\/42\.png$/);
    expect(text()).toContain('1080x1350 (4:5) or 1200x630');
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1].banner_url).toBe('/uploads/webinar_banners/42.png');
  });

  it('removes the banner by sending null', async () => {
    api.getOpenAccess.mockResolvedValue({ ...opened, banner_url: '/uploads/webinar_banners/42.png' });
    await show();
    expect(document.querySelector('[data-banner-preview]')).not.toBeNull();
    await click(button('Remove'));
    expect(document.querySelector('[data-banner-preview]')).toBeNull();
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1].banner_url).toBeNull();
  });

  it('turns away a file that is not a PNG, JPG or WebP, or is over 5 MB, without uploading it', async () => {
    await show();
    await click(radio('open'));
    await upload('#ow-banner', png(1000, 'application/pdf'));
    expect(text()).toContain('must be a PNG, JPG or WebP image');
    await upload('#ow-banner', png(6 * 1024 * 1024));
    expect(text()).toContain('larger than 5 MB');
    expect(api.uploadBanner).not.toHaveBeenCalled();
  });

  it('shows the server’s refusal of a picture (too narrow, say)', async () => {
    api.uploadBanner.mockRejectedValue(refusal('The banner must be a PNG, JPG or WebP image at least 400 px wide.', 'banner_invalid'));
    await show();
    await click(radio('open'));
    await upload('#ow-banner', png());
    expect(text()).toContain('at least 400 px wide');
    expect(document.querySelector('[data-banner-preview]')).toBeNull();
  });
});

describe('a series, and a create that half-succeeded', () => {
  it('says a recurring series cannot be opened, and offers no controls', async () => {
    api.getOpenAccess.mockResolvedValue({ ...closed, is_recurring: true });
    await show();
    expect(text()).toContain('A recurring series cannot be opened to everyone. Open each occurrence from its own edit page.');
    expect(document.querySelector('input[name="access-mode"]')).toBeNull();
  });

  it('shows why the access did not save right after the event was created', async () => {
    await show({ initialError: 'This address is already used by another webinar.' });
    expect(text()).toContain('The event was created, but public access was not saved: This address is already used by another webinar.');
  });
});

describe('the English version of the public page', () => {
  const setDescription = async (value: string) => {
    const el = document.querySelector('#ow-description-en') as HTMLTextAreaElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const withEnglish = { ...opened, title_en: 'IELTS Writing Office Hours', description_en: 'Bring an essay.\nGet feedback.' };

  it('is offered, empty and optional, only while the webinar is open to everyone', async () => {
    await show();
    expect(document.querySelector('[data-english-version]')).toBeNull();
    await click(radio('open'));
    expect(document.querySelector('[data-english-version] legend')?.textContent).toBe('English version (optional)');
    expect((document.querySelector('#ow-title-en') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('#ow-description-en') as HTMLTextAreaElement).rows).toBeGreaterThan(2);
    expect(document.querySelector('label[for="ow-title-en"]')?.textContent).toBe('Title in English');
    expect(document.querySelector('label[for="ow-description-en"]')?.textContent).toBe('Description in English');
    await click(radio('students'));
    expect(document.querySelector('[data-english-version]')).toBeNull();
  });

  it('shows the saved English texts, and saving without touching them sends them back as they are', async () => {
    api.getOpenAccess.mockResolvedValue(withEnglish);
    await show();
    expect((document.querySelector('#ow-title-en') as HTMLInputElement).value).toBe('IELTS Writing Office Hours');
    expect((document.querySelector('#ow-description-en') as HTMLTextAreaElement).value).toBe('Bring an essay.\nGet feedback.');
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ title_en: 'IELTS Writing Office Hours', description_en: 'Bring an essay.\nGet feedback.' });
  });

  it('saves a newly typed English title and description', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    await type('#ow-title-en', '  IELTS Writing consultation ');
    await setDescription('Bring an essay.');
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ title_en: 'IELTS Writing consultation', description_en: 'Bring an essay.' });
  });

  it('clears a saved English text by sending an empty string, and leaves the other one as it is', async () => {
    api.getOpenAccess.mockResolvedValue(withEnglish);
    await show();
    await type('#ow-title-en', '');
    await click(saveButton());
    await settle();
    expect(api.saveOpenAccess.mock.calls[0][1]).toMatchObject({ title_en: '', description_en: 'Bring an essay.\nGet feedback.' });
  });

  it('shows the fields empty for an older server that knows no English texts', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    expect((document.querySelector('#ow-title-en') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('#ow-description-en') as HTMLTextAreaElement).value).toBe('');
  });

  it('shows the saved texts again after Save reloads the card', async () => {
    api.getOpenAccess.mockResolvedValue(opened);
    await show();
    await type('#ow-title-en', 'IELTS Writing consultation');
    api.getOpenAccess.mockResolvedValue({ ...opened, title_en: 'IELTS Writing consultation' });
    await click(saveButton());
    await settle();
    expect((document.querySelector('#ow-title-en') as HTMLInputElement).value).toBe('IELTS Writing consultation');
  });
});

// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../services/api/apiError';
import { backendBase } from '../lib/mediaUrl';
import { click, mount, settle, text, type, unmount, upload } from './publicWebinarsTestKit';

vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin', ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({
  getOpenSettings: vi.fn(), saveOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), createGuestSpeaker: vi.fn(), updateGuestSpeaker: vi.fn(),
  retireGuestSpeaker: vi.fn(), uploadSpeakerPhoto: vi.fn(), getOverview: vi.fn(), retryFailedLeads: vi.fn(),
}));
vi.mock('../services/api/openWebinars', () => api);

import OpenWebinarsAdminPage from './OpenWebinarsAdminPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const guest = (id: number, over = {}) => ({ id, name: `Guest ${id}`, organisation: null, bio: null, photo_url: null, email: null, is_active: true, ...over });
const buttons = (label: string) => Array.from(document.querySelectorAll('button')).filter((b) => b.textContent === label) as HTMLButtonElement[];
/** The speaker form's Save: the last one on the page (the policy card has its own above it). */
const saveSpeaker = () => buttons('Save').pop()!;
const preview = () => document.querySelector('[data-photo-preview]') as HTMLImageElement | null;
const photo = (size = 1000, type = 'image/png') => new File([new Uint8Array(size)], 'face.png', { type });
const refusal = (detail: string, reason_code: string) => apiError({ response: { data: { detail, reason_code } } }, 'failed');

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getOpenSettings.mockResolvedValue({
    policy_text: '', policy_version: '', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en', pipelines: [],
  });
  api.listGuestSpeakers.mockResolvedValue([]);
  api.getOverview.mockResolvedValue({ failed_total: 0, items: [] });
  api.createGuestSpeaker.mockImplementation(async (body) => ({ id: 9, is_active: true, ...body }));
  api.updateGuestSpeaker.mockImplementation(async (id, body) => ({ id, is_active: true, ...body }));
});
afterEach(unmount);

const show = () => mount(<MemoryRouter><OpenWebinarsAdminPage /></MemoryRouter>);

describe('a guest speaker’s photo', () => {
  it('is an upload, not a link: chosen, sent at once, shown round from the API host, and saved as the path the server returned', async () => {
    api.uploadSpeakerPhoto.mockResolvedValue({ url: '/uploads/webinar_speakers/9.jpg' });
    await show();
    await click(buttons('Add speaker')[0]);
    expect(document.querySelector('#ow-sp-photo_url')).toBeNull();                       // the old URL text box is gone
    expect(preview()).toBeNull();
    await type('#ow-sp-name', 'Dr. Guest');
    await upload('#ow-sp-photo', photo());
    expect(api.uploadSpeakerPhoto).toHaveBeenCalledTimes(1);
    expect(preview()!.src).toBe(`${backendBase()}/uploads/webinar_speakers/9.jpg`);
    expect(preview()!.className).toContain('rounded-full');
    expect(text()).toContain('at least 200 px on the short side');
    await click(saveSpeaker());
    await settle();
    expect(api.createGuestSpeaker).toHaveBeenCalledWith({ name: 'Dr. Guest', organisation: null, bio: null, photo_url: '/uploads/webinar_speakers/9.jpg', email: null });
  });

  it('turns away a file that is not a PNG, JPG or WebP, or is over 5 MB, without uploading it', async () => {
    await show();
    await click(buttons('Add speaker')[0]);
    await upload('#ow-sp-photo', photo(1000, 'application/pdf'));
    expect(text()).toContain('The photo must be a PNG, JPG or WebP image.');
    await upload('#ow-sp-photo', photo(6 * 1024 * 1024));
    expect(text()).toContain('The photo is larger than 5 MB.');
    expect(api.uploadSpeakerPhoto).not.toHaveBeenCalled();
    expect(preview()).toBeNull();
  });

  it('shows the server’s refusal (too small, say), keeps no picture, and saves without one', async () => {
    api.uploadSpeakerPhoto.mockRejectedValue(refusal('The photo must be a PNG, JPG or WebP image at least 200 px on the short side.', 'photo_invalid'));
    await show();
    await click(buttons('Add speaker')[0]);
    await type('#ow-sp-name', 'Dr. Guest');
    await upload('#ow-sp-photo', photo());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('at least 200 px on the short side.');
    expect(preview()).toBeNull();
    await click(saveSpeaker());
    await settle();
    expect(api.createGuestSpeaker.mock.calls[0][0].photo_url).toBeNull();
  });

  it('is removed with «Remove photo», which saves null — and does not retire the speaker', async () => {
    api.listGuestSpeakers.mockResolvedValue([guest(5, { photo_url: '/uploads/webinar_speakers/5.png' })]);
    await show();
    await click(buttons('Edit')[0]);
    expect(preview()!.src).toBe(`${backendBase()}/uploads/webinar_speakers/5.png`);
    await click(buttons('Remove photo')[0]);
    expect(preview()).toBeNull();
    await click(saveSpeaker());
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, expect.objectContaining({ photo_url: null }));
    expect(api.retireGuestSpeaker).not.toHaveBeenCalled();
  });

  it('keeps an old absolute photo URL as it is, shows it unchanged, and sends it back untouched on Save', async () => {
    api.listGuestSpeakers.mockResolvedValue([guest(5, { photo_url: 'https://cdn.example/old.jpg' })]);
    await show();
    await click(buttons('Edit')[0]);
    expect(preview()!.src).toBe('https://cdn.example/old.jpg');                            // no API origin in front of a full URL
    expect(buttons('Replace')).toHaveLength(1);
    await click(saveSpeaker());
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, expect.objectContaining({ photo_url: 'https://cdn.example/old.jpg' }));
  });

  it('replaces an old URL with an upload', async () => {
    api.listGuestSpeakers.mockResolvedValue([guest(5, { photo_url: 'https://cdn.example/old.jpg' })]);
    api.uploadSpeakerPhoto.mockResolvedValue({ url: '/uploads/webinar_speakers/5.webp' });
    await show();
    await click(buttons('Edit')[0]);
    await upload('#ow-sp-photo', photo(2000, 'image/webp'));
    expect(preview()!.src).toBe(`${backendBase()}/uploads/webinar_speakers/5.webp`);
    await click(saveSpeaker());
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(5, expect.objectContaining({ photo_url: '/uploads/webinar_speakers/5.webp' }));
  });

  it('holds Save while the file is on its way, so the saved speaker never misses the photo', async () => {
    let arrive!: (value: { url: string }) => void;
    api.uploadSpeakerPhoto.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    await show();
    await click(buttons('Add speaker')[0]);
    await type('#ow-sp-name', 'Dr. Guest');
    expect(saveSpeaker().disabled).toBe(false);
    await upload('#ow-sp-photo', photo());
    expect(text()).toContain('Uploading…');
    expect(saveSpeaker().disabled).toBe(true);
    arrive({ url: '/uploads/webinar_speakers/9.png' });
    await settle();
    expect(saveSpeaker().disabled).toBe(false);
    expect(preview()).not.toBeNull();
  });

  it('does not hand a late photo to the next speaker when the form moved on while it travelled', async () => {
    api.listGuestSpeakers.mockResolvedValue([guest(5), guest(6)]);
    let arrive!: (value: { url: string }) => void;
    api.uploadSpeakerPhoto.mockReturnValue(new Promise((resolve) => { arrive = resolve; }));
    await show();
    await click(buttons('Edit')[0]);
    await upload('#ow-sp-photo', photo());
    await click(buttons('Edit')[1]);                                                       // now editing Guest 6
    arrive({ url: '/uploads/webinar_speakers/5.png' });
    await settle();
    expect(preview()).toBeNull();
    await click(saveSpeaker());
    await settle();
    expect(api.updateGuestSpeaker).toHaveBeenCalledWith(6, expect.objectContaining({ photo_url: null }));
  });
});

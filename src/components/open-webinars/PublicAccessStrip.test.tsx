// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, text, unmount } from '../../pages/publicWebinarsTestKit';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'teacher', ui_language: 'en' } }) };
});
const api = vi.hoisted(() => ({ getPublicSummary: vi.fn() }));
vi.mock('../../services/api/openWebinars', () => api);

import PublicAccessStrip from './PublicAccessStrip';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const summary = (over = {}) => ({ open: true, access_mode: 'registration', slug: 'ielts-oh', registered: 12, joined: 5, recording_published: false, ...over });
beforeEach(() => { api.getPublicSummary.mockReset(); });
afterEach(unmount);

describe('the public strip a host sees on their webinar', () => {
  it('says how it is open, where, and how many came — with no personal data', async () => {
    api.getPublicSummary.mockResolvedValue(summary());
    await mount(<PublicAccessStrip eventId={7} />);
    expect(api.getPublicSummary).toHaveBeenCalledWith(7);
    expect(text()).toContain('Open to everyone · Anyone who registers can join');
    expect(text()).toContain('Registered 12 · joined 5');
    expect(document.querySelector('a[href$="/w/ielts-oh"]')).not.toBeNull();
    expect(text()).not.toContain('The recording is public');
  });

  it('says when the recording is public, and for an open-link webinar says so', async () => {
    api.getPublicSummary.mockResolvedValue(summary({ access_mode: 'open', recording_published: true }));
    await mount(<PublicAccessStrip eventId={7} />);
    expect(text()).toContain('Anyone with the link can join');
    expect(text()).toContain('The recording is public');
  });

  it('shows nothing for a webinar that is not open to everyone', async () => {
    api.getPublicSummary.mockResolvedValue(summary({ open: false, access_mode: null, slug: null }));
    await mount(<PublicAccessStrip eventId={7} />);
    expect(document.querySelector('[data-public-strip]')).toBeNull();
  });

  it('shows nothing, and no error, when the server will not say (not this person’s webinar)', async () => {
    api.getPublicSummary.mockRejectedValue(new Error('Forbidden'));
    await mount(<PublicAccessStrip eventId={7} />);
    expect(document.querySelector('[data-public-strip]')).toBeNull();
    expect(text()).not.toContain('Forbidden');
  });
});

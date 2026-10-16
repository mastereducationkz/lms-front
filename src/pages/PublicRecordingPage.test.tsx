// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBackend, memoryStorage, mount, text, unmount } from './publicWebinarsTestKit';

vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});
// hls.js needs a real browser; the page's job is to hand the player the right address.
vi.mock('../components/HlsVideoPlayer', () => ({
  default: ({ url, poster }: { url: string; poster?: string | null }) => <div data-player data-url={url} data-poster={poster ?? ''} />,
}));

import PublicRecordingPage from './PublicRecordingPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SLUG = 'ielts-writing-2030-03-03';
const recording = (over = {}) => ({
  slug: SLUG, title: 'IELTS Writing Office Hours', description: 'Bring an essay.', starts_at: '2030-03-03T09:00:00Z', ends_at: '2030-03-03T10:30:00Z',
  duration_seconds: 5400, speaker: { name: 'Dr. Guest', organisation: 'Some University', bio: null, photo_url: null },
  url: '/uploads/v/TOKEN/videos/recordings/42/master.m3u8', poster_url: '/uploads/v/TOKEN/videos/recordings/42/poster.jpg',
  consent: { text_ru: 'RU consent text.', text_en: 'EN consent text.', policy_version: 'abc', policy_ready: true }, ...over,
});

async function open(reply: { status?: number; body: unknown } | undefined) {
  const backend = fakeBackend(reply ? { [`GET /public/recordings/${SLUG}`]: reply } : {});
  vi.stubGlobal('fetch', backend.fetchMock);
  await mount(<MemoryRouter initialEntries={[`/r/${SLUG}`]}><Routes><Route path="/r/:slug" element={<PublicRecordingPage />} /></Routes></MemoryRouter>);
  return backend;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('navigator', { language: 'en-US' });
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('a public recording', () => {
  it('plays for anyone with the link: the video, the title, who spoke and the call-back card', async () => {
    await open({ body: recording() });
    const player = document.querySelector('[data-player]') as HTMLElement;
    expect(player.dataset.url).toBe('/uploads/v/TOKEN/videos/recordings/42/master.m3u8');
    expect(player.dataset.poster).toContain('poster.jpg');
    expect(text()).toContain('IELTS Writing Office Hours');
    expect(text()).toContain('Recorded 3 March 2030');
    expect(text()).toContain('Dr. Guest, Some University');
    expect(text()).toContain('Want a free consultation?');
  });

  it('shows no call-back card while no privacy policy is published', async () => {
    await open({ body: recording({ consent: { text_ru: '', text_en: '', policy_version: '', policy_ready: false } }) });
    expect(text()).not.toContain('Want a free consultation?');
  });

  it('says a withdrawn recording is no longer available, and an unknown one was not found', async () => {
    await open({ status: 410, body: { detail: 'gone', reason_code: 'recording_withdrawn' } });
    expect(text()).toContain('This recording is no longer available.');
    expect(document.querySelector('[data-player]')).toBeNull();
    await unmount();
    await open(undefined);
    expect(text()).toContain('This recording was not found.');
  });
});

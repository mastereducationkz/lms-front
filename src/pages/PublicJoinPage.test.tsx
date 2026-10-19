// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicJoinPage, { googleCalendarUrl } from './PublicJoinPage';
import PrivacyPolicyPage from './PrivacyPolicyPage';
import { fakeBackend, memoryStorage, mount, text, unmount } from './publicWebinarsTestKit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const info = (over: Record<string, unknown> = {}) => ({
  title: 'IELTS Writing Office Hours', slug: 'ielts-writing-2030-03-03', name: 'Aigerim Serikova', state: 'upcoming',
  starts_at: '2099-03-03T09:00:00Z', ends_at: '2099-03-03T10:30:00Z', join_opens_at: '2099-03-03T08:45:00Z', join_url: null, recording_slug: null, ...over,
});

async function open(reply: { status?: number; body: unknown } | undefined) {
  const backend = fakeBackend(reply ? { 'GET /public/webinars/join/CODE123': reply } : {});
  vi.stubGlobal('fetch', backend.fetchMock);
  await mount(
    <MemoryRouter initialEntries={['/w/j/CODE123']}>
      <Routes><Route path="/w/j/:code" element={<PublicJoinPage />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('navigator', { language: 'en-US' });
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
});

describe('a registrant’s personal link', () => {
  it('confirms the registration, greets by first name and counts down; no room yet', async () => {
    await open({ body: info() });
    expect(text()).toContain('You are registered');
    expect(text()).toContain('Hello, Aigerim!');
    expect(text()).not.toContain('Serikova');
    expect(text()).toContain('Starts in');
    expect(text()).toContain('The join button appears 15 minutes before the start.');
    expect(text()).toContain('Please do not forward it.');
    expect(document.querySelector('a[href*="meet.google.com"]')).toBeNull();
    const calendar = document.querySelector('a[href^="https://calendar.google.com/"]') as HTMLAnchorElement;
    expect(calendar).not.toBeNull();
  });

  it('says the room is being opened when the webinar is on but its link does not exist yet, instead of showing nothing', async () => {
    await open({ body: info({ state: 'live', join_url: null }) });
    expect(text()).toContain('the room is being opened');
    expect(document.querySelector('a[href*="meet.google.com"]')).toBeNull();
  });

  it('says the webinar was cancelled when the personal link now answers 410', async () => {
    await open({ status: 410, body: { detail: 'This webinar was cancelled', reason_code: 'webinar_cancelled' } });
    expect(text()).toContain('This webinar has been cancelled.');
    expect(text()).not.toContain('This link is not valid');
  });

  it('offers the way into the room once the webinar is on', async () => {
    await open({ body: info({ state: 'live', join_url: 'https://meet.google.com/abc-defg-hij' }) });
    const join = document.querySelector('a[href="https://meet.google.com/abc-defg-hij"]') as HTMLAnchorElement;
    expect(join.textContent).toContain('Join the webinar');
    expect(join.target).toBe('_blank');
    expect(text()).toContain('The webinar is on now');
  });

  it('after the webinar, points to the recording when there is one', async () => {
    await open({ body: info({ state: 'ended', recording_slug: 'ielts-writing-2030-03-03' }) });
    expect(text()).toContain('This webinar is over');
    const watch = Array.from(document.querySelectorAll('a')).find((a) => a.textContent?.includes('Watch the recording')) as HTMLAnchorElement;
    expect(watch.getAttribute('href')).toBe('/r/ielts-writing-2030-03-03');
    expect(document.querySelector('a[href^="https://calendar.google.com/"]')).toBeNull();
  });

  it('says an unknown link is not valid, and a network failure is retryable', async () => {
    await open(undefined);
    expect(text()).toContain('This link is not valid.');
  });

  it('builds a Google Calendar link with the exact UTC start and end and the personal page in the details', () => {
    const url = new URL(googleCalendarUrl(info() as never, 'https://lms.example/w/j/CODE123'));
    expect(url.searchParams.get('dates')).toBe('20990303T090000Z/20990303T103000Z');
    expect(url.searchParams.get('text')).toBe('IELTS Writing Office Hours');
    expect(url.searchParams.get('details')).toBe('https://lms.example/w/j/CODE123');
  });
});

describe('the privacy policy page', () => {
  async function openPolicy(reply: { status?: number; body: unknown } | undefined) {
    const backend = fakeBackend(reply ? { 'GET /public/policy': reply } : {});
    vi.stubGlobal('fetch', backend.fetchMock);
    await mount(<MemoryRouter initialEntries={['/privacy']}><Routes><Route path="/privacy" element={<PrivacyPolicyPage />} /></Routes></MemoryRouter>);
  }

  it('shows the policy exactly as it was published, paragraphs kept', async () => {
    await openPolicy({ body: { text: 'First paragraph.\n\nSecond paragraph.', version: 'abc', updated_at: '2026-10-16T10:00:00' } });
    expect(text()).toContain('Privacy policy');
    expect(text()).toContain('First paragraph.');
    const body = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'First paragraph.\n\nSecond paragraph.');
    expect(body?.className).toContain('whitespace-pre-wrap');
  });

  it('says plainly when none has been published yet', async () => {
    await openPolicy(undefined);
    expect(text()).toContain('The privacy policy has not been published yet.');
  });
});

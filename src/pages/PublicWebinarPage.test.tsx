// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicWebinarPage from './PublicWebinarPage';
import { click, fakeBackend, memoryStorage, mount, submit, text, type, unmount, webinar } from './publicWebinarsTestKit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SLUG = 'ielts-writing-2030-03-03';
const PAGE = `GET /public/webinars/${SLUG}`;
const REGISTER = `POST /public/webinars/${SLUG}/register`;

async function open(routes: Parameters<typeof fakeBackend>[0], search = '') {
  window.history.pushState({}, '', `/w/${SLUG}${search}`);       // what a browser would have in its address bar
  const backend = fakeBackend(routes);
  vi.stubGlobal('fetch', backend.fetchMock);
  await mount(
    <MemoryRouter initialEntries={[`/w/${SLUG}${search}`]}>
      <Routes>
        <Route path="/w/j/:code" element={<p>JOIN PAGE</p>} />
        <Route path="/w/:slug" element={<PublicWebinarPage />} />
        <Route path="/r/:slug" element={<p>RECORDING PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return backend;
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

const fill = async () => {
  await type('#ow-name', 'Aigerim S');
  await type('#ow-phone', '8 700 123 45 67');
  await type('#ow-email', 'a@example.com');
};

describe('a webinar page anyone can open', () => {
  it('shows the webinar, the speaker, the countdown and the register form — in Russian for a Russian browser', async () => {
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    await open({ [PAGE]: { body: webinar({ speaker: { name: 'Dr. Guest', organisation: 'Some University', bio: 'Admissions', photo_url: null } }) } });
    const page = text();
    expect(page).toContain('IELTS Writing Office Hours');
    expect(page).toContain('Dr. Guest, Some University');
    expect(page).toContain('До начала');
    expect(page).toContain('Бесплатная регистрация');
    expect(page).toContain('RU consent text.');
    expect(page).toContain('время Алматы');
  });

  it('is English for an English browser, and the visitor can switch', async () => {
    await open({ [PAGE]: { body: webinar() } });
    expect(text()).toContain('Register for free');
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Русский') ?? null);
    expect(text()).toContain('Бесплатная регистрация');
    expect(localStorage.getItem('lms:ui-language')).toBe('ru');
  });

  it('refuses a submit without consent and sends nothing', async () => {
    const backend = await open({ [PAGE]: { body: webinar() } });
    await fill();
    await submit();
    expect(text()).toContain('Please tick the consent box.');
    expect(backend.calls.filter((c) => c.method === 'POST')).toEqual([]);
  });

  it('registers with the visit’s utm tags and a silent trap field, then goes to the personal page', async () => {
    const backend = await open(
      { [PAGE]: { body: webinar() }, [REGISTER]: { body: { join_code: 'CODE123', join_path: '/w/j/CODE123' } } },
      '?utm_source=instagram&utm_campaign=oct',
    );
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    const post = backend.calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe(`/public/webinars/${SLUG}/register`);
    expect(post.body).toMatchObject({ name: 'Aigerim S', phone: '8 700 123 45 67', email: 'a@example.com', consent: true, website: '' });
    expect(post.body!.utm).toEqual({ utm_source: 'instagram', utm_campaign: 'oct' });
    expect(text()).toContain('JOIN PAGE');
  });

  it('says what went wrong in the visitor’s language, from the backend’s code', async () => {
    await open({ [PAGE]: { body: webinar() }, [REGISTER]: { status: 400, body: { detail: 'Enter a valid phone number', reason_code: 'phone_invalid' } } });
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(text()).toContain('Enter a valid phone number.');
    expect(text()).not.toContain('JOIN PAGE');
    expect(text()).toContain('Register for free');
  });

  it('a webinar whose privacy policy is not published takes no registration', async () => {
    await open({ [PAGE]: { body: webinar({ consent: { text_ru: '', text_en: '', policy_version: '', policy_ready: false } }) } });
    expect(document.querySelector('form')).toBeNull();
    expect(text()).toContain('Registration opens soon.');
  });

  it('an open-link webinar hides the room until it opens, then offers the join button and the call-back card', async () => {
    const open_ = webinar({ access_mode: 'open', registration_open: false });
    await open({ [PAGE]: { body: open_ } });
    expect(document.querySelector('a[href*="meet.google.com"]')).toBeNull();
    expect(text()).toContain('The join button appears 15 minutes before the start.');
    expect(text()).toContain('Want a free consultation?');
    await unmount();

    await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false, state: 'live', join_url: 'https://meet.google.com/abc-defg-hij' }) } });
    const join = document.querySelector('a[href="https://meet.google.com/abc-defg-hij"]') as HTMLAnchorElement;
    expect(join.target).toBe('_blank');
    expect(join.rel).toContain('noopener');
    expect(text()).toContain('The webinar is on now');
  });

  it('leaves a number for a call-back without asking for an e-mail', async () => {
    const backend = await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false }) }, 'POST /public/leads': { body: { ok: true } } });
    expect(document.querySelector('#ow-email')).toBeNull();
    await type('#ow-name', 'Aigerim S');
    await type('#ow-phone', '+7 700 123 45 67');
    await click(document.querySelector('#ow-consent'));
    await submit();
    const post = backend.calls.find((c) => c.url === '/public/leads')!;
    expect(post.body).toMatchObject({ webinar_slug: SLUG, name: 'Aigerim S', consent: true });
    expect(post.body!.email).toBeUndefined();
    expect(text()).toContain('Thank you! We will contact you soon.');
  });

  it('a finished webinar points to its recording when there is one and offers the call-back card instead of a form', async () => {
    await open({ [PAGE]: { body: webinar({ state: 'ended', registration_open: false, recording_slug: SLUG }) } });
    expect(text()).toContain('This webinar is over');
    expect(document.querySelector('form')?.querySelector('#ow-email')).toBeNull();
    const watch = Array.from(document.querySelectorAll('a')).find((a) => a.textContent?.includes('Watch the recording')) as HTMLAnchorElement;
    expect(watch.getAttribute('href')).toBe(`/r/${SLUG}`);
    expect(text()).toContain('Want a free consultation?');
  });

  it('says so for an unknown webinar and offers a retry when the network fails', async () => {
    await open({});
    expect(text()).toContain('This webinar was not found.');
    await unmount();

    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    await mount(<MemoryRouter initialEntries={[`/w/${SLUG}`]}><Routes><Route path="/w/:slug" element={<PublicWebinarPage />} /></Routes></MemoryRouter>);
    expect(text()).toContain('Couldn’t load the page.');
    expect(Array.from(document.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(true);
  });
});

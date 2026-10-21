// @vitest-environment jsdom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicWebinarPage from './PublicWebinarPage';
import { act } from 'react';
import { backendBase } from '../lib/mediaUrl';
import { click, fakeBackend, memoryStorage, mount, settle, submit, text, type, unmount, webinar } from './publicWebinarsTestKit';

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
    expect(post.body).toMatchObject({ name: 'Aigerim S', phone: '8 700 123 45 67', email: 'a@example.com', consent: true, lang: 'en', ow_extra: '' });
    expect(post.body).not.toHaveProperty('captcha_token');
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

  it('says the room is being opened when an open-link webinar is on but has no link yet', async () => {
    await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false, state: 'live', join_url: null }) } });
    expect(text()).toContain('the room is being opened');
    expect(text()).not.toContain('The join button appears 15 minutes before the start.');
  });

  it('says the webinar was cancelled — not «not found» — when the backend answers 410', async () => {
    await open({ [PAGE]: { status: 410, body: { detail: 'This webinar was cancelled', reason_code: 'webinar_cancelled' } } });
    expect(text()).toContain('This webinar has been cancelled.');
    expect(text()).not.toContain('was not found');
  });

  it('leaves a number for a call-back without asking for an e-mail', async () => {
    const backend = await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false }) }, 'POST /public/leads': { body: { ok: true } } });
    expect(document.querySelector('#ow-email')).toBeNull();
    await type('#ow-name', 'Aigerim S');
    await type('#ow-phone', '+7 700 123 45 67');
    await click(document.querySelector('#ow-consent'));
    await submit();
    const post = backend.calls.find((c) => c.url === '/public/leads')!;
    expect(post.body).toMatchObject({ webinar_slug: SLUG, name: 'Aigerim S', consent: true, lang: 'en' });
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


describe('the poster, the seats and the neutral answer', () => {
  it('leads the page with the banner, above the title, and shows it whole', async () => {
    await open({ [PAGE]: { body: webinar({ banner_url: '/uploads/webinar_banners/42.png' }) } });
    const img = document.querySelector('img[data-banner]') as HTMLImageElement;
    expect(img.alt).toBe('IELTS Writing Office Hours');
    expect(img.src).toMatch(/\/uploads\/webinar_banners\/42\.png$/);
    expect(img.className).toContain('object-contain');
    expect(img.className).toContain('rounded');
    expect(img.compareDocumentPosition(document.querySelector('h1')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has no banner image when the webinar has none, and the page reads as before', async () => {
    await open({ [PAGE]: { body: webinar({ banner_url: null }) } });
    expect(document.querySelector('img[data-banner]')).toBeNull();
    expect(text()).toContain('Register for free');
  });

  it('says all seats are taken instead of showing the form', async () => {
    await open({ [PAGE]: { body: webinar({ full: true, seats_left: 0 }) } });
    expect(document.querySelector('[data-full]')?.textContent).toBe('All seats are taken.');
    expect(document.querySelector('form')).toBeNull();
    expect(text()).not.toContain('Register for free');
  });

  it('still says so when the server also closes registration for a full webinar', async () => {
    await open({ [PAGE]: { body: webinar({ full: true, seats_left: 0, registration_open: false }) } });
    expect(document.querySelector('[data-full]')).not.toBeNull();
  });

  it('shows the form while there are seats left', async () => {
    await open({ [PAGE]: { body: webinar({ full: false, seats_left: 3 }) } });
    expect(document.querySelector('[data-full]')).toBeNull();
    expect(document.querySelector('form')).not.toBeNull();
  });

  it('for a phone that is already registered, never opens the personal page: it says the link went to the e-mail on file', async () => {
    const backend = await open({ [PAGE]: { body: webinar() }, [REGISTER]: { body: { ok: true } } });
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(backend.calls.some((c) => c.method === 'POST')).toBe(true);
    expect(text()).not.toContain('JOIN PAGE');
    expect(document.querySelector('[data-registered-neutral]')?.textContent).toBe('If this number is registered, we sent the personal link to the e-mail on file.');
    expect(document.querySelector('form')).toBeNull();
  });

  it('says the webinar was cancelled when a registration is refused with 410', async () => {
    await open({ [PAGE]: { body: webinar() }, [REGISTER]: { status: 410, body: { detail: 'This webinar was cancelled', reason_code: 'webinar_cancelled' } } });
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(text()).toContain('This webinar has been cancelled.');
    expect(text()).not.toContain('Something went wrong');
  });
});

describe('keeping the page fresh', () => {
  type Reply = { status?: number; body: unknown };
  /** The page's answers, one per poll; the last one repeats. Only intervals are faked, so the DOM helpers keep working. */
  async function poll(replies: Reply[]) {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let n = 0;
    const backend = await open({ [PAGE]: () => replies[Math.min(n++, replies.length - 1)] });
    const gets = () => backend.calls.filter((c) => c.method === 'GET').length;
    const tick = async (ms: number) => { await act(async () => { vi.advanceTimersByTime(ms); }); await settle(); };
    return { gets, tick };
  }
  afterEach(() => { vi.useRealTimers(); });

  it('asks again every 30 seconds while the webinar is not over, and the countdown turns into the join button', async () => {
    const { gets, tick } = await poll([
      { body: webinar({ access_mode: 'open', registration_open: false }) },
      { body: webinar({ access_mode: 'open', registration_open: false, state: 'live', join_url: 'https://meet.google.com/abc-defg-hij' }) },
    ]);
    expect(gets()).toBe(1);
    await tick(29_000);
    expect(gets()).toBe(1);
    await tick(1_000);
    expect(gets()).toBe(2);
    expect(document.querySelector('a[href="https://meet.google.com/abc-defg-hij"]')).not.toBeNull();
  });

  it('stops asking once the page says the webinar is over', async () => {
    const { gets, tick } = await poll([{ body: webinar({ state: 'live', registration_open: false }) }, { body: webinar({ state: 'ended', registration_open: false }) }]);
    await tick(30_000);
    expect(gets()).toBe(2);
    expect(text()).toContain('This webinar is over');
    await tick(120_000);
    expect(gets()).toBe(2);
  });

  it('does not poll a webinar that was already over when the page opened', async () => {
    const { gets, tick } = await poll([{ body: webinar({ state: 'ended', registration_open: false }) }]);
    await tick(120_000);
    expect(gets()).toBe(1);
  });

  it('stops asking once the webinar is cancelled', async () => {
    const { gets, tick } = await poll([{ status: 410, body: { detail: 'cancelled', reason_code: 'webinar_cancelled' } }]);
    expect(text()).toContain('This webinar has been cancelled.');
    await tick(120_000);
    expect(gets()).toBe(1);
  });

  it('a later 410 replaces the page that was showing, form included', async () => {
    const { tick } = await poll([{ body: webinar() }, { status: 410, body: { detail: 'cancelled', reason_code: 'webinar_cancelled' } }]);
    expect(document.querySelector('form')).not.toBeNull();
    await tick(30_000);
    expect(text()).toContain('This webinar has been cancelled.');
    expect(document.querySelector('form')).toBeNull();
    expect(text()).not.toContain('IELTS Writing Office Hours');
  });

  it('a later 404 replaces it with «not found»', async () => {
    const { tick } = await poll([{ body: webinar() }, { status: 404, body: { detail: 'not found', reason_code: 'webinar_not_found' } }]);
    await tick(30_000);
    expect(text()).toContain('This webinar was not found.');
    expect(document.querySelector('form')).toBeNull();
  });

  it('a hiccup (a 500) does not replace what the visitor is reading, and the next poll recovers', async () => {
    const { gets, tick } = await poll([{ body: webinar() }, { status: 500, body: { detail: 'boom' } }, { body: webinar({ title: 'Renamed webinar' }) }]);
    await tick(30_000);
    expect(gets()).toBe(2);
    expect(text()).toContain('IELTS Writing Office Hours');
    expect(text()).not.toContain('Couldn’t load the page');
    await tick(30_000);
    expect(text()).toContain('Renamed webinar');
  });
});

describe('the language a visitor read the consent in', () => {
  const REG = { [PAGE]: { body: webinar() }, [REGISTER]: { body: { ok: true } } };

  it('is sent with a registration: Russian when the page was shown in Russian', async () => {
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    const backend = await open(REG);
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(backend.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ lang: 'ru' });
  });

  it('follows the visitor’s switch: switching to Russian after the page opened sends ru', async () => {
    const backend = await open(REG);
    await click(Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Русский') ?? null);
    await fill();
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(backend.calls.find((c) => c.method === 'POST')!.body).toMatchObject({ lang: 'ru' });
  });

  it('is sent with a call-back request too', async () => {
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    const backend = await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false }) }, 'POST /public/leads': { body: { ok: true } } });
    await type('#ow-name', 'Aigerim S');
    await type('#ow-phone', '+7 700 123 45 67');
    await click(document.querySelector('#ow-consent'));
    await submit();
    expect(backend.calls.find((c) => c.url === '/public/leads')!.body).toMatchObject({ lang: 'ru', webinar_slug: SLUG });
  });
});

describe('who is named on the page', () => {
  const guest = { kind: 'guest', name: 'Dr. Guest', organisation: 'Some University', bio: 'Admissions', photo_url: 'https://cdn.example/p.jpg' };

  it('a guest speaker keeps their profile: name, organisation, bio and photo', async () => {
    await open({ [PAGE]: { body: webinar({ speaker: guest }) } });
    const block = document.querySelector('[data-speaker]')!;
    expect(block.textContent).toContain('Dr. Guest, Some University');
    expect(block.textContent).toContain('Admissions');
    expect(block.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/p.jpg');
    expect(document.querySelector('[data-host-line]')).toBeNull();
  });

  it('an uploaded photo is a path on the API host, so the page asks the API for it, not its own server', async () => {
    await open({ [PAGE]: { body: webinar({ speaker: { ...guest, photo_url: '/uploads/webinar_speakers/5.jpg' } }) } });
    expect(document.querySelector('[data-speaker] img')?.getAttribute('src')).toBe(`${backendBase()}/uploads/webinar_speakers/5.jpg`);
  });

  it('the host is one plain «Host: <name>» line: no photo, no bio, no speaker card', async () => {
    await open({ [PAGE]: { body: webinar({ speaker: { kind: 'host', name: 'Aldiyar Zhumadilda', organisation: null, bio: 'Must not show', photo_url: 'https://cdn.example/x.jpg' } }) } });
    expect(document.querySelector('[data-host-line]')?.textContent).toBe('Host: Aldiyar Zhumadilda');
    expect(document.querySelector('[data-speaker]')).toBeNull();
    expect(document.querySelector('[data-host-line] img')).toBeNull();
    expect(text()).not.toContain('Must not show');
  });

  it('the host line is in Russian for a Russian visitor', async () => {
    vi.stubGlobal('navigator', { language: 'ru-RU' });
    await open({ [PAGE]: { body: webinar({ speaker: { kind: 'host', name: 'Алдияр Жумадилда', organisation: null, bio: null, photo_url: null } }) } });
    expect(document.querySelector('[data-host-line]')?.textContent).toBe('Ведущий: Алдияр Жумадилда');
  });

  it('names nobody when the webinar names nobody', async () => {
    await open({ [PAGE]: { body: webinar({ speaker: null }) } });
    expect(document.querySelector('[data-speaker]')).toBeNull();
    expect(document.querySelector('[data-host-line]')).toBeNull();
    expect(text()).toContain('IELTS Writing Office Hours');
  });

  it('a speaker without a kind (an older server) reads as a guest speaker', async () => {
    await open({ [PAGE]: { body: webinar({ speaker: { name: 'Dr. Guest', organisation: null, bio: null, photo_url: null } }) } });
    expect(document.querySelector('[data-speaker]')).not.toBeNull();
  });
});

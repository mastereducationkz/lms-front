// @vitest-environment jsdom
import { act, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ContactForm from './ContactForm';
import PublicWebinarPage from '../../pages/PublicWebinarPage';
import { PublicApiError, type ContactBody } from '../../services/api/publicWebinars';
import { t as translate } from '../../lib/i18n/translate';
import type { Locale } from '../../lib/i18n/locale';
import { click, fakeBackend, memoryStorage, mount, settle, submit, text, type, unmount, webinar } from '../../pages/publicWebinarsTestKit';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SITE_KEY = '1x00000000000000000000AA';
const SCRIPT = 'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]';

type Options = {
  sitekey: string; theme: string; language: string;
  callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void;
};

/** A stand-in for Cloudflare's `window.turnstile`: remembers every widget it was asked to draw, and lets the test play the challenge. */
function fakeTurnstile() {
  const widgets: { container: HTMLElement; options: Options }[] = [];
  const api = {
    render: vi.fn((container: HTMLElement, options: Options) => { widgets.push({ container, options }); return `widget-${widgets.length}`; }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  vi.stubGlobal('turnstile', api);
  const latest = () => widgets[widgets.length - 1];
  return {
    api, widgets,
    solve: (token: string) => act(async () => { latest().options.callback(token); }),
    expire: () => act(async () => { latest().options['expired-callback'](); }),
    fail: () => act(async () => { latest().options['error-callback'](); }),
  };
}

const t = (key: Parameters<typeof translate>[0], params?: Parameters<typeof translate>[1]) => translate(key, params, 'en');
const sendButton = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;
const fillAndConsent = async () => {
  await type('#ow-name', 'Aigerim S');
  await type('#ow-phone', '+7 700 123 45 67');
  await click(document.querySelector('#ow-consent'));
};

function Form({ onSubmit, locale = 'en' }: { onSubmit: (body: ContactBody) => Promise<void>; locale?: Locale }) {
  return <MemoryRouter><ContactForm t={t} locale={locale} withEmail={false} consentText="I agree." submitLabel="Send" onSubmit={onSubmit} /></MemoryRouter>;
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('navigator', { language: 'en-US' });
});
afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.head.querySelectorAll(SCRIPT).forEach((s) => s.remove());
});

describe.each([['unset', undefined], ['empty', ''], ['blank', '   ']])('Turnstile with no site key (%s)', (_name, value) => {
  beforeEach(() => { if (value !== undefined) vi.stubEnv('VITE_TURNSTILE_SITE_KEY', value); });

  it('shows no check, loads nothing, never waits for a token, and sends none', async () => {
    const sent: ContactBody[] = [];
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async (body) => { sent.push(body); }} />);
    expect(document.querySelector('[data-turnstile]')).toBeNull();
    expect(document.querySelector(SCRIPT)).toBeNull();
    expect(turnstile.api.render).not.toHaveBeenCalled();
    expect(sendButton().disabled).toBe(false);
    await fillAndConsent();
    await submit();
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('captcha_token');
  });
});

describe('Turnstile with a site key', () => {
  beforeEach(() => { vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY); });

  it('draws the widget with the site key, an automatic theme and the page’s language', async () => {
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async () => {}} locale="ru" />);
    expect(turnstile.api.render).toHaveBeenCalledTimes(1);
    const [container, options] = turnstile.api.render.mock.calls[0];
    expect(container).toBe(document.querySelector('[data-turnstile]'));
    expect(options).toMatchObject({ sitekey: SITE_KEY, theme: 'auto', language: 'ru' });
  });

  it('keeps the button disabled until the challenge gives a token, and sends it as captcha_token', async () => {
    const sent: ContactBody[] = [];
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async (body) => { sent.push(body); }} />);
    await fillAndConsent();
    expect(sendButton().disabled).toBe(true);
    await submit();                                                         // a form sent some other way is held too
    expect(sent).toHaveLength(0);
    await turnstile.solve('token-1');
    expect(sendButton().disabled).toBe(false);
    await submit();
    expect(sent).toHaveLength(1);
    expect(sent[0].captcha_token).toBe('token-1');
    expect(sent[0]).toMatchObject({ name: 'Aigerim S', consent: true, lang: 'en' });
  });

  it('waits for a new token when the old one expires or the challenge errors', async () => {
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async () => {}} />);
    await turnstile.solve('token-1');
    expect(sendButton().disabled).toBe(false);
    await turnstile.expire();
    expect(sendButton().disabled).toBe(true);
    await turnstile.solve('token-2');
    expect(sendButton().disabled).toBe(false);
    await turnstile.fail();
    expect(sendButton().disabled).toBe(true);
  });

  it('resets the widget after a refusal — captcha_failed or any other — and needs a fresh token to try again', async () => {
    const sent: ContactBody[] = [];
    const refusals = [new PublicApiError(400, 'captcha_failed', 'captcha'), new PublicApiError(500, null, 'boom')];
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async (body) => { sent.push(body); const refusal = refusals.shift(); if (refusal) throw refusal; }} />);
    await fillAndConsent();
    await turnstile.solve('token-1');
    await submit();
    expect(text()).toContain('Please confirm you are not a robot and try again.');   // the catalog's sentence for captcha_failed
    expect(turnstile.api.reset).toHaveBeenCalledTimes(1);
    expect(turnstile.api.reset).toHaveBeenLastCalledWith('widget-1');
    expect(sendButton().disabled).toBe(true);                                         // the spent token is gone
    await turnstile.solve('token-2');
    await submit();
    expect(text()).toContain('Something went wrong');
    expect(turnstile.api.reset).toHaveBeenCalledTimes(2);
    expect(sendButton().disabled).toBe(true);
    await turnstile.solve('token-3');
    await submit();
    expect(sent.map((body) => body.captcha_token)).toEqual(['token-1', 'token-2', 'token-3']);
    expect(turnstile.api.reset).toHaveBeenCalledTimes(2);                             // a success has nothing to reset
  });

  it('draws the widget again in the other language when the visitor switches, and removes the old one', async () => {
    const turnstile = fakeTurnstile();
    function Switching() {
      const [locale, setLocale] = useState<Locale>('en');
      return <><button type="button" id="to-ru" onClick={() => setLocale('ru')}>RU</button><Form locale={locale} onSubmit={async () => {}} /></>;
    }
    await mount(<Switching />);
    await turnstile.solve('token-1');
    await click(document.querySelector('#to-ru'));
    await settle();
    expect(turnstile.api.remove).toHaveBeenCalledWith('widget-1');
    expect(turnstile.api.render).toHaveBeenCalledTimes(2);
    expect(turnstile.widgets[1].options.language).toBe('ru');
    expect(sendButton().disabled).toBe(true);                                         // the old token went with the old widget
  });

  it('removes the widget when the form goes away', async () => {
    const turnstile = fakeTurnstile();
    await mount(<Form onSubmit={async () => {}} />);
    await unmount();
    expect(turnstile.api.remove).toHaveBeenCalledWith('widget-1');
  });
});

describe('Turnstile’s script', () => {
  beforeEach(() => { vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY); });
  const scripts = () => document.head.querySelectorAll(SCRIPT);

  it('is added once with explicit rendering, however many forms ask, and every form draws its widget when it loads', async () => {
    await mount(<><Form onSubmit={async () => {}} /><Form onSubmit={async () => {}} /></>);
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].getAttribute('src')).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(document.querySelectorAll('[data-turnstile]')).toHaveLength(2);
    const turnstile = fakeTurnstile();
    await act(async () => { scripts()[0].dispatchEvent(new Event('load')); });
    await settle();
    expect(turnstile.api.render).toHaveBeenCalledTimes(2);
    expect(turnstile.widgets.map((w) => w.container)).toEqual(Array.from(document.querySelectorAll('[data-turnstile]')));
  });

  it('says so when it cannot be loaded, keeps the button disabled, and is tried again by the next form', async () => {
    await mount(<Form onSubmit={async () => {}} />);
    await act(async () => { scripts()[0].dispatchEvent(new Event('error')); });
    await settle();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('The security check could not be loaded');
    expect(sendButton().disabled).toBe(true);
    expect(scripts()).toHaveLength(0);
    await unmount();
    await mount(<Form onSubmit={async () => {}} />);
    expect(scripts()).toHaveLength(1);
    await act(async () => { scripts()[0].dispatchEvent(new Event('error')); });          // leave nothing pending for the next test
  });
});

describe('Turnstile on the public pages', () => {
  const SLUG = 'ielts-writing-2030-03-03';
  const PAGE = `GET /public/webinars/${SLUG}`;
  const REGISTER = `POST /public/webinars/${SLUG}/register`;
  const open = async (routes: Parameters<typeof fakeBackend>[0]) => {
    const backend = fakeBackend(routes);
    vi.stubGlobal('fetch', backend.fetchMock);
    await mount(
      <MemoryRouter initialEntries={[`/w/${SLUG}`]}>
        <Routes>
          <Route path="/w/j/:code" element={<p>JOIN PAGE</p>} />
          <Route path="/w/:slug" element={<PublicWebinarPage />} />
        </Routes>
      </MemoryRouter>,
    );
    return backend;
  };
  beforeEach(() => { vi.stubEnv('VITE_TURNSTILE_SITE_KEY', SITE_KEY); });

  it('a registration carries the token, and a refused check (captcha_failed) resets the widget and says so', async () => {
    const answers = [{ status: 400, body: { detail: 'Captcha failed', reason_code: 'captcha_failed' } }, { body: { join_code: 'CODE123', join_path: '/w/j/CODE123' } }];
    const turnstile = fakeTurnstile();
    const backend = await open({ [PAGE]: { body: webinar() }, [REGISTER]: () => answers.shift()! });
    await type('#ow-name', 'Aigerim S');
    await type('#ow-phone', '8 700 123 45 67');
    await type('#ow-email', 'a@example.com');
    await click(document.querySelector('#ow-consent'));
    expect(sendButton().disabled).toBe(true);
    await turnstile.solve('token-1');
    await submit();
    expect(backend.calls.filter((c) => c.method === 'POST')[0].body).toMatchObject({ captcha_token: 'token-1' });
    expect(text()).toContain('Please confirm you are not a robot and try again.');
    expect(turnstile.api.reset).toHaveBeenCalledTimes(1);
    expect(sendButton().disabled).toBe(true);
    await turnstile.solve('token-2');
    await submit();
    expect(backend.calls.filter((c) => c.method === 'POST')[1].body).toMatchObject({ captcha_token: 'token-2' });
    expect(text()).toContain('JOIN PAGE');
  });

  it('a call-back request carries the token too', async () => {
    const turnstile = fakeTurnstile();
    const backend = await open({ [PAGE]: { body: webinar({ access_mode: 'open', registration_open: false }) }, 'POST /public/leads': { body: { ok: true } } });
    await type('#ow-name', 'Aigerim S');
    await type('#ow-phone', '+7 700 123 45 67');
    await click(document.querySelector('#ow-consent'));
    expect(sendButton().disabled).toBe(true);
    await turnstile.solve('token-9');
    await submit();
    expect(backend.calls.find((c) => c.url === '/public/leads')!.body).toMatchObject({ webinar_slug: SLUG, captcha_token: 'token-9' });
    expect(text()).toContain('Thank you! We will contact you soon.');
  });
});

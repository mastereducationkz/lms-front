// @vitest-environment jsdom
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { button, click, fakeBackend, memoryStorage, mount, settle, submit, text, type, unmount } from './publicWebinarsTestKit';
import { missingField } from '../components/trial-links/public/SignupForm';
import TrialSignupPage from './TrialSignupPage';

// The staff half of the API module pulls in the axios client, which reads stored tokens on import.
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      clear: () => data.clear(),
    },
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const login = vi.fn(async () => ({ success: true }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login }) }));

const CODE = 'SCHOOL';
const link = (over: Record<string, unknown> = {}) => ({
  code: CODE, title: 'Школьные презентации', open: true, closed_reason: null, schools_running: [], days: 3,
  grades: ['8', '9', '10', '11', '12', 'graduated', 'other'], interests: ['sat', 'ielts', 'nuet', 'unsure'],
  consent: { text_ru: 'RU consent.', text_en: 'I consent.', policy_ready: true }, ...over,
});

async function open(routes: Parameters<typeof fakeBackend>[0]) {
  const backend = fakeBackend({ [`POST /public/trial/${CODE}/open`]: { body: { ok: true } }, ...routes });
  vi.stubGlobal('fetch', backend.fetchMock);
  await mount(
    <MemoryRouter initialEntries={[`/t/${CODE}`]}>
      <Routes><Route path="/t/:code" element={<TrialSignupPage />} /><Route path="/dashboard" element={<p>DASHBOARD</p>} /></Routes>
    </MemoryRouter>,
  );
  return backend;
}

async function fillAll() {
  await type('#tl-first', 'Aigerim');
  await type('#tl-last', 'Saparova');
  await type('#tl-phone', '+7 700 123 45 67');
  await type('#tl-email', 'a@example.com');
  await click(button('11'));
  await click(button('SAT'));
  await click(button('IELTS'));
  await click(document.querySelector('#tl-consent'));
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('navigator', { language: 'en-US', clipboard: { writeText: vi.fn(async () => undefined) } });
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  login.mockClear();
});
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('the QR sign-up page', () => {
  it('counts the open, and a running presentation makes the school one tap', async () => {
    const backend = await open({ [`GET /public/trial/${CODE}`]: { body: link({ schools_running: [{ id: 7, name: 'School 45', city: 'Shymkent' }] }) } });
    expect(text()).toContain('Try Master Education free for 3 days');
    const opened = backend.calls.find((c) => c.url.endsWith('/open'));
    expect(String(opened?.body?.visitor_key)).toMatch(/^[0-9a-f]{32}$/);
    // The only running presentation is pre-selected.
    expect(text()).toContain('School 45, Shymkent');
    expect(text()).toContain('Change');
  });

  it('signs a new student up, logs them in and shows the login and password', async () => {
    const backend = await open({
      [`GET /public/trial/${CODE}`]: { body: link({ schools_running: [{ id: 7, name: 'School 45', city: 'Shymkent' }] }) },
      [`POST /public/trial/${CODE}/signup`]: { body: { outcome: 'created', email: 'a@example.com', password: 'Pw-123456', name: 'Saparova Aigerim', expires_at: '2030-03-04T06:00:00Z', courses: ['SAT Math'] } },
    });
    await fillAll();
    await submit();
    await settle();
    const sent = backend.calls.find((c) => c.url.endsWith('/signup'))?.body as Record<string, unknown>;
    expect(sent).toMatchObject({ first_name: 'Aigerim', last_name: 'Saparova', grade: '11', interests: ['sat', 'ielts'], school_id: 7, consent: true, lang: 'en' });
    expect(login).toHaveBeenCalledWith('a@example.com', 'Pw-123456');
    expect(text()).toContain('Your trial is open');
    expect(text()).toContain('Pw-123456');
    expect(text()).toContain('SAT Math');
    await click(button('Start learning'));
    expect(text()).toContain('DASHBOARD');
  });

  it('never shows a password or logs in for an e-mail that already has an account', async () => {
    await open({
      [`GET /public/trial/${CODE}`]: { body: link({ schools_running: [{ id: 7, name: 'School 45', city: 'Shymkent' }] }) },
      [`POST /public/trial/${CODE}/signup`]: { body: { outcome: 'existing_account', email: 'a@example.com' } },
    });
    await fillAll();
    await submit();
    expect(login).not.toHaveBeenCalled();
    expect(text()).toContain('You already have an account');
    expect(text()).toContain('Forgot your password?');
  });

  it('a repeated phone is told the masked e-mail it used', async () => {
    await open({
      [`GET /public/trial/${CODE}`]: { body: link({ schools_running: [{ id: 7, name: 'School 45', city: 'Shymkent' }] }) },
      [`POST /public/trial/${CODE}/signup`]: { body: { outcome: 'phone_registered', masked_email: 'a***@example.com' } },
    });
    await fillAll();
    await submit();
    expect(text()).toContain('This phone is already registered');
    expect(text()).toContain('a***@example.com');
  });

  it('says why when sign-ups are closed, and shows no form', async () => {
    await open({ [`GET /public/trial/${CODE}`]: { body: link({ open: false, closed_reason: 'signups_closed' }) } });
    expect(text()).toContain('Sign-ups are not open yet');
    expect(document.querySelector('form')).toBeNull();
  });

  it('a student whose school is not listed types it with the city', async () => {
    const backend = await open({
      [`GET /public/trial/${CODE}`]: { body: link() },
      [`POST /public/trial/${CODE}/signup`]: { body: { outcome: 'created', email: 'a@example.com', password: 'x', expires_at: '2030-03-04T06:00:00Z' } },
    });
    await click(button('My school isn’t in the list'));
    await type('#tl-school-name', 'Lyceum 1');
    await type('#tl-school-city', 'Almaty');
    await fillAll();
    await submit();
    await act(async () => { await settle(); });
    const sent = backend.calls.find((c) => c.url.endsWith('/signup'))?.body as Record<string, unknown>;
    expect(sent.new_school).toEqual({ name: 'Lyceum 1', city: 'Almaty' });
    expect(sent.school_id).toBeUndefined();
  });

  it('a server refusal is shown in the visitor’s words', async () => {
    await open({
      [`GET /public/trial/${CODE}`]: { body: link({ schools_running: [{ id: 7, name: 'School 45', city: 'Shymkent' }] }) },
      [`POST /public/trial/${CODE}/signup`]: { status: 429, body: { reason_code: 'too_many', detail: 'Too many' } },
    });
    await fillAll();
    await submit();
    expect(text()).toContain('Too many attempts from this network');
  });
});

describe('what the form checks before sending', () => {
  const ok = { first: 'A', last: 'B', phone: '+77001234567', email: 'a@b.kz', grade: '10' as const, interests: ['sat' as const],
    school: { kind: 'picked' as const, school: { id: 1, name: 'S', city: null } }, consent: true };
  it.each([
    [{ first: '' }, 'first_name_invalid'], [{ phone: '123' }, 'phone_invalid'], [{ email: 'nope' }, 'email_invalid'],
    [{ school: { kind: 'none' as const } }, 'school_required'], [{ school: { kind: 'new' as const, name: 'L', city: 'Almaty' } }, 'school_name_invalid'],
    [{ school: { kind: 'new' as const, name: 'Lyceum', city: '' } }, 'city_required'], [{ grade: null }, 'grade_required'],
    [{ interests: [] }, 'interests_required'], [{ consent: false }, 'consent_required'],
  ])('%o → %s', (over, code) => {
    expect(missingField({ ...ok, ...over } as Parameters<typeof missingField>[0])).toBe(code);
  });
  it('passes a complete form', () => { expect(missingField(ok)).toBeNull(); });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../services/api/apiError';

const auth = vi.hoisted(() => ({ role: 'admin' }));
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: auth.role } }) };
});

const events = vi.hoisted(() => ({
  createEvent: vi.fn(), createCuratorEvent: vi.fn(), updateEvent: vi.fn(), getEventHosts: vi.fn(), getAllGroups: vi.fn(), getCuratorGroups: vi.fn(), getCourses: vi.fn(),
}));
vi.mock('../services/api', () => ({
  ...events, getEventSeries: vi.fn().mockResolvedValue(null), getCourseModules: vi.fn().mockResolvedValue([]), getModuleLessons: vi.fn().mockResolvedValue([]),
}));
const open = vi.hoisted(() => ({
  getOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), preflightOpenAccess: vi.fn(), saveOpenAccess: vi.fn(), uploadBanner: vi.fn(),
  getOpenAccess: vi.fn(), closeOpenAccess: vi.fn(),
}));
vi.mock('../services/api/openWebinars', () => open);

import EventForm from './EventForm';
import type { Event } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const SETTINGS = {
  policy_text: 'Policy', policy_version: 'abc', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }, { id: 10736538, name: 'NUET + IELTS' }],
};
const CREATED = { id: 501, title: 'Open day', event_type: 'webinar' } as Event;
const ASK = 450;

let root: Root | null = null;
let host: HTMLDivElement;
const onSave = vi.fn();
const onAccessFailed = vi.fn();
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });
const pause = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
async function show() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<MemoryRouter><EventForm onSave={onSave} onCancel={() => {}} onAccessFailed={onAccessFailed} /></MemoryRouter>); });
  await settle();
}
const setter = (proto: object) => Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
const type = (selector: string, value: string) => act(async () => {
  const input = host.querySelector(selector) as HTMLInputElement;
  setter(HTMLInputElement.prototype).call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const click = (el: Element | null) => act(async () => { (el as HTMLElement).click(); });
const radioPick = (name: string, value: string) => click(host.querySelector(`input[name="${name}"][value="${value}"]`));
const pick = (selector: string, value: string) => act(async () => {
  const select = host.querySelector(selector) as HTMLSelectElement;
  select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
});
const submit = async () => { await click(host.querySelector('button[type="submit"]')); await settle(); };
const radio = (value: string) => host.querySelector(`input[name="access-mode"][value="${value}"]`) as HTMLInputElement;
const saveButton = () => host.querySelector('button[type="submit"]') as HTMLButtonElement;
const text = () => host.textContent ?? '';

/** The event type is a Radix select: open it from the keyboard and click the option. */
async function chooseType(label: string) {
  const trigger = host.querySelector('#event_type')?.closest('div')?.querySelector('button[role="combobox"]') as HTMLButtonElement
    ?? host.querySelector('button[role="combobox"]') as HTMLButtonElement;
  await act(async () => { trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes(label));
  await act(async () => { (option as HTMLElement).click(); });
}
async function fillWebinar({ audience = true }: { audience?: boolean } = {}) {
  await type('#title', 'Open day');
  await type('#start_datetime', '2099-03-03T14:00');
  await type('#end_datetime', '2099-03-03T15:30');
  await chooseType('Webinar');
  if (audience) await click(host.querySelector('#group-1'));
}

beforeEach(() => {
  auth.role = 'admin';
  Object.values(events).forEach((fn) => fn.mockReset());
  Object.values(open).forEach((fn) => fn.mockReset());
  onSave.mockReset(); onAccessFailed.mockReset();
  events.getEventHosts.mockResolvedValue([{ id: 5, name: 'Aldiyar', role: 'teacher', has_workspace: true }]);
  events.getAllGroups.mockResolvedValue([{ id: 1, name: 'Group one', student_count: 3, is_special: false }]);
  events.getCuratorGroups.mockResolvedValue([{ id: 1, name: 'Group one', student_count: 3, is_special: false }]);
  events.getCourses.mockResolvedValue([]);
  events.createEvent.mockResolvedValue(CREATED);
  events.createCuratorEvent.mockResolvedValue(CREATED);
  open.getOpenSettings.mockResolvedValue(SETTINGS);
  open.listGuestSpeakers.mockResolvedValue([{ id: 3, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
  open.preflightOpenAccess.mockResolvedValue({ ok: true, slug: 'open-day-2099-03-03' });
  open.saveOpenAccess.mockResolvedValue({ event_id: 501, access_mode: 'registration', slug: 'open-day-2099-03-03', banner_url: null });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

describe('create form: who may open a webinar to everyone', () => {
  it.each(['admin', 'head_teacher', 'head_curator'])('%s sees «Who can join» on a webinar', async (role) => {
    auth.role = role;
    await show();
    expect(text()).not.toContain('Who can join');
    await fillWebinar({ audience: false });
    expect(text()).toContain('Who can join');
    expect(radio('students').checked).toBe(true);
  });

  it.each(['teacher', 'curator'])('%s does not: opening a webinar to everyone is a head’s call', async (role) => {
    auth.role = role;
    await show();
    await fillWebinar({ audience: false });
    expect(text()).not.toContain('Who can join');
    expect(host.querySelector('input[name="access-mode"]')).toBeNull();
  });

  it('is only for a webinar, not for a class lesson', async () => {
    await show();
    expect(text()).not.toContain('Who can join');
  });
});

describe('create form: Save for a webinar that stays students-only', () => {
  it.each([['admin', 'createEvent'], ['head_teacher', 'createEvent'], ['curator', 'createCuratorEvent'], ['head_curator', 'createCuratorEvent']] as const)(
    '%s creates the event through %s, with no preflight and no access call', async (role, endpoint) => {
      auth.role = role;
      await show();
      await fillWebinar();
      await submit();
      expect(events[endpoint]).toHaveBeenCalledTimes(1);
      expect(open.preflightOpenAccess).not.toHaveBeenCalled();
      expect(open.saveOpenAccess).not.toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith(CREATED);
    },
  );
});

describe('create form: Save for a webinar that opens to everyone', () => {
  it('has no pipeline preselected, disables Save until one is chosen, and names the address in a summary', async () => {
    await show();
    await fillWebinar();
    await click(radio('registration'));
    expect((host.querySelector('#ow-pipeline') as HTMLSelectElement).value).toBe('');
    expect(saveButton().disabled).toBe(true);
    await pick('#ow-pipeline', '10736538');
    expect(saveButton().disabled).toBe(false);
    await pause(ASK);
    expect(host.querySelector('[data-summary]')?.textContent).toContain('Opens to everyone at /w/open-day-2099-03-03 · Presenter: the host · leads → NUET + IELTS');
  });

  it('checks first, then creates the event, then saves the access — in that order', async () => {
    const order: string[] = [];
    open.preflightOpenAccess.mockImplementation(async () => { order.push('preflight'); return { ok: true, slug: 'open-day-2099-03-03' }; });
    events.createEvent.mockImplementation(async () => { order.push('create'); return CREATED; });
    open.saveOpenAccess.mockImplementation(async () => { order.push('put'); return {}; });
    await show();
    await fillWebinar();
    await click(radio('registration'));
    await pick('#ow-pipeline', '10520038');
    await click(host.querySelector('input[name="presenter"][value="speaker"]'));
    await pick('#ow-speaker', '3');
    await pause(ASK);
    order.length = 0;                        // the preview's own check is not the one under test
    await submit();
    expect(order).toEqual(['preflight', 'create', 'put']);
    expect(open.saveOpenAccess).toHaveBeenCalledWith(501, { access_mode: 'registration', slug: null, speaker_id: 3, presenter: 'speaker', lead_pipeline_id: 10520038, banner_url: null });
    expect(events.createEvent.mock.calls[0][0]).toMatchObject({ title: 'Open day', event_type: 'webinar', group_ids: [1] });
    expect(onSave).toHaveBeenCalledWith(CREATED);
    expect(onAccessFailed).not.toHaveBeenCalled();
  });

  it('sends the typed address and the uploaded banner with the access', async () => {
    open.uploadBanner.mockResolvedValue({ url: '/uploads/webinar_banners/9.png' });
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await click(Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Edit address') ?? null);
    await type('#ow-slug', 'open-day');
    await act(async () => {
      const file = host.querySelector('#ow-banner') as HTMLInputElement;
      Object.defineProperty(file, 'files', { value: [new File([new Uint8Array(10)], 'p.png', { type: 'image/png' })], configurable: true });
      file.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
    await submit();
    expect(open.saveOpenAccess.mock.calls[0][1]).toMatchObject({ access_mode: 'open', slug: 'open-day', banner_url: '/uploads/webinar_banners/9.png' });
  });

  it('creates nothing when the server’s check refuses, and shows the refusal on the form', async () => {
    open.preflightOpenAccess.mockRejectedValue(apiError({ response: { data: { detail: 'This webinar has no host.', reason_code: 'no_host' } } }, 'failed'));
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await submit();
    expect(events.createEvent).not.toHaveBeenCalled();
    expect(open.saveOpenAccess).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('This webinar has no host.');
  });

  it('keeps the event and takes the person to its edit page with the reason when saving the access fails', async () => {
    open.saveOpenAccess.mockRejectedValue(apiError({ response: { data: { detail: 'This address is already used by another webinar.', reason_code: 'slug_taken' } } }, 'failed'));
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await submit();
    expect(events.createEvent).toHaveBeenCalledTimes(1);
    expect(onAccessFailed).toHaveBeenCalledWith(CREATED, 'This address is already used by another webinar.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('a head curator uses the curator endpoint for the same flow', async () => {
    auth.role = 'head_curator';
    await show();
    await fillWebinar();
    await click(radio('registration'));
    await pick('#ow-pipeline', '10520038');
    await submit();
    expect(events.createCuratorEvent).toHaveBeenCalledTimes(1);
    expect(events.createEvent).not.toHaveBeenCalled();
    expect(open.saveOpenAccess).toHaveBeenCalledWith(501, expect.objectContaining({ access_mode: 'registration' }));
  });
});

describe('create form: a recurring webinar', () => {
  it('replaces the section by one line, and a Save creates a plain students-only series', async () => {
    await show();
    await fillWebinar();
    await click(radio('registration'));
    await pick('#ow-pipeline', '10520038');
    await click(host.querySelector('#is_recurring'));
    expect(host.querySelector('[data-recurring-note]')?.textContent).toBe('A recurring series cannot be opened to everyone. Open each occurrence from its own edit page.');
    expect(host.querySelector('input[name="access-mode"]')).toBeNull();
    expect(saveButton().disabled).toBe(false);
    await type('#recurrence_end_date', '2099-06-01');
    await submit();
    expect(events.createEvent).toHaveBeenCalledTimes(1);
    expect(open.preflightOpenAccess).not.toHaveBeenCalled();
    expect(open.saveOpenAccess).not.toHaveBeenCalled();
  });
});

describe('create form: «No student audience»', () => {
  it('is refused without a group or course until the box is ticked', async () => {
    await show();
    await fillWebinar({ audience: false });
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await submit();
    expect(text()).toContain('Select at least one group or course');
    expect(events.createEvent).not.toHaveBeenCalled();
  });

  it('lifts the group/course requirement, hides the audience, and sends both lists empty', async () => {
    await show();
    await fillWebinar();                                       // a group IS ticked: it must still not be sent
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    expect(host.querySelector('#group-1')).not.toBeNull();
    await click(host.querySelector('#ow-no-audience'));
    expect(host.querySelector('#group-1')).toBeNull();
    await submit();
    expect(events.createEvent).toHaveBeenCalledTimes(1);
    expect(events.createEvent.mock.calls[0][0]).toMatchObject({ group_ids: [], course_ids: [] });
    expect(open.saveOpenAccess).toHaveBeenCalledTimes(1);
  });

  it('is forgotten when the webinar goes back to students only: the audience is required again', async () => {
    await show();
    await fillWebinar({ audience: false });
    await click(radio('open'));
    await click(host.querySelector('#ow-no-audience'));
    await click(radio('students'));
    expect(host.querySelector('#group-1')).not.toBeNull();
    await submit();
    expect(events.createEvent).not.toHaveBeenCalled();
  });
});

describe('create form: the presenter on the public page', () => {
  it('names the chosen host in the summary, and sends no presenter while the choice is untouched', async () => {
    await show();
    await fillWebinar();
    await act(async () => {
      const trigger = host.querySelector('#teacher_id') as HTMLButtonElement;
      trigger.click();
    });
    const option = Array.from(document.body.querySelectorAll('[role="option"]')).find((o) => o.textContent?.includes('Aldiyar'));
    await act(async () => { (option as HTMLElement).click(); });
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(host.querySelector('[data-summary]')?.textContent).toContain('Presenter: the host, Aldiyar');
    await submit();
    // Untouched: the server reads no speaker as the host, so nothing is sent.
    expect(open.saveOpenAccess.mock.calls[0][1]).not.toHaveProperty('presenter');
    expect(open.saveOpenAccess.mock.calls[0][1]).toMatchObject({ speaker_id: null });
    expect(open.preflightOpenAccess.mock.calls[0][0]).not.toHaveProperty('presenter');
    expect(open.preflightOpenAccess.mock.calls[0][0]).toMatchObject({ speaker_id: null, teacher_id: 5 });
  });

  it('sends «host» once the person has chosen it', async () => {
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await radioPick('presenter', 'none');
    await radioPick('presenter', 'host');
    await submit();
    expect(open.saveOpenAccess.mock.calls[0][1]).toMatchObject({ presenter: 'host', speaker_id: null });
  });

  it('refuses a guest speaker nobody picked, and keeps Save off, before anything is created', async () => {
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await radioPick('presenter', 'speaker');
    expect(saveButton().disabled).toBe(true);
    expect(text()).toContain('Choose the guest speaker, or name the host or nobody.');
    expect(events.createEvent).not.toHaveBeenCalled();
  });

  it('can name nobody, for a host who only starts the recording', async () => {
    await show();
    await fillWebinar();
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await radioPick('presenter', 'none');
    await submit();
    expect(open.saveOpenAccess.mock.calls[0][1]).toMatchObject({ presenter: 'none', speaker_id: null });
  });
});

// @vitest-environment jsdom
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '../../services/api/apiError';
import { button, click, mount, pause, pick, text, type, unmount } from '../../pages/publicWebinarsTestKit';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'admin', ui_language: 'en' } }) };
});

const api = vi.hoisted(() => ({ getOpenSettings: vi.fn(), listGuestSpeakers: vi.fn(), preflightOpenAccess: vi.fn(), uploadBanner: vi.fn() }));
vi.mock('../../services/api/openWebinars', () => api);

import CreateAccessSection from './CreateAccessSection';
import { emptyDraft, type AccessDraft, type EventFacts } from './accessModel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FACTS: EventFacts = { title: 'IELTS Writing', teacherId: 5, meetingUrl: '', startLocal: '2099-03-03T14:00', endLocal: '2099-03-03T15:30', isRecurring: false };
const SETTINGS = {
  policy_text: 'Policy', policy_version: 'abc', policy_updated_at: null, consent_text_ru: 'ru', consent_text_en: 'en',
  pipelines: [{ id: 10520038, name: 'SAT' }, { id: 10736538, name: 'NUET + IELTS' }],
};
/** The debounce before the server is asked (400 ms), and a moment for the answer. */
const ASK = 450;

let latest: AccessDraft;
function Harness({ facts = FACTS }: { facts?: EventFacts }) {
  const [draft, setDraft] = useState<AccessDraft>(emptyDraft);
  latest = draft;
  return <MemoryRouter><CreateAccessSection draft={draft} onChange={setDraft} facts={facts} /></MemoryRouter>;
}
const radio = (value: string) => document.querySelector(`input[name="access-mode"][value="${value}"]`) as HTMLInputElement;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getOpenSettings.mockResolvedValue(SETTINGS);
  api.listGuestSpeakers.mockResolvedValue([{ id: 3, name: 'Dr. Guest', organisation: null, bio: null, photo_url: null, email: null, is_active: true }]);
  api.preflightOpenAccess.mockResolvedValue({ ok: true, slug: 'ielts-writing-2099-03-03' });
});
afterEach(unmount);

describe('«Who can join» on the create form', () => {
  it('starts as students only and asks the server nothing', async () => {
    await mount(<Harness />);
    expect(radio('students').checked).toBe(true);
    await pause(ASK);
    expect(api.preflightOpenAccess).not.toHaveBeenCalled();
  });

  it('has no pipeline preselected, and asks nothing until one is chosen', async () => {
    await mount(<Harness />);
    await click(radio('open'));
    const select = document.querySelector('#ow-pipeline') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(select.options[0].textContent).toBe('Choose the pipeline');
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Choose the pipeline', 'SAT', 'NUET + IELTS']);
    await pause(ASK);
    expect(api.preflightOpenAccess).not.toHaveBeenCalled();
    expect(latest.pipelineId).toBeNull();
  });

  it('previews the address from the server’s answer and summarises where the leads go', async () => {
    await mount(<Harness />);
    await click(radio('registration'));
    await pick('#ow-pipeline', '10736538');
    await pause(ASK);
    expect(api.preflightOpenAccess).toHaveBeenCalledTimes(1);
    expect(api.preflightOpenAccess.mock.calls[0][0]).toMatchObject({
      access_mode: 'registration', lead_pipeline_id: 10736538, teacher_id: 5, title: 'IELTS Writing', is_recurring: false,
      start_datetime: '2099-03-03T09:00:00.000Z', end_datetime: '2099-03-03T10:30:00.000Z',
    });
    expect(document.querySelector('[data-address]')?.textContent).toMatch(/\/w\/ielts-writing-2099-03-03$/);
    expect(document.querySelector('[data-summary]')?.textContent).toContain('Opens to everyone at /w/ielts-writing-2099-03-03 · leads → NUET + IELTS');
  });

  it('lets the address be edited under «Edit address», and asks again with it', async () => {
    await mount(<Harness />);
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(document.querySelector('#ow-slug')).toBeNull();
    await click(button('Edit address'));
    await type('#ow-slug', 'My-Day');
    await pause(ASK);
    expect(latest.slug).toBe('my-day');
    const calls = api.preflightOpenAccess.mock.calls;
    expect(calls[calls.length - 1][0].slug).toBe('my-day');
    expect(document.querySelector('[data-summary]')?.textContent).toContain('/w/my-day');
  });

  it('shows the server’s refusal right in the section, before anything is created', async () => {
    api.preflightOpenAccess.mockRejectedValue(apiError({ response: { data: { detail: 'Dana Curator has no Google Workspace account linked in the LMS, so no Meet room can be made.', reason_code: 'host_no_workspace' } } }, 'failed'));
    await mount(<Harness />);
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(document.querySelector('[data-preflight-error]')?.textContent).toContain('Dana Curator has no Google Workspace account');
    expect(document.querySelector('[data-summary]')).toBeNull();
  });

  it('asks again when the form changes, and forgets an answer given for fields that have since changed', async () => {
    await mount(<Harness />);
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(api.preflightOpenAccess).toHaveBeenCalledTimes(1);
    await pick('#ow-pipeline', '10736538');
    // Until the server has answered for the new fields, no old answer is on screen.
    expect(document.querySelector('[data-address]')?.textContent).not.toMatch(/ielts-writing-2099-03-03/);
    await pause(ASK);
    expect(api.preflightOpenAccess).toHaveBeenCalledTimes(2);
  });

  it('does not ask while the event cannot be checked yet (no title, or the end is before the start)', async () => {
    await mount(<Harness facts={{ ...FACTS, title: '  ' }} />);
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(api.preflightOpenAccess).not.toHaveBeenCalled();
    await unmount();
    await mount(<Harness facts={{ ...FACTS, endLocal: '2099-03-03T13:00' }} />);
    await click(radio('open'));
    await pick('#ow-pipeline', '10520038');
    await pause(ASK);
    expect(api.preflightOpenAccess).not.toHaveBeenCalled();
  });

  it('offers the guest speaker and banner, and «No student audience» only for a public webinar', async () => {
    await mount(<Harness />);
    expect(document.querySelector('#ow-no-audience')).toBeNull();
    await click(radio('open'));
    expect(document.querySelector('#ow-speaker')).not.toBeNull();
    expect(document.querySelector('#ow-banner')).not.toBeNull();
    expect(text()).toContain('No student audience (public page only)');
    await click(document.querySelector('#ow-no-audience'));
    expect(latest.noAudience).toBe(true);
  });

  it('warns that registration needs a published privacy policy', async () => {
    api.getOpenSettings.mockResolvedValue({ ...SETTINGS, policy_text: ' ' });
    await mount(<Harness />);
    await click(radio('registration'));
    expect(text()).toContain('Registration needs a published privacy policy.');
    await click(radio('open'));
    expect(text()).not.toContain('Registration needs a published privacy policy.');
  });

  it('is replaced by one line for a recurring series, and asks nothing', async () => {
    await mount(<Harness facts={{ ...FACTS, isRecurring: true }} />);
    expect(document.querySelector('[data-recurring-note]')?.textContent).toBe('A recurring series cannot be opened to everyone. Open each occurrence from its own edit page.');
    expect(document.querySelector('input[name="access-mode"]')).toBeNull();
    await pause(ASK);
    expect(api.preflightOpenAccess).not.toHaveBeenCalled();
  });
});

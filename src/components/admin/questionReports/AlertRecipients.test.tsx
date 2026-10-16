// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount, settle, text, unmount } from '../../../pages/publicWebinarsTestKit';

vi.mock('../../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: { role: 'head_teacher', ui_language: 'en' } }) };
});
const api = vi.hoisted(() => ({ getAlertState: vi.fn(), setAlertRecipients: vi.fn(), sendAlertTest: vi.fn() }));
vi.mock('../../../services/api/questionReportAlerts', () => api);

import AlertRecipients from './AlertRecipients';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = (over = {}) => ({
  server_chats: 2,
  recipients: [{ user_id: 986, name: 'Абдураимов Азамат', role: 'head_teacher', linked: false }],
  candidates: [{ user_id: 5, name: 'Another Teacher', role: 'teacher', linked: true }],
  ...over,
});
const open = () => click(document.querySelector('[data-alert-recipients] button[aria-expanded]'));
const button = (label: string) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent === label) as HTMLButtonElement;

beforeEach(() => { Object.values(api).forEach((fn) => fn.mockReset()); api.getAlertState.mockResolvedValue(state()); });
afterEach(unmount);

describe('Telegram alerts of the question-reports page', () => {
  it('summarises who is told and how many are still not connected', async () => {
    await mount(<AlertRecipients />);
    expect(text()).toContain('Telegram alerts');
    expect(text()).toContain('1 people · 2 server chats');
    expect(text()).toContain('1 not connected yet');
  });

  it('says plainly that a person who has not connected gets nothing yet, and offers no test for them', async () => {
    await mount(<AlertRecipients />);
    await open();
    expect(text()).toContain('Абдураимов Азамат');
    expect(document.querySelector('[data-link="false"]')?.textContent).toBe('Telegram not connected');
    expect(text()).toContain('press Start in the bot');
    expect(button('Send a test')).toBeUndefined();
  });

  it('adds a person from the list with one click and keeps the existing ones', async () => {
    api.setAlertRecipients.mockResolvedValue(state({ recipients: [{ user_id: 986, name: 'Абдураимов Азамат', role: 'head_teacher', linked: false }, { user_id: 5, name: 'Another Teacher', role: 'teacher', linked: true }], candidates: [] }));
    await mount(<AlertRecipients />);
    await open();
    const select = document.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual(['Add a person…', 'Another Teacher (Teacher) ✓']);
    select.value = '5'; select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    await click(button('Add'));
    await settle();
    expect(api.setAlertRecipients).toHaveBeenCalledWith([986, 5]);
    expect(text()).toContain('2 people');
  });

  it('removes a person, and sends a test to someone who is connected', async () => {
    api.getAlertState.mockResolvedValue(state({ recipients: [{ user_id: 986, name: 'Абдураимов Азамат', role: 'head_teacher', linked: true }] }));
    api.sendAlertTest.mockResolvedValue({ status: 'sent' });
    api.setAlertRecipients.mockResolvedValue(state({ recipients: [] }));
    await mount(<AlertRecipients />);
    await open();
    await click(button('Send a test'));
    await settle();
    expect(api.sendAlertTest).toHaveBeenCalledWith(986);
    expect(text()).toContain('Test message sent.');
    await click(button('Remove'));
    await settle();
    expect(api.setAlertRecipients).toHaveBeenCalledWith([]);
    expect(text()).toContain('Nobody added yet.');
  });

  it('says why a test did not arrive', async () => {
    api.getAlertState.mockResolvedValue(state({ recipients: [{ user_id: 986, name: 'A', role: 'head_teacher', linked: true }] }));
    api.sendAlertTest.mockResolvedValue({ status: 'blocked' });
    await mount(<AlertRecipients />);
    await open();
    await click(button('Send a test'));
    await settle();
    expect(text()).toContain('Not delivered (blocked).');
  });

  it('shows nothing at all to someone who may not manage it', async () => {
    api.getAlertState.mockRejectedValue(new Error('403'));
    await mount(<AlertRecipients />);
    expect(document.querySelector('[data-alert-recipients]')).toBeNull();
  });
});

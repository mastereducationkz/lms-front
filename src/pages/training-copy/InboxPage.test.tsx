// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { click, memoryStorage, mount, settle, text, unmount } from '../publicWebinarsTestKit';

vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k), clear: () => data.clear() },
  });
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fetchInbox = vi.fn();
const fetchInboxMessage = vi.fn();
vi.mock('../../services/api/trainingCopy', () => ({
  fetchInbox: (p: unknown) => fetchInbox(p),
  fetchInboxMessage: (id: number) => fetchInboxMessage(id),
}));

const { default: InboxPage } = await import('./InboxPage');
const { pickValue } = await import('../../test/dropdown');

const msg = (over: Record<string, unknown> = {}) => ({
  id: 1, created_at: '2026-11-03T09:00:00Z', source_app: 'lms', channel: 'email', kind: 'parent_absence_notice',
  recipient_kind: 'parent', recipient_label: 'Гульмира Нурланова <gu***@train.invalid>', subject: 'Пропуск урока',
  body_text: 'Айдар пропустил урок', has_html: true, ...over,
});

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); fetchInbox.mockReset(); fetchInboxMessage.mockReset(); });
afterEach(async () => { await unmount(); vi.unstubAllGlobals(); });

describe('the practice inbox', () => {
  it('lists what the copy would have sent and says so', async () => {
    fetchInbox.mockResolvedValue([msg(), msg({ id: 2, channel: 'support_bot', recipient_kind: 'group_chat', subject: null, has_html: false })]);
    await mount(<InboxPage />); await settle();
    const t = text();
    expect(t).toContain('Practice inbox');
    expect(t).toContain('Nothing here was actually delivered');
    expect(t).toContain('Пропуск урока');
    expect(t).toContain('(no subject)');
    expect(t).toContain('Parent');
    expect(t).toContain('Group chat');
  });

  it('shows an empty state', async () => {
    fetchInbox.mockResolvedValue([]);
    await mount(<InboxPage />); await settle();
    expect(text()).toContain('Nothing yet');
  });

  it('opens an HTML message in a sandboxed frame and a plain one as text', async () => {
    fetchInbox.mockResolvedValue([msg(), msg({ id: 2, has_html: false, subject: 'DM', body_text: 'plain words' })]);
    fetchInboxMessage.mockImplementation(async (id: number) => id === 1
      ? { ...msg(), body_html: '<p>hello <script>alert(1)</script></p>', payload: {} }
      : { ...msg({ id: 2, has_html: false, subject: 'DM', body_text: 'plain words' }), body_html: null, payload: {} });
    await mount(<InboxPage />); await settle();
    const rows = Array.from(document.querySelectorAll('section ul button')) as HTMLButtonElement[];
    await click(rows[0]); await settle();
    const frame = document.querySelector('iframe') as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.getAttribute('sandbox')).toBe('');     // no scripts, no forms, no same-origin
    expect(frame.getAttribute('srcdoc')).toContain('hello');
    await click(rows[1]); await settle();
    expect(document.querySelector('iframe')).toBeNull();
    expect(text()).toContain('plain words');
  });

  it('asks for one channel at a time and says when loading failed', async () => {
    fetchInbox.mockResolvedValue([msg()]);
    await mount(<InboxPage />); await settle();
    fetchInbox.mockClear();
    await pickValue('#inbox-channel', 'email');
    await settle();
    expect(fetchInbox).toHaveBeenCalledWith(expect.objectContaining({ channel: 'email' }));
    fetchInbox.mockRejectedValue(new Error('down'));
    await pickValue('#inbox-channel', '');
    await settle();
    expect(text()).toContain('Couldn’t load the inbox');
    await act(async () => {});
  });
});

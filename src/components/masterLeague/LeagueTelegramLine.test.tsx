import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { setActiveLocale } from '@/lib/i18n';
import { LeagueTelegramLineView } from './LeagueTelegramLine';

const render = (props: Parameters<typeof LeagueTelegramLineView>[0], locale: 'en' | 'ru' = 'ru') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueTelegramLineView, props));
};

afterEach(() => setActiveLocale('en'));

describe('the Connect Telegram line', () => {
  it('says in one sentence what the student gets, with a connect button and a way out', () => {
    const html = render({ mode: 'offer' });
    expect(html).toContain('Личные заметки о прогрессе и напоминания об уроках и заданиях');
    expect(html).toContain('Подключить Telegram');
    expect(html).toContain('Не сейчас');
    expect(html).not.toContain('<a ');
  });

  it('speaks English to an English student', () => {
    const html = render({ mode: 'offer' }, 'en');
    expect(html).toContain('Personal progress notes and reminders about lessons and homework');
    expect(html).toContain('Connect Telegram');
    expect(html).toContain('Not now');
  });

  it('is a quiet row of the banner, never a dialog or an alert', () => {
    const html = render({ mode: 'offer' });
    expect(html).toContain('role="group"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('role="alertdialog"');
    expect(html).not.toContain('aria-modal');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('!');
  });

  it('while waiting, offers the t.me link as a real anchor that opens in a new tab and has no way to snooze', () => {
    const html = render({ mode: 'waiting', linkUrl: 'https://t.me/MasterEduBot?start=abc' });
    expect(html).toContain('<a href="https://t.me/MasterEduBot?start=abc"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Открыть Telegram');
    expect(html).toContain('Откройте Telegram и нажмите Start');
    expect(html).not.toContain('Не сейчас');
  });

  it('after a timeout, keeps the link and offers a new one', () => {
    const html = render({ mode: 'timed-out', linkUrl: 'https://t.me/MasterEduBot?start=abc' });
    expect(html).toContain('Открыть Telegram');
    expect(html).toContain('Подключить Telegram');
    expect(html).toContain('Не сейчас');
  });

  it('thanks the student without any button, as a status', () => {
    const html = render({ mode: 'thanks' });
    expect(html).toContain('Готово, Telegram подключён. Спасибо 💛');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<button');
  });

  it('disables connect while the link is being made, and says plainly when it failed', () => {
    expect(render({ mode: 'offer', busy: true })).toContain('disabled=""');
    const failed = render({ mode: 'offer', failed: true });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain('Не получилось');
  });
});

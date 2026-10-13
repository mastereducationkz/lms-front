import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await vi.importActual<typeof import('react')>('react');
  return { default: createContext(null), useAuth: () => ({ user: null }) };
});
vi.mock('@/services/api/client', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

import { setActiveLocale } from '@/lib/i18n';
import type { ResultConsent } from '@/services/api/masterLeague';
import { LeagueResultConsentView } from './LeagueResultConsent';

const consent = (over: Partial<ResultConsent> = {}): ResultConsent => ({
  state: 'ask', result_total: 1520, decision: null, can_answer: true, ...over,
});

const render = (c: ResultConsent, opts: { busy?: boolean; failed?: boolean } = {}, locale: 'en' | 'ru' = 'ru') => {
  setActiveLocale(locale);
  return renderToStaticMarkup(createElement(LeagueResultConsentView, { consent: c, ...opts }));
};

afterEach(() => setActiveLocale('en'));

describe('the result question', () => {
  it('names the score, asks plainly, and says what happens without an answer', () => {
    const html = render(consent());
    expect(html).toContain('Ваш результат записан: 1520');
    expect(html).toContain('Поздравить вас в группе Master League? Мы напишем только ваше имя и балл, и только если вы согласитесь.');
    expect(html).toContain('Да, поздравьте');
    expect(html).toContain('Нет, спасибо');
    expect(html).toContain('Если не ответите, в группе не появится ничего.');
  });

  it('gives yes and no the same weight in the markup order, with no default selected', () => {
    const html = render(consent());
    expect(html.indexOf('Да, поздравьте')).toBeLessThan(html.indexOf('Нет, спасибо'));
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('checked');
  });

  it('speaks English to an English student', () => {
    const html = render(consent(), {}, 'en');
    expect(html).toContain('Your result is recorded: 1520');
    expect(html).toContain('Yes, congratulate me');
    expect(html).toContain('No, thanks');
    expect(html).toContain('If you don’t answer, nothing is posted.');
  });

  it('cannot be double-clicked: both buttons are disabled while an answer is being saved', () => {
    const html = render(consent(), { busy: true });
    expect((html.match(/disabled=""/g) || []).length).toBe(2);
  });

  it('does not let a student answer once the season has closed', () => {
    const html = render(consent({ can_answer: false }));
    expect((html.match(/disabled=""/g) || []).length).toBe(2);
  });

  it('after yes, confirms and lets the student take it back; the answer is theirs to change', () => {
    const html = render(consent({ state: 'yes', decision: 'yes' }));
    expect(html).toContain('Договорились');
    expect(html).toContain('Передумали? Не публиковать');
    expect(html).not.toContain('Да, поздравьте');
  });

  it('after no, promises nothing will be posted and offers to change only on request', () => {
    const html = render(consent({ state: 'no', decision: 'no' }));
    expect(html).toContain('в чате группы ничего не появится');
    expect(html).toContain('Всё-таки поздравьте меня');
  });

  it('offers no change once the season is over or the line is posted', () => {
    expect(render(consent({ state: 'yes', decision: 'yes', can_answer: false }))).not.toContain('<button');
    expect(render(consent({ state: 'no', decision: 'no', can_answer: false }))).not.toContain('<button');
    const posted = render(consent({ state: 'posted', can_answer: false }));
    expect(posted).toContain('Поздравление уже в чате группы');
    expect(posted).not.toContain('<button');
  });

  it('says when an answer could not be saved', () => {
    const html = render(consent(), { failed: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Не получилось сохранить ответ');
  });

  it('never compares the student with anyone', () => {
    for (const state of ['ask', 'yes', 'no', 'posted'] as const) {
      const html = render(consent({ state }));
      for (const word of ['лучш', 'топ', 'рейтинг', 'место', 'best', 'rank', 'top ']) {
        expect(html.toLowerCase()).not.toContain(word);
      }
    }
  });
});

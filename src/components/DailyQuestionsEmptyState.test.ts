import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// useT() reads AuthContext, whose module pulls the API client in (localStorage at module scope).
// No provider here, so the hook falls back to activeLocale().
vi.mock('../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined) };
});

import { setActiveLocale } from '../lib/i18n';
import { DailyQuestionsEmptyState } from './DailyQuestionsEmptyState';

// Rendered with react-dom/server rather than mounted in a browser DOM: this repo's vitest
// runs in a plain Node environment (no jsdom/testing-library, see vite.config.js), and this
// component has no effects or context dependency to miss — a static HTML string is enough
// to prove the empty state, not the "Oops" error block, is what shows.

describe('DailyQuestionsEmptyState', () => {
  it('renders its heading and body, and no "Oops" text', () => {
    const html = renderToStaticMarkup(createElement(DailyQuestionsEmptyState, { onDismiss: () => {} }));
    expect(html).toContain('No daily questions yet');
    // React escapes the apostrophe in static markup (&#x27;), so match around it.
    expect(html).toContain('You haven');
    expect(html).toContain('t completed any Weekly Tests yet');
    expect(html).not.toContain('Oops');
    expect(html).not.toContain('Something went wrong');
  });

  it('renders a Close button', () => {
    const html = renderToStaticMarkup(createElement(DailyQuestionsEmptyState, { onDismiss: () => {} }));
    expect(html).toContain('Close');
  });

  afterEach(() => setActiveLocale('en'));

  it('speaks Russian to a user who chose it', () => {
    setActiveLocale('ru');
    const html = renderToStaticMarkup(createElement(DailyQuestionsEmptyState, { onDismiss: () => {} }));
    expect(html).toContain('Вопросов дня пока нет');
    expect(html).toContain('Закрыть');
  });
});

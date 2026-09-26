import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
});

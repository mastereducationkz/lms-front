import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SubmissionFileDownloadLink } from './SubmissionFileDownloadLink';
import { backendBase } from '../../lib/mediaUrl';

// Rendered with react-dom/server rather than mounted in a browser DOM: this repo's vitest
// runs in a plain Node environment (no jsdom/testing-library), and the component itself has
// no effects or Radix internals to miss — a static HTML string is enough to prove a hostile
// `fileUrl` produces no `<a href>` at all, which is the property this component exists for.
// This is the "tiny component" the grading page's raw href was extracted into so its safety
// can be tested without mounting the (much heavier) AssignmentGradingPage.

describe('SubmissionFileDownloadLink', () => {
  it('renders no link — not even an empty href — for a javascript: submission reference', () => {
    const html = renderToStaticMarkup(createElement(SubmissionFileDownloadLink, { fileUrl: 'javascript:alert(1)' }));
    expect(html).toBe('');
    expect(html).not.toContain('href');
  });

  it('renders no link for a chain of other hostile values', () => {
    for (const fileUrl of ['@evil.tld/x', '//evil.tld/x', 'data:text/html,<script>1</script>', null, undefined, '']) {
      const html = renderToStaticMarkup(createElement(SubmissionFileDownloadLink, { fileUrl }));
      expect(html).toBe('');
    }
  });

  it('renders a real download link for a safe upload path', () => {
    const html = renderToStaticMarkup(
      createElement(SubmissionFileDownloadLink, { fileUrl: '/uploads/submissions/a.pdf' }),
    );
    expect(html).toContain('<a ');
    expect(html).toContain(`href="${backendBase()}/uploads/submissions/a.pdf"`);
    expect(html).toContain('Download');
  });
});

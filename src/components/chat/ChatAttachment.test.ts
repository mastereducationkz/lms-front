import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatAttachment } from './ChatAttachment';
import { backendBase } from '../../lib/mediaUrl';

// Rendered with react-dom/server (see SubmissionFileDownloadLink.test.ts for why): this repo's
// vitest runs in a plain Node environment with no jsdom/testing-library. A rejected fileUrl
// takes ChatAttachment's earliest return — before it ever decides whether to open the Radix
// Dialog lightbox — so every case below is a plain static render with no portal involved.

const HOSTILE_URLS = [
  'javascript:alert(1)',
  'javascript:alert(1)//x.png', // an image-looking extension must not rescue a javascript: scheme
  '@evil.tld/x',
  '@evil.tld/x.png',
  '//evil.tld/x',
  'data:image/png;base64,AAAA',
  'https://evil.tld/a.png',
];

describe('ChatAttachment', () => {
  it('renders no <img> and no off-host <a> for a hostile fileUrl', () => {
    for (const fileUrl of HOSTILE_URLS) {
      const html = renderToStaticMarkup(createElement(ChatAttachment, { fileUrl }));
      expect(html).not.toContain('<img');
      expect(html).not.toContain('evil.tld');
      expect(html).not.toContain('javascript:');
      expect(html).toContain('Attachment unavailable');
    }
  });

  it('renders a real image preview for a safe upload path', () => {
    const html = renderToStaticMarkup(createElement(ChatAttachment, { fileUrl: '/uploads/message/photo.png' }));
    expect(html).toContain('<img');
    expect(html).toContain(`src="${backendBase()}/uploads/message/photo.png"`);
  });

  it('renders a real download link for a safe non-image upload path', () => {
    const html = renderToStaticMarkup(createElement(ChatAttachment, { fileUrl: '/uploads/message/notes.pdf' }));
    expect(html).toContain('<a ');
    expect(html).toContain(`href="${backendBase()}/uploads/message/notes.pdf"`);
  });
});

import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SharedMediaList, type SharedMediaItem } from './SharedMediaList';
import { backendBase } from '../../lib/mediaUrl';

// Rendered with react-dom/server (see ChatAttachment.test.ts for why): this repo's vitest
// runs in a plain Node environment with no jsdom/testing-library, and this component has
// no effects or Radix internals — a static HTML string is enough. `ChatInfoDialog` itself
// fetches shared media in a `useEffect` a headless render can't run, which is exactly why
// this grid/list was pulled out into its own component: it's the piece `ChatInfoDialog`'s
// safety actually rests on, and it's testable with `media` supplied directly.

function item(id: number, fileUrl: string): SharedMediaItem {
  return { id, file_url: fileUrl, from_user_id: 1, created_at: null };
}

describe('SharedMediaList', () => {
  it('renders a real <img> for a safe image', () => {
    const html = renderToStaticMarkup(
      createElement(SharedMediaList, { media: [item(1, '/uploads/message/photo.png')] }),
    );
    expect(html).toContain('<img');
    expect(html).toContain(`src="${backendBase()}/uploads/message/photo.png"`);
  });

  it('renders the same neutral tile for a hostile image reference — never an empty grid slot', () => {
    const html = renderToStaticMarkup(
      createElement(SharedMediaList, { media: [item(1, 'javascript:alert(1).png')] }),
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
    // Still one grid cell, just the neutral "unavailable" one, not nothing.
    expect(html).toContain('grid grid-cols-3');
  });

  it('renders a real link for a safe non-image file', () => {
    const html = renderToStaticMarkup(
      createElement(SharedMediaList, { media: [item(1, '/uploads/message/notes.pdf')] }),
    );
    expect(html).toContain('<a ');
    expect(html).toContain(`href="${backendBase()}/uploads/message/notes.pdf"`);
    expect(html).toContain('notes.pdf');
  });

  it('renders plain unlinked text for a hostile non-image file reference', () => {
    const html = renderToStaticMarkup(
      createElement(SharedMediaList, { media: [item(1, '@evil.tld/x.pdf')] }),
    );
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('evil.tld');
    expect(html).toContain('unavailable');
  });

  it('never throws on an unsafe percent-escape in the file name', () => {
    expect(() =>
      renderToStaticMarkup(createElement(SharedMediaList, { media: [item(1, '/uploads/message/50%.pdf')] })),
    ).not.toThrow();
  });
});

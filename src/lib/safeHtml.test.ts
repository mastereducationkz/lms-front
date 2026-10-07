// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { filterStyle, isAllowedEmbed, sanitizeHtml } from './safeHtml';
import { renderTextWithLatex } from '../utils/latex';
import { renderPreviewHtml } from '../components/announcements/telegramText';

/** What the browser itself makes of `html` through innerHTML — the "before" of a safe sample. */
function asBrowserParses(html: string): string {
  return new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}`, 'text/html').body.innerHTML;
}

/** Every element and attribute the sanitised markup would create. */
function parsed(html: string): Document {
  return new DOMParser().parseFromString(`<!DOCTYPE html><body>${sanitizeHtml(html)}`, 'text/html');
}

function hasHandlerOrScriptUrl(doc: Document): boolean {
  return Array.from(doc.body.querySelectorAll('*')).some((el) =>
    Array.from(el.attributes).some(
      (a) => /^on/i.test(a.name) || /^\s*(javascript|vbscript|data:text)/i.test(a.value),
    ),
  );
}

describe('sanitizeHtml neutralises attack payloads', () => {
  const payloads: Array<[string, string]> = [
    ['script tag', '<p>hi</p><script>alert(1)</script>'],
    ['img onerror', '<img src=x onerror=alert(1)>'],
    ['svg onload', '<svg onload=alert(1)><path d="M0 0"/></svg>'],
    ['body onload', '<body onload=alert(1)>x</body>'],
    ['javascript: href', '<a href="javascript:alert(1)">x</a>'],
    ['mixed-case scheme', '<a href="JaVaScRiPt:alert(1)">x</a>'],
    ['entity-encoded scheme', '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)">x</a>'],
    ['tab inside scheme', '<a href="java&#x09;script:alert(1)">x</a>'],
    ['leading space scheme', '<a href=" javascript:alert(1)">x</a>'],
    ['vbscript', '<a href="vbscript:msgbox(1)">x</a>'],
    ['data: link', '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>'],
    ['iframe javascript', '<iframe src="javascript:alert(1)"></iframe>'],
    ['iframe srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['object', '<object data="https://evil.example/x.swf"></object>'],
    ['embed', '<embed src="https://evil.example/x.swf">'],
    ['form + inputs', '<form action="https://evil.example"><input name="pw"><button formaction="javascript:alert(1)">go</button></form>'],
    ['style tag', '<style>body{display:none}</style><p>x</p>'],
    ['math mXSS', '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'],
    ['noscript mXSS', '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'],
    ['svg animate href', '<svg><a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a></svg>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.example">'],
    ['base href', '<base href="https://evil.example/">'],
    ['link stylesheet', '<link rel="stylesheet" href="https://evil.example/x.css">'],
  ];

  it.each(payloads)('%s', (_name, payload) => {
    const out = sanitizeHtml(payload);
    expect(out).not.toMatch(/<(script|style|object|embed|form|input|button|meta|base|link|animate)\b/i);
    expect(out).not.toMatch(/javascript:|vbscript:/i);
    expect(hasHandlerOrScriptUrl(parsed(payload))).toBe(false);
  });

  it('keeps an escaped script as visible text', () => {
    expect(sanitizeHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('runs after LaTeX + markdown rendering, so markup around a formula is still checked', () => {
    const out = sanitizeHtml(renderTextWithLatex('**bold** $x^2$ <img src=x onerror=alert(1)>'));
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('class="katex"');
    expect(out).not.toMatch(/onerror/i);
  });

  it('drops iframes that are not https on a known video player', () => {
    for (const src of [
      'https://evil.example/embed/x',
      'http://www.youtube.com/embed/x',
      'https://www.youtube.com.evil.example/embed/x',
      'https://user@www.youtube.com/embed/x',
      '//www.youtube.com/embed/x',
    ]) {
      expect(sanitizeHtml(`<p>a</p><iframe class="ql-video" src="${src}"></iframe>`)).toBe('<p>a</p>');
    }
  });

  it('only lets images load https, data:image or relative sources', () => {
    expect(sanitizeHtml('<img src="data:text/html,x">')).toBe('<img>');
    expect(sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')).toBe('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(sanitizeHtml('<img src="http://cdn.example/a.png">')).toBe('<img src="https://cdn.example/a.png">');
    expect(sanitizeHtml('<img src="javascript:alert(1)">')).toBe('<img>');
  });

  it('allows only http, https and mailto links, and isolates new tabs', () => {
    expect(sanitizeHtml('<a href="mailto:a@b.kz">m</a>')).toBe('<a href="mailto:a@b.kz">m</a>');
    expect(sanitizeHtml('<a href="tel:+7700">t</a>')).toBe('<a>t</a>');
    expect(sanitizeHtml('<a href="https://x.kz" target="_blank">x</a>')).toBe(
      '<a href="https://x.kz" target="_blank" rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeHtml('<a href="https://x.kz" target="_top">x</a>')).toBe('<a href="https://x.kz">x</a>');
  });

  it('strips CSS and classes that would let content cover the page', () => {
    const out = sanitizeHtml(
      '<div class="fixed inset-0 z-50 md:!absolute bg-card" style="position:fixed; z-index:9999; color: red; background:url(https://evil.example/x.png)">x</div>',
    );
    expect(out).toBe('<div class="bg-card" style="color: red">x</div>');
    expect(filterStyle('posit\\ion: fixed; color: red')).toBe('color: red');
    expect(filterStyle('position/**/: fixed')).toBe('');
    expect(filterStyle('position: relative; top: -0.2em;')).toBe('position: relative; top: -0.2em;');
  });

  // The embed / share URL each tool hands a teacher, one or more per allowed host.
  const embeds = [
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/embed/dQw4w9WgXcQ?start=30',
    'https://www.youtube-nocookie.com/embed/x',
    'https://player.vimeo.com/video/1',
    'https://drive.google.com/file/d/1AbC/preview',
    'https://docs.google.com/presentation/d/1AbC-d_E/embed?start=false&loop=false',
    'https://docs.google.com/presentation/d/e/2PACX-1vT/pub?start=false',
    'https://docs.google.com/forms/d/e/1FAIpQLSf/viewform?embedded=true',
    'https://docs.google.com/document/d/1AbC/preview',
    'https://docs.google.com/document/d/e/2PACX-1vR/pub?embedded=true',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vS/pubhtml?widget=true',
    'https://docs.google.com/a/mastereducation.kz/presentation/d/1AbC/embed',
    'https://www.desmos.com/calculator/abc123xyz?embed',
    'https://www.desmos.com/geometry/abc123',
    'https://www.geogebra.org/material/iframe/id/abcd1234/width/800/height/600',
    'https://www.geogebra.org/calculator/abcd1234?embed',
    'https://quizlet.com/123456789/flashcards/embed?i=1a2b3c&x=1jj1',
    'https://quizlet.com/ru/123456789/learn/embed',
    'https://wordwall.net/embed/0f1e2d3c4b5a?themeId=1&templateId=5',
    'https://wordwall.net/ru/embed/0f1e2d3c4b5a',
    'https://www.canva.com/design/DAFabc123/xYz-AbC/view?embed',
    'https://view.genial.ly/5f1e2d3c4b5a6978/interactive-content-quiz',
  ];

  it.each(embeds)('keeps a sandboxed embed from %s', (src) => {
    expect(isAllowedEmbed(src)).toBe(true);
    const frame = parsed(`<iframe src="${src.replace(/&/g, '&amp;')}" width="640" height="360"></iframe>`).querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(src);
    expect(frame?.getAttribute('sandbox')).toBe(
      'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox',
    );
  });

  it.each([
    // right host, wrong page: the editor or an arbitrary path
    'https://docs.google.com/presentation/d/1AbC/edit',
    'https://docs.google.com/document/d/1AbC/edit?usp=sharing',
    'https://docs.google.com/',
    'https://docs.google.com/uc?export=download&id=1',
    'https://www.desmos.com/',
    'https://www.geogebra.org/u/someone',
    'https://quizlet.com/123456789/flashcards',
    'https://wordwall.net/resource/0f1e2d3c',
    'https://www.canva.com/design/DAFabc123/edit',
    'https://view.genial.ly/',
    // look-alike hosts, other schemes, userinfo, ports
    'https://docs.google.com.evil.example/presentation/d/1/embed',
    'https://evil-docs.google.com.example/forms/d/e/1/viewform',
    'https://desmos.com.evil.example/calculator/1',
    'https://quizlet.evil.example/123/flashcards/embed',
    'http://docs.google.com/presentation/d/1/embed',
    'https://user@docs.google.com/presentation/d/1/embed',
    'https://www.desmos.com:8443/calculator/1',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '',
  ])('drops an iframe from %s', (src) => {
    expect(isAllowedEmbed(src)).toBe(false);
    expect(sanitizeHtml(`<p>a</p><iframe src="${src}"></iframe>`)).toBe('<p>a</p>');
  });

  it('treats a missing src as not embeddable', () => {
    expect(isAllowedEmbed(null)).toBe(false);
  });
});

describe('sanitizeHtml leaves legitimate content exactly as the browser would render it', () => {
  const samples: Array<[string, string]> = [
    ['inline KaTeX', renderTextWithLatex('Solve $x^2 + \\frac{1}{2} = \\sqrt{3}$ for $x \\neq 0$.')],
    ['display KaTeX', renderTextWithLatex('$$\\int_0^1 x\\,dx = \\frac{1}{2}$$')],
    ['KaTeX with SVG and arrays', renderTextWithLatex(
      '$\\overrightarrow{AB}$ $\\sqrt[3]{x}$ $\\underbrace{a+b}_{n}$ $\\cancel{x}$ $\\begin{array}{c|c} a & b \\\\ \\hline c & d \\end{array}$ $\\color{red}{y}$ $\\fbox{z}$',
    )],
    ['KaTeX error', renderTextWithLatex('$\\frac{1}{$')],
    ['markdown', renderTextWithLatex('**bold** _it_ ~~gone~~ `code` ___ blank')],
    ['quill paragraph, list and link',
      '<p class="ql-align-center">Hello <strong>bold</strong> <em>it</em> <u>u</u> <s>s</s> '
      + '<span style="color: rgb(230, 0, 0);">red</span> <span class="ql-size-large">big</span></p>'
      + '<ol><li>one</li><li class="ql-indent-1">two</li></ol><ul><li>b</li></ul>'
      + '<p><a href="https://example.com/x?a=1&amp;b=2" rel="noopener noreferrer" target="_blank">link</a></p>'
      + '<blockquote>q</blockquote><pre class="ql-syntax" spellcheck="false">x = 1\n</pre><h2>Title</h2><hr>'],
    ['table',
      '<table border="1" style="width: 100%;"><thead><tr><th colspan="2">Head</th></tr></thead>'
      + '<tbody><tr><td>1</td><td style="text-align: center;" rowspan="1">2</td></tr></tbody></table>'],
    ['image', '<p><img src="https://lmsapi.mastereducation.kz/uploads/q/1.png" alt="graph" width="300"></p>'],
    ['gap container', '<p>The cat <span id="gap-container-0" class="inline-flex align-baseline mx-0.5" style="display: inline-flex; vertical-align: baseline;"></span> sat.</p>'],
    ['quiz highlight',
      '<p>a <mark class="bg-amber-200 dark:bg-amber-700/60 text-inherit" style="padding: 0px; border-radius: 0px; cursor: pointer;" '
      + 'title="Click to remove highlight" data-highlight-text="foo" data-highlight-question-id="1">foo</mark> b</p>'],
    ['announcement preview', renderPreviewHtml('<b>Hi</b> <i>all</i> <tg-spoiler>secret</tg-spoiler> <a href="https://t.me/x">link</a>\n<code>5 < 10</code>')],
  ];

  it.each(samples)('%s', (_name, html) => {
    expect(sanitizeHtml(html)).toBe(asBrowserParses(html));
  });

  it('keeps a YouTube embed, adding only the sandbox and permission attributes', () => {
    const html = '<iframe class="ql-video" frameborder="0" allowfullscreen="true" src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    const doc = parsed(html);
    const frame = doc.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(frame.getAttribute('class')).toBe('ql-video');
    expect(frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(frame.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    for (const added of ['sandbox', 'allow', 'referrerpolicy']) frame.removeAttribute(added);
    expect(doc.body.innerHTML).toBe(asBrowserParses(html));
  });

  it('returns the same string for repeated input (cached) and handles empty values', () => {
    const html = renderTextWithLatex('$a+b$');
    expect(sanitizeHtml(html)).toBe(sanitizeHtml(html));
    expect(sanitizeHtml('')).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml(null)).toBe('');
  });
});

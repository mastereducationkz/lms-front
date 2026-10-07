// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { decodeMathEntities, escapeLtInMath, MATH_TEXT_MAX_LENGTH } from './mathText';
import { sanitizeHtml } from './safeHtml';
import { renderTextWithLatex } from '../utils/latex';

function body(html: string): HTMLElement {
  return new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}`, 'text/html').body;
}

/** What a student reads on the quiz page: KaTeX's visible output plus the text around it. */
function rendered(text: string) {
  const el = body(sanitizeHtml(renderTextWithLatex(text)));
  const tex = [...el.querySelectorAll('annotation')].map((a) => a.textContent);
  el.querySelectorAll('.katex-mathml').forEach((m) => m.remove());
  return { el, tex, text: el.textContent ?? '', errors: el.querySelectorAll('[style*="cc0000"], .katex-error').length };
}

// Real option / question texts from SAT quiz steps 6570, 3874, 6566 and 6541 (2026-10-07).
const PROD: Array<[string, string[], string[]]> = [
  ['$3<h≤4$', ['3<h≤4'], []],
  ['if $0<x<c$, then $2^x<2x+2$, but if $x>c$, then $2^x>2x+2$', ['0<x<c', '2^x<2x+2', 'x>c', '2^x>2x+2'], ['if ', ', then ', ', but if ']],
  ['If $-2<n<-1$, what is the value of $7+\\frac{1}{2}n$', ['-2<n<-1', '7+\\frac{1}{2}n'], ['If ', ', what is the value of ']],
  ['$x \\leq -2$ or $4<x$', ['x \\leq -2', '4<x'], [' or ']],
  ['$f(3)<f(0)<f(4)$', ['f(3)<f(0)<f(4)'], []],
];

describe('maths with a raw "<" renders in full', () => {
  // Titles use the case number: vitest reads "$0", "$3"… in a title as parameter references.
  it.each(PROD)('prod string %#', (text, formulas, words) => {
    const out = rendered(text);
    expect(out.tex).toEqual(formulas); // KaTeX received every formula, "<" included
    expect(out.errors).toBe(0);
    for (const word of words) expect(out.text).toContain(word);
  });

  it.each(PROD)('prod string %# keeps its whole text where maths is not typeset', (text) => {
    expect(body(sanitizeHtml(text)).textContent).toBe(text);
    expect(body(sanitizeHtml(`<p>${text}</p>`)).textContent).toBe(text);
  });

  it('inside the HTML react-quill stores, too', () => {
    const out = rendered('<p>If $-2<n<-1$, what is <strong>the value</strong> of $7+\\frac{1}{2}n$?</p>');
    expect(out.tex).toEqual(['-2<n<-1', '7+\\frac{1}{2}n']);
    expect(out.el.querySelector('strong')?.textContent).toBe('the value');
    expect(out.text).toContain('?');
  });

  it('a "<" the editor stored as &lt; reaches KaTeX as "<"', () => {
    const out = rendered('<p>$p &lt; 0.05$, $x &gt; 2$ and $\\begin{array}{cc} a &amp; b \\end{array}$</p>');
    expect(out.tex).toEqual(['p < 0.05', 'x > 2', '\\begin{array}{cc} a & b \\end{array}']);
    expect(out.errors).toBe(0);
  });
});

describe('markup outside (and around) maths is untouched', () => {
  it('a formula next to <strong>', () => {
    const out = rendered('$a<b$ <strong>x</strong>');
    expect(out.tex).toEqual(['a<b']);
    expect(out.el.querySelector('strong')?.textContent).toBe('x');
    expect(sanitizeHtml('$a<b$ <strong>x</strong>')).toBe('$a&lt;b$ <strong>x</strong>');
  });

  it.each([
    '<p><strong>Bold</strong>, <em>italic</em> and <a href="https://x.kz" target="_blank" rel="noopener noreferrer">a link</a></p>',
    'Pay $5 <strong>now</strong> or $10 later',
    '<p>$5 apples</p><p>cost <u>$10</u></p>',
    '<ul><li class="ql-indent-1">$x$ <span style="color: rgb(230, 0, 0);">red</span></li></ul>',
    '$a <!-- note --> b$',
  ])('markup case %#', (html) => {
    expect(escapeLtInMath(html)).toBe(html);
  });
});

describe('escapeLtInMath', () => {
  it.each([
    ['$0<x<c$', '$0&lt;x&lt;c$'],
    ['$$a<b$$', '$$a&lt;b$$'],
    ['\\(a<b\\)', '\\(a&lt;b\\)'],
    ['\\[a<b\\]', '\\[a&lt;b\\]'],
    ['a<b and $c<d$', 'a<b and $c&lt;d$'],
    ['\\$5 <x and $y<z$', '\\$5 <x and $y&lt;z$'],
    ['$a<b', '$a<b'],
    ['$a<b \\$ c<d$', '$a&lt;b \\$ c&lt;d$'],
  ])('case %#', (input, expected) => {
    expect(escapeLtInMath(input)).toBe(expected);
  });

  it('decodes back to what was typed (entities decoded once, &amp; last)', () => {
    expect(decodeMathEntities(escapeLtInMath('$0<x<c$'))).toBe('$0<x<c$');
    expect(decodeMathEntities('a &amp;lt; b')).toBe('a &lt; b');
  });

  it('leaves text over the length cap alone', () => {
    const long = `$a<b$${' '.repeat(MATH_TEXT_MAX_LENGTH)}`;
    expect(escapeLtInMath(long)).toBe(long);
  });

  it('stays linear on hostile input (no ReDoS)', () => {
    const n = 300_000;
    const hostile = [
      `$${'<a '.repeat(n)}$`,
      `$${'<'.repeat(n)}$`,
      `$<a${' '.repeat(n)}$`,
      '$<x'.repeat(n),
      `${'\\('.repeat(n)}<`,
      `${'$a'.repeat(n)}<b`,
      `$${'a'.repeat(n)}<b`,
      `${'$$'.repeat(n)}<`,
    ];
    for (const input of hostile) {
      const started = performance.now();
      escapeLtInMath(input);
      // A linear pass takes milliseconds here; a quadratic one would take minutes.
      expect(performance.now() - started).toBeLessThan(1500);
    }
  });
});

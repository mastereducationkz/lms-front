// @vitest-environment jsdom
// The shapes the prod content probe found in lesson steps (2026-10-07: 999 steps, 641 with HTML,
// no iframes): p, strong, br, span, li, em, b, ul, u, a, ol; style with color / background-color
// only; classes ql-indent-1, ql-align-center, ql-size-large, ql-cursor; links with rel + target to
// the LMS, the API host, Google Calendar and Desmos. Every one must come through sanitizeHtml
// exactly as the browser renders it today.
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './safeHtml';
import { renderTextWithLatex } from '../utils/latex';

function asBrowserParses(html: string): string {
  return new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}`, 'text/html').body.innerHTML;
}

function visibleText(html: string): string {
  return new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}`, 'text/html').body.textContent ?? '';
}

const STEP = [
  '<p class="ql-align-center"><strong>Lesson 3: Linear inequalities</strong></p>',
  '<p><span style="color: rgb(230, 0, 0);">Read carefully:</span> the answer is <strong style="color: rgb(0, 102, 204);">not</strong> ',
  '<em style="background-color: rgb(255, 255, 0);">always</em> <u style="color: rgb(0, 138, 0); background-color: rgb(204, 232, 204);">positive</u>',
  ' <b>here</b>.<br></p>',
  '<p><span class="ql-size-large">Big heading text</span><span class="ql-cursor">﻿</span></p>',
  '<ol><li>Isolate the variable.</li><li class="ql-indent-1">Undo the addition first.</li><li>Divide both sides.</li></ol>',
  '<ul><li><span style="background-color: rgb(255, 235, 204);">Check by substitution</span></li><li class="ql-indent-1">Flip the sign when dividing by a negative.</li></ul>',
  '<p>Recording: <a href="https://lms.mastereducation.kz/course/12/lesson/345?step=2" rel="noopener noreferrer" target="_blank">open the lesson</a>, ',
  'worksheet <a href="https://lmsapi.mastereducation.kz/uploads/materials/sheet%201.pdf" rel="noopener noreferrer" target="_blank">PDF</a>, ',
  'office hours <a href="https://calendar.google.com/calendar/u/0/r/eventedit?text=Office+hours&amp;dates=20261010T100000Z/20261010T110000Z" rel="noopener noreferrer" target="_blank">add to calendar</a>, ',
  'graph it on <a href="https://www.desmos.com/calculator/abc123xyz" rel="noopener noreferrer" target="_blank">Desmos</a> or ',
  '<a href="https://desmos.com/calculator" rel="noopener noreferrer" target="_blank">desmos.com</a>.</p>',
].join('');

describe('prod lesson-step shapes survive sanitizeHtml unchanged', () => {
  it('a step using every tag, style, class and link shape the probe found', () => {
    expect(sanitizeHtml(STEP)).toBe(asBrowserParses(STEP));
  });

  it('the same step after markdown + LaTeX rendering (how LessonPage shows it)', () => {
    const rendered = renderTextWithLatex(STEP);
    expect(sanitizeHtml(rendered)).toBe(asBrowserParses(rendered));
  });

  it.each([
    ['color', '<span style="color: rgb(230, 0, 0);">x</span>'],
    ['background-color', '<span style="background-color: rgb(255, 255, 0);">x</span>'],
    ['both on strong', '<strong style="color: rgb(0, 0, 0); background-color: rgb(255, 255, 255);">x</strong>'],
    ['ql-indent-1', '<ul><li class="ql-indent-1">x</li></ul>'],
    ['ql-align-center', '<p class="ql-align-center">x</p>'],
    ['ql-size-large', '<p><span class="ql-size-large">x</span></p>'],
    ['ql-cursor', '<p><span class="ql-cursor">﻿</span>x</p>'],
    ['link with rel + target', '<a href="https://lms.mastereducation.kz/" rel="noopener noreferrer" target="_blank">x</a>'],
  ])('%s', (_name, html) => {
    expect(sanitizeHtml(html)).toBe(asBrowserParses(html));
  });
});

describe('raw math that HTML reads as a fake tag', () => {
  // Two prod steps contain text like "$2^x<2x+2$ … x<c$, then": the "<c$," starts a made-up
  // element. The browser shows that element's text today; the sanitiser drops the made-up tag
  // but keeps its text, so the reader sees no less than before.
  const samples = [
    '<p>If $2^x<2x+2$ holds for every x<c$, then what is the greatest possible value of c?</p>',
    '<p>For $x<c$, then $2^x<2x+2$ … x<c$, then the answer is 3.</p>',
  ];

  it.each(samples)('%s', (text) => {
    const rendered = renderTextWithLatex(text);
    const today = asBrowserParses(rendered);
    const after = sanitizeHtml(rendered);
    expect(visibleText(after)).toBe(visibleText(today));
    expect(after).not.toMatch(/<c\$/);
  });
});

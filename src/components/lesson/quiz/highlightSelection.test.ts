// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { HIGHLIGHTABLE_ATTR, highlightQuestionOf } from './highlightSelection';

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

const rangeOver = (startEl: Element, endEl: Element = startEl) => {
  const range = document.createRange();
  range.setStart(startEl.firstChild!, 0);
  range.setEnd(endEl.firstChild!, (endEl.firstChild as Text).length);
  return range;
};

describe('which question a selection may highlight in', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('names the question whose block holds the whole selection', () => {
    mount(`<div ${HIGHLIGHTABLE_ATTR}="7"><p id="a">Researchers found</p><p id="b">that bees</p></div>`);
    expect(highlightQuestionOf(rangeOver(document.getElementById('a')!, document.getElementById('b')!))).toBe('7');
  });

  it('refuses a selection that spans two questions or starts outside one', () => {
    mount(`<p id="o">outside</p><div ${HIGHLIGHTABLE_ATTR}="1"><p id="a">one</p></div><div ${HIGHLIGHTABLE_ATTR}="2"><p id="b">two</p></div>`);
    expect(highlightQuestionOf(rangeOver(document.getElementById('a')!, document.getElementById('b')!))).toBeNull();
    expect(highlightQuestionOf(rangeOver(document.getElementById('o')!, document.getElementById('a')!))).toBeNull();
    expect(highlightQuestionOf(rangeOver(document.getElementById('o')!))).toBeNull();
  });

  it('ignores text selected inside the colour palette itself', () => {
    mount(`<div ${HIGHLIGHTABLE_ATTR}="3"><div data-highlight-palette="true"><span id="p">yellow</span></div></div>`);
    expect(highlightQuestionOf(rangeOver(document.getElementById('p')!))).toBeNull();
  });
});

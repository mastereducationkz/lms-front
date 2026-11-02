// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { anchorForQuote, anchorFromRange, blockText, rangeFromOffsets, resolveAnchor } from './anchor';

const block = (html: string) => {
  document.body.innerHTML = `<div id="b">${html}</div>`;
  return document.getElementById('b')!;
};
const textRange = (node: Node, from: number, to: number) => {
  const r = document.createRange();
  r.setStart(node, from);
  r.setEnd(node, to);
  return r;
};

describe('anchoring a highlight', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it('stores offsets, quote and context, across inline tags', () => {
    const b = block('<p>The <b>Svalbard</b> vault opened in 2008.</p>');
    const svalbard = b.querySelector('b')!.firstChild!;
    const tail = b.querySelector('p')!.lastChild!;
    const r = document.createRange();
    r.setStart(svalbard, 0);
    r.setEnd(tail, 6);
    const a = anchorFromRange(b, r);
    expect(a).toEqual({ start: 4, end: 18, quote: 'Svalbard vault', prefix: 'The ', suffix: ' opened in 2008.' });
  });

  it('trims the whitespace a drag picks up at the edges', () => {
    const b = block('<p>one  two  three</p>');
    const a = anchorFromRange(b, textRange(b.querySelector('p')!.firstChild!, 3, 10));
    expect(a?.quote).toBe('two');
  });

  it('leaves dropdown and button labels out of the text, so answering never shifts offsets', () => {
    const b = block('<p>Bees <button>choose</button> pollinate <span role="combobox">picked</span> flowers.</p>');
    expect(blockText(b)).toBe('Bees  pollinate  flowers.');
    const flowers = b.querySelector('p')!.lastChild!;
    expect(anchorFromRange(b, textRange(flowers, 1, 8))).toMatchObject({ quote: 'flowers', start: 17 });
  });

  it('refuses a selection that leaves the block', () => {
    document.body.innerHTML = '<div id="b"><p>inside</p></div><p id="o">outside</p>';
    const b = document.getElementById('b')!;
    const r = document.createRange();
    r.setStart(b.querySelector('p')!.firstChild!, 0);
    r.setEnd(document.getElementById('o')!.firstChild!, 3);
    expect(anchorFromRange(b, r)).toBeNull();
  });

  it('maps offsets back to a DOM range', () => {
    const b = block('<p>The <b>Svalbard</b> vault</p>');
    expect(rangeFromOffsets(b, 4, 14)?.toString()).toBe('Svalbard v');
    expect(rangeFromOffsets(b, 4, 99)).toBeNull();
  });
});

describe('finding a highlight again after the text changed', () => {
  const anchor = { start: 10, end: 15, quote: 'seeds', prefix: 'keeps the ', suffix: ' frozen' };

  it('keeps the stored offsets when the text there still matches', () => {
    expect(resolveAnchor('keeps the seeds frozen', anchor)).toEqual({ start: 10, end: 15 });
  });

  it('follows the quote when a teacher edits the text before it', () => {
    expect(resolveAnchor('It still keeps the seeds frozen', anchor)).toEqual({ start: 19, end: 24 });
  });

  it('picks the occurrence whose context matches, not the first one', () => {
    const text = 'Some seeds arrive; the vault keeps the seeds frozen.';
    expect(resolveAnchor(text, anchor)).toEqual({ start: 39, end: 44 });
  });

  it('is an orphan once the quote is gone', () => {
    expect(resolveAnchor('keeps the samples frozen', anchor)).toBeNull();
  });

  it('turns an old text-matched highlight into an anchor', () => {
    const b = block('<p>The vault keeps\n the seeds frozen.</p>');
    expect(anchorForQuote(b, 'keeps the seeds')).toMatchObject({ quote: 'keeps\n the seeds', start: 10 });
    expect(anchorForQuote(b, 'missing')).toBeNull();
  });
});

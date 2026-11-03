import { describe, expect, it } from 'vitest';
import { parseBlocks } from './RichText';

describe('parseBlocks', () => {
  it('splits paragraphs on blank lines and joins wrapped lines', () => {
    expect(parseBlocks('One\ntwo\n\nThree')).toEqual([{ type: 'p', text: 'One two' }, { type: 'p', text: 'Three' }]);
  });

  it('groups bullet and numbered lines into lists', () => {
    expect(parseBlocks('Do this:\n- first\n- second\n\n1. open\n2) save')).toEqual([
      { type: 'p', text: 'Do this:' },
      { type: 'ul', items: ['first', 'second'] },
      { type: 'ol', items: ['open', 'save'] },
    ]);
  });

  it('leaves guillemets and anything HTML-looking as plain text', () => {
    expect(parseBlocks('Press «Save» <b>now</b>')).toEqual([{ type: 'p', text: 'Press «Save» <b>now</b>' }]);
  });
});

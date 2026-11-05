// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { paintErrorTab, paintLoadingTab, tabContent, type TabStrings } from './loadingTab';

const strings: TabStrings = {
  pageTitle: 'Opening · Master', heading: 'Opening <the> copy', hint: 'Try "anything" & see', errorHeading: 'Could not open',
  errorHint: 'Close this tab', closeLabel: 'Close',
};
const blank = () => document.implementation.createHTMLDocument('');

describe('the loading tab', () => {
  it('shows logo, spinner, heading and hint, as text only', () => {
    const doc = blank();
    const main = tabContent(doc, 'loading', strings, '/logo.svg');
    expect(main.querySelector('img')?.getAttribute('src')).toBe('/logo.svg');
    expect(main.querySelector('.spin')).not.toBeNull();
    expect(main.querySelector('h1')?.textContent).toBe('Opening <the> copy');
    expect(main.querySelector('p')?.textContent).toBe('Try "anything" & see');
    expect(main.querySelector('the')).toBeNull();
    expect(main.getAttribute('role')).toBe('status');
  });

  it('shows the failure with a close button and no spinner', () => {
    const main = tabContent(blank(), 'error', strings);
    expect(main.getAttribute('role')).toBe('alert');
    expect(main.querySelector('#close-tab')?.textContent).toBe('Close');
    expect(main.querySelector('.spin')).toBeNull();
  });

  it('paints a blank document: title, styles, content; the close button closes the tab', () => {
    const doc = blank();
    let closed = 0;
    const win = { document: doc, close: () => { closed += 1; } } as unknown as Window;
    expect(paintLoadingTab(win, strings)).toBe(true);
    expect(doc.title).toBe('Opening · Master');
    expect(doc.head.querySelector('style')).not.toBeNull();
    expect(doc.body.querySelector('.spin')).not.toBeNull();
    expect(paintErrorTab(win, strings)).toBe(true);
    expect(doc.body.querySelector('.spin')).toBeNull();
    (doc.getElementById('close-tab') as HTMLButtonElement).click();
    expect(closed).toBe(1);
  });

  it('gives up quietly on a tab it cannot write to', () => {
    const win = { get document(): Document { throw new Error('cross-origin'); } } as unknown as Window;
    expect(paintLoadingTab(win, strings)).toBe(false);
  });
});

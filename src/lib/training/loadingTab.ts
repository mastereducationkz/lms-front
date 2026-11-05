/**
 * The loading screen of the tab «Open the training copy» opens (staff training).
 *
 * The click opens an empty tab at once (a tab opened after the server's wait is blocked by browsers) and the link is put
 * into it when it arrives. Until then the tab used to show a bare «Opening…»: now it shows the same screen the copy
 * itself shows while it signs the person in (centred logo, spinner, a title and a one-line hint), with a title in the
 * tab, and an error state when the link could not be made. The tab is an about:blank document of this origin, so it is
 * painted with plain DOM calls (no React, no bundle, no innerHTML: text goes in as text), styles are inline.
 */

export interface TabStrings {
  /** The tab's title while it loads. */
  pageTitle: string;
  heading: string;
  hint: string;
  /** The error state. */
  errorHeading: string;
  errorHint: string;
  closeLabel: string;
}

const STYLE = `
  html,body{height:100%;margin:0}
  body{display:flex;align-items:center;justify-content:center;background:#fff;color:#0f172a;font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;text-align:center}
  main{max-width:26rem;padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:.75rem}
  img{height:3rem;width:auto;margin-bottom:.5rem}
  .spin{width:2rem;height:2rem;border-radius:9999px;border:2px solid #2563eb;border-top-color:transparent;animation:s 0.8s linear infinite}
  h1{font-size:1.05rem;font-weight:600;margin:.25rem 0 0}
  p{font-size:.85rem;line-height:1.45;color:#64748b;margin:0}
  p.err{color:#b91c1c}
  button{margin-top:.5rem;font:inherit;font-size:.875rem;font-weight:500;color:#fff;background:#2563eb;border:0;border-radius:.5rem;padding:.55rem 1.1rem;cursor:pointer}
  @keyframes s{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.spin{animation-duration:2.4s}}
  @media (prefers-color-scheme:dark){body{background:#0b1220;color:#e2e8f0}p{color:#94a3b8}p.err{color:#fca5a5}}
`;

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The loading or the error state as DOM nodes of `doc` (pure: tested). */
export function tabContent(doc: Document, state: 'loading' | 'error', s: TabStrings, logoUrl = '/logo.svg'): HTMLElement {
  const main = el(doc, 'main', state === 'error' ? { role: 'alert' } : { role: 'status', 'aria-live': 'polite' });
  main.append(el(doc, 'img', { src: logoUrl, alt: '' }));
  if (state === 'error') {
    const close = el(doc, 'button', { type: 'button', id: 'close-tab' }, s.closeLabel);
    main.append(el(doc, 'h1', {}, s.errorHeading), el(doc, 'p', { class: 'err' }, s.errorHint), close);
  } else {
    main.append(el(doc, 'div', { class: 'spin', 'aria-hidden': 'true' }), el(doc, 'h1', {}, s.heading), el(doc, 'p', {}, s.hint));
  }
  return main;
}

function paint(win: Window, state: 'loading' | 'error', s: TabStrings): boolean {
  try {
    const doc = win.document;
    doc.title = s.pageTitle;
    const style = el(doc, 'style', {}, STYLE);
    doc.head.replaceChildren(el(doc, 'meta', { charset: 'utf-8' }), el(doc, 'meta', { name: 'viewport', content: 'width=device-width,initial-scale=1' }), style);
    // doc.title above created a <title>; head.replaceChildren dropped it, so set it again.
    doc.title = s.pageTitle;
    const main = tabContent(doc, state, s, `${window.location.origin}/logo.svg`);
    doc.body.replaceChildren(main);
    if (state === 'error') main.querySelector('#close-tab')?.addEventListener('click', () => win.close());
    return true;
  } catch {
    return false; // a blank tab we cannot write to is still a tab
  }
}

export const paintLoadingTab = (win: Window, s: TabStrings) => paint(win, 'loading', s);
export const paintErrorTab = (win: Window, s: TabStrings) => paint(win, 'error', s);

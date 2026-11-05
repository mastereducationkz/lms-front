// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../../services/api/classMaterials', () => ({ apiErrorCode: () => null }));

import LinkDialog from './LinkDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
const onSubmit = vi.fn(async () => undefined);
async function open() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(<LinkDialog open onOpenChange={() => undefined} locale="en" onSubmit={onSubmit} />); });
}
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
  onSubmit.mockClear();
});

const urlInput = () => document.getElementById('class-material-link-url') as HTMLInputElement;
const alerts = () => document.body.textContent ?? '';
const BAD = 'The link must start with http:// or https://';
const type = async (value: string) => act(async () => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  set.call(urlInput(), value);
  urlInput().dispatchEvent(new Event('input', { bubbles: true }));
});
const blur = () => act(async () => { urlInput().dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });

describe('the «Link» dialog', () => {
  it('says nothing before anyone types, and not when focus leaves the empty field', async () => {
    await open();
    expect(alerts()).not.toContain(BAD);
    await blur();
    expect(alerts()).not.toContain(BAD);
  });

  it('flags a typed address that is not http(s) once focus leaves, and clears it as they fix it', async () => {
    await open();
    await type('example.com');
    expect(alerts()).not.toContain(BAD);            // still typing
    await blur();
    expect(alerts()).toContain(BAD);
    await type('https://example.com');
    expect(alerts()).not.toContain(BAD);
  });

  it('flags it on submit too, and does not send it', async () => {
    await open();
    await type('ftp://x');
    const save = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save')!;
    await act(async () => { save.click(); });
    expect(alerts()).toContain(BAD);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('sends a good address', async () => {
    await open();
    await type('https://example.com/a');
    const save = Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Save')!;
    await act(async () => { save.click(); });
    expect(onSubmit).toHaveBeenCalledWith({ url: 'https://example.com/a', title: undefined });
  });
});

// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { default: createContext(undefined), useAuth: () => ({ user: null }) };
});

import { ProofDropzone } from './ProofDropzone';
import { PROOF_MAX_BYTES, proofProblem } from './proofFile';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let created: string[] = [];
let revoked: string[] = [];
beforeEach(() => {
  created = []; revoked = [];
  URL.createObjectURL = vi.fn(() => { const u = `blob:test/${created.length}`; created.push(u); return u; });
  URL.revokeObjectURL = vi.fn((u: string) => { revoked.push(u); });
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = null;
  document.body.innerHTML = '';
});

const fileOf = (name: string, type: string, size = 100) => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

async function mount(initial: File | null = null) {
  const onChange = vi.fn();
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  const render = async (file: File | null) => {
    await act(async () => { root!.render(<ProofDropzone file={file} onChange={onChange} inputId="pz" />); });
  };
  await render(initial);
  return { onChange, render };
}
const input = () => document.getElementById('pz') as HTMLInputElement;
async function choose(f: File) {
  await act(async () => {
    Object.defineProperty(input(), 'files', { value: [f], configurable: true });
    input().dispatchEvent(new Event('change', { bubbles: true }));
  });
}
async function drop(f: File) {
  const zone = document.querySelector('[data-testid="proof-dropzone"]')!;
  const ev = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: { files: [f] } });
  await act(async () => { zone.dispatchEvent(ev); });
}

describe('proofProblem', () => {
  it('mirrors the server: five types, 10 MB, not empty', () => {
    expect(proofProblem(fileOf('a.pdf', 'application/pdf'))).toBeNull();
    expect(proofProblem(fileOf('a.jpg', 'image/jpeg'))).toBeNull();
    expect(proofProblem(fileOf('a.webp', '', 5))).toBeNull(); // no browser type: the extension names it
    expect(proofProblem(fileOf('a.heic', 'image/heic'))).toBe('type');
    expect(proofProblem(fileOf('a.docx', 'application/msword'))).toBe('type');
    expect(proofProblem(fileOf('a.png', 'image/png', 0))).toBe('empty');
    expect(proofProblem(fileOf('a.png', 'image/png', PROOF_MAX_BYTES))).toBeNull();
    expect(proofProblem(fileOf('a.png', 'image/png', PROOF_MAX_BYTES + 1))).toBe('size');
  });
});

describe('ProofDropzone', () => {
  it('rejects a wrong type with a reason and keeps the previous choice', async () => {
    const { onChange } = await mount();
    await choose(fileOf('doc.docx', 'application/msword'));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toMatch(/JPEG, PNG, GIF, WEBP|PDF/);
  });

  it('rejects an oversized file, also when dropped', async () => {
    const { onChange } = await mount();
    await drop(fileOf('big.png', 'image/png', PROOF_MAX_BYTES + 1));
    expect(onChange).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('accepts a dropped image and previews it through an object URL that is revoked on unmount', async () => {
    const f = fileOf('score.png', 'image/png');
    const { onChange, render } = await mount();
    await drop(f);
    expect(onChange).toHaveBeenCalledWith(f);
    await render(f);
    const img = document.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(created[0]);
    await act(async () => { root!.unmount(); });
    root = null;
    expect(revoked).toContain(created[0]);
  });

  it('shows a PDF as a file card with an optional inline preview', async () => {
    const { render } = await mount();
    await render(fileOf('report.pdf', 'application/pdf', 2048));
    expect(document.body.textContent).toContain('report.pdf');
    expect(document.body.textContent).toContain('2 KB');
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    const toggle = Array.from(document.querySelectorAll('button')).find((b) => /Просмотр|Preview/.test(b.textContent ?? ''))!;
    await act(async () => { toggle.click(); });
    expect(document.querySelector('iframe')?.getAttribute('src')).toBe(created[0]);
  });

  it('removes the file', async () => {
    const { onChange, render } = await mount();
    await render(fileOf('a.png', 'image/png'));
    const remove = document.querySelector('button[title]') as HTMLButtonElement;
    await act(async () => { remove.click(); });
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

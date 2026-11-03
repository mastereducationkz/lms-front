// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logoBox, qrMatrix, qrSvg } from './qr';

const URL_TEXT = 'https://lms.mastereducation.kz/t/SCHOOL';

afterEach(() => { vi.unstubAllGlobals(); });

describe('the trial link QR code', () => {
  it('uses error correction H, and the logo plate stays inside what H recovers', () => {
    const m = qrMatrix(URL_TEXT);
    const box = logoBox(m.size);
    const side = box.end - box.start;
    expect(side * side / (m.size * m.size)).toBeLessThan(0.07);      // ≈5 % of the modules; H recovers up to 30 %
    expect(box.start).toBeGreaterThan(7);                            // never touches the finder patterns
    expect(box.start + box.end).toBe(m.size);                        // centred
  });

  it('draws the logo on a white plate and leaves the modules under it empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => '<?xml version="1.0"?><svg width="150pt" height="150pt" viewBox="0 0 150 150"><path d="M0 0h1"/></svg>' })));
    const svg = await qrSvg(URL_TEXT, 512);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"')).toBe(true);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('viewBox="0 0 150 150"');                // the logo is nested
    expect(svg).not.toContain('150pt');
    expect(svg).not.toContain('<?xml');
  });

  it('still makes a code when the logo cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const svg = await qrSvg(URL_TEXT, 256);
    expect(svg).toContain('<path fill="#000"');
  });
});

/**
 * The QR code of a trial link, for the presentation deck and print (owner, 2026-11-03): error correction H (30 %), so
 * the small Master Education logo in the centre can cover modules and the code still scans from the back of a classroom.
 *
 * Both files are drawn from the same module matrix: an SVG (sharp at any size, for the slides) and a PNG (for anything
 * that wants pixels). The logo sits on a white rounded plate with the modules under it cleared, never painted over.
 */
import QRCode from 'qrcode';

/** Served from `public/` (Vite copies it as is). */
const LOGO_URL = '/logo.svg';
/** Quiet zone in modules: the standard asks for 4. */
const MARGIN = 4;
/** The logo plate's side as a share of the code (without the margin). 22 % stays well inside what H recovers. */
const LOGO_SHARE = 0.22;

export interface QrMatrix {
  size: number;
  isDark: (x: number, y: number) => boolean;
}

export function qrMatrix(text: string): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const { size, data } = qr.modules;
  return { size, isDark: (x, y) => Boolean(data[y * size + x]) };
}

/** The modules hidden under the logo plate (in module units, centred, odd-sized so it is symmetric). */
export function logoBox(size: number): { start: number; end: number } {
  let side = Math.round(size * LOGO_SHARE);
  if (side % 2 !== size % 2) side += 1;
  const start = (size - side) / 2;
  return { start, end: start + side };
}

function covered(x: number, y: number, box: { start: number; end: number }) {
  return x >= box.start && x < box.end && y >= box.start && y < box.end;
}

let logoText: Promise<string> | null = null;
function loadLogoSvg(): Promise<string> {
  logoText ??= fetch(LOGO_URL).then((r) => (r.ok ? r.text() : Promise.reject(new Error('logo'))))
    .catch((error) => { logoText = null; throw error; });
  return logoText;
}

/** The logo's markup without the XML prologue and DOCTYPE, to nest inside another SVG. */
function innerSvg(svg: string): string {
  return svg.replace(/<\?xml[^>]*>/, '').replace(/<!DOCTYPE[^>]*>/, '').trim();
}

/** The whole picture as SVG text, `px` wide (the viewBox is in modules). */
export async function qrSvg(text: string, px = 1024): Promise<string> {
  const m = qrMatrix(text);
  const box = logoBox(m.size);
  const full = m.size + MARGIN * 2;
  const rects: string[] = [];
  for (let y = 0; y < m.size; y += 1) {
    for (let x = 0; x < m.size; x += 1) {
      if (m.isDark(x, y) && !covered(x, y, box)) rects.push(`M${x + MARGIN} ${y + MARGIN}h1v1h-1z`);
    }
  }
  const side = box.end - box.start;
  const pad = side * 0.12;
  const plate = `<rect x="${box.start + MARGIN}" y="${box.start + MARGIN}" width="${side}" height="${side}" rx="${side * 0.18}" fill="#fff"/>`;
  let logo = '';
  try {
    const raw = innerSvg(await loadLogoSvg())
      .replace(/<svg\b/, `<svg x="${box.start + MARGIN + pad}" y="${box.start + MARGIN + pad}" width="${side - pad * 2}" height="${side - pad * 2}"`)
      .replace(/\s(width|height)="[\d.]+pt"/g, '');
    logo = raw;
  } catch {
    /* no logo file reachable: the plate stays white, the code still scans */
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges">`
    + `<rect width="${full}" height="${full}" fill="#fff"/><path fill="#000" d="${rects.join('')}"/>${plate}${logo}</svg>`;
}

/** A PNG of the same picture (`px` square). */
export async function qrPng(text: string, px = 2048): Promise<Blob> {
  const svg = await qrSvg(text, px);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('qr image'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, px, px);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

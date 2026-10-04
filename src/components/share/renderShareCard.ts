/**
 * Draws the 1080×1920 «Share achievement» story card on the student's device (SH2, SH7).
 *
 * Text is set with canvas fillText in the page's own Inter webfont; the orca, the emblem pattern
 * and the crown are SVG drawn as images — the exact art the student sees in the LMS, no server
 * renderer to keep in sync. Instagram / Snapchat / WhatsApp cover the top and bottom ~250 px with
 * their own UI, so nothing that matters sits there.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Orca from '@/components/mascot/Orca';
import { MasterMark } from '@/components/mascot/art/MasterMark';
import { FRAME_PAD } from '@/components/mascot/art/frames';
import type { MascotConfig } from '@/components/mascot/config';
import type { CardAccent, CardText } from './shareCopy';

export const CARD_W = 1080;
export const CARD_H = 1920;
const FONT = 'Inter, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface CardSpec {
  text: CardText;
  name: string | null;
  orca: MascotConfig;
  /** «Kasatik of the lesson»: a gold crown on the orca. */
  crown?: boolean;
}

interface Palette {
  bg: [number, string][];
  glow: string;
  sparkle: string;
  pillFill: CanvasFillStrokeStyles['fillStyle'] | null;
  pillText: string;
  pillStroke: string | null;
  gold: boolean;
}

function palette(ctx: CanvasRenderingContext2D, accent: CardAccent, pill: { x: number; w: number }): Palette {
  if (accent === 'gold') {
    const foil = ctx.createLinearGradient(pill.x, 0, pill.x + pill.w, 0);
    foil.addColorStop(0, '#FDE68A');
    foil.addColorStop(0.45, '#FBBF24');
    foil.addColorStop(0.55, '#FCD34D');
    foil.addColorStop(1, '#F59E0B');
    return {
      bg: [[0, '#0A1A55'], [0.5, '#1E3A8A'], [1, '#070F33']],
      glow: 'rgba(251, 191, 36, 0.42)', sparkle: '#FDE68A',
      pillFill: foil, pillText: '#3B2600', pillStroke: null, gold: true,
    };
  }
  return {
    bg: [[0, '#0B2A80'], [0.48, '#1D4ED8'], [1, '#0A1A55']],
    glow: accent === 'emerald' ? 'rgba(52, 211, 153, 0.5)' : 'rgba(96, 165, 250, 0.62)',
    sparkle: accent === 'emerald' ? '#A7F3D0' : '#BFDBFE',
    pillFill: accent === 'emerald' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255, 255, 255, 0.16)',
    pillText: '#FFFFFF',
    pillStroke: accent === 'emerald' ? 'rgba(110, 231, 183, 0.7)' : 'rgba(255, 255, 255, 0.42)',
    gold: false,
  };
}

// --- SVG art as images -----------------------------------------------------------------------------

function withNamespace(markup: string): string {
  return markup.startsWith('<svg') && !markup.includes(`xmlns="${SVG_NS}"`)
    ? markup.replace('<svg', `<svg xmlns="${SVG_NS}"`)
    : markup;
}

function loadSvg(markup: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([withNamespace(markup)], { type: 'image/svg+xml;charset=utf-8' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not draw the orca')); };
    img.src = url;
  });
}

export function orcaMarkup(config: MascotConfig, circle: number): { markup: string; size: number } {
  const size = config.frame ? (circle * (200 + 2 * FRAME_PAD)) / 200 : circle;
  return { markup: renderToStaticMarkup(createElement(Orca, { config, size, idPrefix: 'sc', title: 'Kasatik' })), size };
}

/** The soft tonal pattern of Master emblems behind everything. */
export function patternMarkup(): string {
  const marks = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 5; c += 1) {
      const x = 108 + c * 270 - (r % 2) * 135;
      const y = 110 + r * 262;
      const angle = (r + c) % 2 ? 14 : -10;
      marks.push(createElement('g', { key: `${r}-${c}`, transform: `rotate(${angle} ${x} ${y})` },
        createElement(MasterMark, { x, y, size: 168, color: '#FFFFFF' })));
    }
  }
  return renderToStaticMarkup(createElement('svg', { width: CARD_W, height: CARD_H, viewBox: `0 0 ${CARD_W} ${CARD_H}` }, marks));
}

function logoMarkup(size: number): string {
  return renderToStaticMarkup(createElement('svg', { width: size, height: size, viewBox: '0 0 100 100' },
    createElement(MasterMark, { x: 50, y: 50, size: 100, color: '#FFFFFF' })));
}

/** A gold crown, drawn in vector (an emoji would look different on every phone). */
export const CROWN_SVG = `<svg width="260" height="170" viewBox="0 0 260 170">
<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FEF3C7"/><stop offset=".35" stop-color="#FCD34D"/><stop offset=".7" stop-color="#F59E0B"/><stop offset="1" stop-color="#FBBF24"/></linearGradient></defs>
<path d="M20 132 L36 42 L86 96 L130 18 L174 96 L224 42 L240 132 Z" fill="url(#cg)" stroke="#B45309" stroke-width="6" stroke-linejoin="round"/>
<rect x="18" y="122" width="224" height="40" rx="11" fill="url(#cg)" stroke="#B45309" stroke-width="6"/>
<circle cx="36" cy="40" r="13" fill="#FFF7D6" stroke="#B45309" stroke-width="5"/><circle cx="130" cy="17" r="14" fill="#FFF7D6" stroke="#B45309" stroke-width="5"/><circle cx="224" cy="40" r="13" fill="#FFF7D6" stroke="#B45309" stroke-width="5"/>
<circle cx="78" cy="142" r="9" fill="#EF4444"/><circle cx="130" cy="142" r="11" fill="#2563EB"/><circle cx="182" cy="142" r="9" fill="#10B981"/>
</svg>`;

// --- text ------------------------------------------------------------------------------------------

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The biggest size (step 4 px) at which ``text`` fits ``maxLines`` lines of ``maxWidth`` — but one
 *  line at ``oneLineMin`` px or more beats two bigger lines (a title reads better unbroken). */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, from: number, to: number,
  maxWidth: number, maxLines: number, oneLineMin = Infinity): { size: number; lines: string[] } {
  for (let size = from; size >= Math.max(to, oneLineMin); size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return { size, lines: [text] };
  }
  for (let size = from; size >= to; size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { size, lines };
  }
  ctx.font = `${weight} ${to}px ${FONT}`;
  return { size: to, lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines) };
}

function setSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

async function loadFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.all(['800 112px Inter', '700 40px Inter', '600 44px Inter', '500 44px Inter']
    .map((f) => fonts.load(f).catch(() => undefined)));
}

// --- the card --------------------------------------------------------------------------------------

export async function drawShareCard(spec: CardSpec, canvas?: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  await loadFonts();
  const el = canvas ?? document.createElement('canvas');
  el.width = CARD_W;
  el.height = CARD_H;
  const ctx = el.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const { text } = spec;
  const cx = CARD_W / 2;

  // Pill geometry first: its gold foil gradient spans the pill.
  ctx.font = `700 30px ${FONT}`;
  setSpacing(ctx, 5);
  const pillLabel = text.pill.toUpperCase();
  const pillW = Math.min(CARD_W - 160, ctx.measureText(pillLabel).width + 72);
  const pillH = 68;
  const pillY = 366;
  const pal = palette(ctx, text.accent, { x: cx - pillW / 2, w: pillW });
  setSpacing(ctx, 0);

  // Background, pattern.
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  pal.bg.forEach(([at, color]) => bg.addColorStop(at, color));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const [pattern, logo, crown] = await Promise.all([
    loadSvg(patternMarkup()), loadSvg(logoMarkup(72)), spec.crown ? loadSvg(CROWN_SVG) : Promise.resolve(null),
  ]);
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.drawImage(pattern, 0, 0, CARD_W, CARD_H);
  ctx.restore();

  // Text block, measured bottom-up from the footer so the orca takes whatever room is left.
  const footerY = 1636;
  const chipH = 80;
  const chipBottom = 1572;
  const blockBottom = spec.name ? chipBottom - chipH - 44 : chipBottom - 10;
  const title = fitText(ctx, text.title, 800, 112, 72, 940, 2, 80);
  const titleLead = Math.round(title.size * 1.08);
  const isQuote = text.line?.startsWith('“') ?? false;
  const lineFit = text.line ? fitText(ctx, text.line, 500, isQuote ? 44 : 46, 34, 880, isQuote ? 4 : 3) : null;
  const lineLead = lineFit ? Math.round(lineFit.size * 1.32) : 0;
  const leadH = text.lead ? 64 : 0;
  const blockH = leadH + title.lines.length * titleLead + (lineFit ? 26 + lineFit.lines.length * lineLead : 0);
  const textTop = blockBottom - blockH;

  // The orca: as big as the room between the pill and the text allows (a crown needs headroom).
  const roomTop = pillY + pillH + 70;
  const roomBottom = textTop - 70;
  const crownShare = spec.crown ? 0.3 : 0;
  const circle = Math.max(380, Math.min(640, (roomBottom - roomTop) / (1 + crownShare)));
  const oy = roomTop + circle * crownShare + (roomBottom - roomTop - circle * (1 + crownShare)) / 2 + circle / 2;

  // Glow and (for the big moments) rays behind the orca.
  const glow = ctx.createRadialGradient(cx, oy, circle * 0.2, cx, oy, circle * 1.25);
  glow.addColorStop(0, pal.glow);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, oy - circle * 1.4, CARD_W, circle * 2.8);
  if (pal.gold) {
    ctx.save();
    ctx.translate(cx, oy);
    ctx.fillStyle = 'rgba(253, 230, 138, 0.06)';
    for (let i = 0; i < 16; i += 1) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-48, -circle * 1.15);
      ctx.lineTo(48, -circle * 1.15);
      ctx.closePath();
      if (i % 2 === 0) ctx.fill();
    }
    ctx.restore();
  }

  // Halo, ring, shadow, then the orca.
  const r = circle / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(3, 10, 40, 0.5)';
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 26;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.arc(cx, oy, r + 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (!spec.orca.frame) {
    ctx.save();
    ctx.lineWidth = pal.gold ? 12 : 8;
    if (pal.gold) {
      const ring = ctx.createLinearGradient(cx - r, oy - r, cx + r, oy + r);
      ring.addColorStop(0, '#FEF3C7');
      ring.addColorStop(0.5, '#FBBF24');
      ring.addColorStop(1, '#F59E0B');
      ctx.strokeStyle = ring;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    }
    ctx.beginPath();
    ctx.arc(cx, oy, r + 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const orca = orcaMarkup(spec.orca, circle);
  const orcaImg = await loadSvg(orca.markup);
  ctx.drawImage(orcaImg, cx - orca.size / 2, oy - orca.size / 2, orca.size, orca.size);
  if (crown) {
    const cw = circle * 0.46;
    const ch = (cw * 170) / 260;
    ctx.save();
    ctx.translate(cx + circle * 0.06, oy - r - ch * 0.42);
    ctx.rotate((-9 * Math.PI) / 180);
    ctx.shadowColor = 'rgba(120, 53, 15, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(crown, -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
  // Sparkles beside and above the orca — never over the text block below it.
  const sparkles: [number, number, number][] = [[-0.66, -0.5, 30], [0.68, -0.34, 22], [0.74, 0.16, 18], [-0.74, 0.1, 18]];
  sparkles.forEach(([dx, dy, size], i) => {
    const sy = oy + dy * circle;
    if (sy < textTop - 40) sparkle(ctx, cx + dx * circle, sy, size * (pal.gold ? 1.25 : 1), pal.sparkle, i % 2 ? 0.75 : 0.95);
  });

  // Brand row.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 40px ${FONT}`;
  const wordmark = 'Master Education';
  const groupW = 72 + 18 + ctx.measureText(wordmark).width;
  const gx = cx - groupW / 2;
  ctx.drawImage(logo, gx, 300 - 36, 72, 72);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(wordmark, gx + 90, 302);

  // Pill.
  ctx.save();
  roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
  if (pal.pillFill) {
    ctx.fillStyle = pal.pillFill;
    if (pal.gold) {
      ctx.shadowColor = 'rgba(245, 158, 11, 0.45)';
      ctx.shadowBlur = 30;
    }
    ctx.fill();
  }
  if (pal.pillStroke) {
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.pillStroke;
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = `700 30px ${FONT}`;
  setSpacing(ctx, 5);
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.pillText;
  ctx.fillText(pillLabel, cx + 2.5, pillY + pillH / 2 + 2);
  setSpacing(ctx, 0);

  // Lead, title, proud line.
  let y = textTop;
  ctx.textBaseline = 'alphabetic';
  if (text.lead) {
    ctx.font = `600 44px ${FONT}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillText(text.lead, cx, y + 44);
    y += leadH;
  }
  ctx.font = `800 ${title.size}px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.save();
  ctx.shadowColor = pal.gold ? 'rgba(251, 191, 36, 0.35)' : 'rgba(2, 8, 40, 0.35)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 4;
  title.lines.forEach((line, i) => ctx.fillText(line, cx, y + title.size * 0.92 + i * titleLead));
  ctx.restore();
  y += title.lines.length * titleLead;
  if (lineFit) {
    y += 26;
    ctx.font = `500 ${lineFit.size}px ${FONT}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    lineFit.lines.forEach((line, i) => ctx.fillText(line, cx, y + lineFit.size + i * lineLead));
  }

  // Name chip.
  if (spec.name) {
    ctx.font = `700 44px ${FONT}`;
    const nameW = Math.min(CARD_W - 200, ctx.measureText(spec.name).width + 80);
    ctx.save();
    roundRect(ctx, cx - nameW / 2, chipBottom - chipH, nameW, chipH, chipH / 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.name, cx, chipBottom - chipH / 2 + 2, nameW - 60);
  }

  // Footer.
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 32px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
  ctx.fillText('@master.education  ·  mastereducation.kz', cx, footerY);
  return el;
}

/** The card as a PNG, for the share sheet and Save image. */
export async function renderShareCard(spec: CardSpec): Promise<Blob> {
  const canvas = await drawShareCard(spec);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the card'))), 'image/png'));
}

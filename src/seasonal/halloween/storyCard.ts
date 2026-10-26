/**
 * The Halloween story card (owner, 2026-10-26): 1080×1920, drawn on the device and never uploaded.
 * The person's own orca in a witch hat rides a broom across a full moon, five lit pumpkins below,
 * «5 of 5 pumpkins», their first name. Same conventions as the achievement card
 * (src/components/share/renderShareCard.ts): Inter, SVG art drawn as images, nothing that matters
 * in the top and bottom ~250 px that Instagram and WhatsApp cover with their own UI.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MasterMark } from '@/components/mascot/art/MasterMark';
import type { MascotConfig } from '@/components/mascot/config';
import { CARD_H, CARD_W, orcaMarkup, wrapLines } from '@/components/share/renderShareCard';
import { Bat, Broom, INK, Moon, Pumpkin } from './art';

const FONT = 'Inter, "Segoe UI", Roboto, system-ui, -apple-system, sans-serif';
const SVG_NS = 'http://www.w3.org/2000/svg';

export interface HalloweenCardSpec {
  orca: MascotConfig;
  title: string;
  line: string;
  pill: string;
  name: string | null;
}

function loadSvg(markup: string): Promise<HTMLImageElement> {
  const withNs = markup.includes(`xmlns="${SVG_NS}"`) ? markup : markup.replace('<svg', `<svg xmlns="${SVG_NS}"`);
  const url = URL.createObjectURL(new Blob([withNs], { type: 'image/svg+xml;charset=utf-8' }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not draw the card art')); };
    img.src = url;
  });
}

const art = (element: Parameters<typeof renderToStaticMarkup>[0]) => loadSvg(renderToStaticMarkup(element));

/** A fixed scatter of stars, the same on every card. */
function stars(ctx: CanvasRenderingContext2D) {
  let seed = 31;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  ctx.save();
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * CARD_W;
    const y = 200 + rand() * 840;
    ctx.globalAlpha = 0.25 + rand() * 0.55;
    ctx.fillStyle = INK.moon;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + rand() * 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The biggest size, stepping down from `from`, at which `text` fits `maxLines` lines. */
function fit(ctx: CanvasRenderingContext2D, text: string, weight: number, from: number, to: number, width: number, maxLines: number) {
  for (let size = from; size >= to; size -= 4) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    const lines = wrapLines(ctx, text, width);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= width)) return { size, lines };
  }
  ctx.font = `${weight} ${to}px ${FONT}`;
  return { size: to, lines: wrapLines(ctx, text, width).slice(0, maxLines) };
}

async function loadFonts() {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await Promise.all(['800 104px Inter', '700 40px Inter', '500 46px Inter'].map((f) => fonts.load(f).catch(() => undefined)));
}

export async function drawHalloweenCard(spec: HalloweenCardSpec): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  const cx = CARD_W / 2;

  const orcaCircle = 460;
  const orca = orcaMarkup(spec.orca, orcaCircle);
  const [moon, bat, broom, pumpkin, logo, orcaImg] = await Promise.all([
    art(createElement(Moon, { size: 380 })),
    art(createElement(Bat, { size: 160, membrane: '#5B3F8C' })),
    art(createElement(Broom, { size: 760 })),
    art(createElement(Pumpkin, { size: 120 })),
    art(createElement('svg', { width: 72, height: 72, viewBox: '0 0 100 100' }, createElement(MasterMark, { x: 50, y: 50, size: 100, color: '#FFFFFF' }))),
    loadSvg(orca.markup),
  ]);

  // Night sky, stars, the moon and its bats.
  ctx.fillStyle = INK.night;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  stars(ctx);
  ctx.drawImage(moon, 600, 470, 380, 380);
  ([[650, 520, 0.9, -10], [860, 640, 0.6, 12], [190, 600, 0.75, -6], [300, 500, 0.5, 8]] as const).forEach(([x, y, s, deg]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(bat, (-160 * s) / 2, (-80 * s) / 2, 160 * s, 80 * s);
    ctx.restore();
  });

  // Brand row and pill.
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 40px ${FONT}`;
  const wordmark = 'Master Education';
  const groupW = 72 + 18 + ctx.measureText(wordmark).width;
  ctx.drawImage(logo, cx - groupW / 2, 264, 72, 72);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(wordmark, cx - groupW / 2 + 90, 302);
  ctx.font = `700 30px ${FONT}`;
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '5px';
  const pill = spec.pill.toUpperCase();
  const pillW = ctx.measureText(pill).width + 72;
  roundRect(ctx, cx - pillW / 2, 366, pillW, 68, 34);
  ctx.fillStyle = INK.pumpkin;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = INK.pumpkinFace;
  ctx.fillText(pill, cx + 2.5, 402);
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px';

  // The orca on its broom.
  const oy = 800;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(cx, oy, orcaCircle / 2 + 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.drawImage(orcaImg, cx - orca.size / 2, oy - orca.size / 2, orca.size, orca.size);
  ctx.save();
  ctx.translate(cx - 10, oy + orcaCircle / 2 - 40);
  ctx.rotate((-8 * Math.PI) / 180);
  ctx.drawImage(broom, -380, -127, 760, 253);
  ctx.restore();

  // Five lit pumpkins.
  for (let i = 0; i < 5; i += 1) {
    const size = i === 2 ? 132 : 112;
    const x = 160 + i * 190 - size / 2;
    ctx.drawImage(pumpkin, x, 1186 - size, size, size);
  }

  // Title, line, name.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const title = fit(ctx, spec.title, 800, 104, 72, 940, 1);
  ctx.font = `800 ${title.size}px ${FONT}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(title.lines[0] ?? '', cx, 1300);
  const line = fit(ctx, spec.line, 500, 46, 34, 880, 2);
  ctx.font = `500 ${line.size}px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  line.lines.forEach((l, i) => ctx.fillText(l, cx, 1370 + i * Math.round(line.size * 1.3)));
  if (spec.name) {
    ctx.font = `700 44px ${FONT}`;
    const nameW = Math.min(CARD_W - 200, ctx.measureText(spec.name).width + 80);
    const top = 1370 + line.lines.length * Math.round(line.size * 1.3) + 10;
    roundRect(ctx, cx - nameW / 2, top, nameW, 80, 40);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.name, cx, top + 42, nameW - 60);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.font = `600 32px ${FONT}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
  ctx.fillText('@master.education  ·  mastereducation.kz', cx, 1636);
  return canvas;
}

export async function renderHalloweenCard(spec: HalloweenCardSpec): Promise<Blob> {
  const canvas = await drawHalloweenCard(spec);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the card'))), 'image/png'));
}

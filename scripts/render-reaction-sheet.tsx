/**
 * Renders the live-lesson reaction sheet for visual review (not part of the build):
 *   ./node_modules/.bin/vite-node --config vitest.config.js scripts/render-reaction-sheet.tsx -- <out.png>
 * Every reaction on four looks (classic, Master hoodie, two automatic orcas) and the plain
 * anonymous orca at 160 px, then all six at 48 px and 40 px.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import ReactionOrca, { REACTION_KINDS } from '../src/components/mascot/ReactionOrca';

const out = process.argv[2] || 'reaction_sheet.png';
const LOOKS: { name: string; code: string | null; userId: number | null }[] = [
  { name: 'classic', code: 'v1.h0.g0.e0.p0.b0', userId: 1 },
  { name: 'master hoodie', code: 'v2.h16.g0.e0.p1.b10.f0', userId: 2 },
  { name: 'auto 104', code: null, userId: 104 },
  { name: 'auto 233', code: null, userId: 233 },
  { name: 'anonymous', code: null, userId: null },
];
const cell = 190;
const big = 160;
const rows = LOOKS.length;
const width = cell * REACTION_KINDS.length + 40;
const smallTop = rows * cell + 30;
const height = smallTop + 2 * 70 + 40;
const parts: string[] = [];
LOOKS.forEach((look, r) => {
  REACTION_KINDS.forEach((kind, c) => {
    const svg = renderToStaticMarkup(createElement(ReactionOrca, { kind, code: look.code, userId: look.userId, size: big }));
    parts.push(`<g transform="translate(${20 + c * cell + 15}, ${20 + r * cell})">${svg}</g>`);
    if (r === 0) parts.push(`<text x="${20 + c * cell + 95}" y="${18 + rows * cell}" font-size="16" text-anchor="middle" font-family="sans-serif">${kind}</text>`);
  });
});
[48, 40].forEach((s, i) => {
  REACTION_KINDS.forEach((kind, c) => {
    LOOKS.slice(0, 3).forEach((look, j) => {
      const svg = renderToStaticMarkup(createElement(ReactionOrca, { kind, code: look.code, userId: look.userId, size: s }));
      parts.push(`<g transform="translate(${20 + c * cell + j * (s + 6)}, ${smallTop + i * 70})">${svg}</g>`);
    });
  });
});
const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#F4F6FB"/>${parts.join('')}</svg>`;
sharp(Buffer.from(doc)).png().toFile(out).then(() => console.log('wrote', out));

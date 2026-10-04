/**
 * Renders a contact sheet of the orca avatars for visual review (not part of the build):
 *   ./node_modules/.bin/vite-node --config vitest.config.js scripts/render-orca-sheet.tsx -- <out.png> [seed]
 * Every preset at 160 px, 24 random looks at 160 px, then a row at 40 px and one at 32 px.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import Orca from '../src/components/mascot/Orca';
import { makeRng, randomMascot, type MascotConfig } from '../src/components/mascot/config';
import { PRESETS } from '../src/components/mascot/presets';

const out = process.argv[2] || 'orca_contact_sheet.png';
const seed = Number(process.argv[3] || 42);
const COLS = 8;
const CELL = 160;
const GAP = 14;
const LABEL = 18;

function orcaSvg(config: MascotConfig, size: number, prefix: string): string {
  return renderToStaticMarkup(createElement(Orca, { config, size, idPrefix: prefix }))
    .replace('<svg ', `<svg x="{X}" y="{Y}" `);
}

const rng = makeRng(seed);
const randoms = Array.from({ length: 24 }, () => randomMascot(rng));
const items: { config: MascotConfig; name: string }[] = [
  ...PRESETS.map((p) => ({ config: p.config, name: p.name })),
  ...randoms.map((c, i) => ({ config: c, name: `random ${i + 1}` })),
];

const rows = Math.ceil(items.length / COLS);
const width = COLS * (CELL + GAP) + GAP;
const smallTop = GAP + rows * (CELL + LABEL + GAP);
const height = smallTop + 40 + GAP + 32 + GAP * 2;
const parts: string[] = [];
items.forEach((item, i) => {
  const x = GAP + (i % COLS) * (CELL + GAP);
  const y = GAP + Math.floor(i / COLS) * (CELL + LABEL + GAP);
  parts.push(orcaSvg(item.config, CELL, `a${i}`).replace('{X}', String(x)).replace('{Y}', String(y)));
  const name = item.name.replace(/&/g, '&amp;');
  parts.push(`<text x="${x + CELL / 2}" y="${y + CELL + 14}" text-anchor="middle" font-family="Arial" font-size="12" fill="#334">${name}</text>`);
});
items.slice(0, 40).forEach((item, i) => {
  parts.push(orcaSvg(item.config, 40, `s${i}`).replace('{X}', String(GAP + i * 46)).replace('{Y}', String(smallTop)));
  parts.push(orcaSvg(item.config, 32, `t${i}`).replace('{X}', String(GAP + i * 46 + 4)).replace('{Y}', String(smallTop + 40 + GAP)));
});

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#F3F5FA"/>${parts.join('')}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(out);
console.log(`wrote ${out} (${items.length} looks, ${width}x${height})`);

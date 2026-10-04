/**
 * Renders contact sheets of the orca avatars for visual review (not part of the build):
 *   ./node_modules/.bin/vite-node --config vitest.config.js scripts/render-orca-sheet.tsx -- <out.png> [all|branded]
 * "all": the branded looks, every preset and 24 random looks at 160 px, then the branded looks
 * at 40 px and 32 px. "branded": only the branded looks, large, plus their 40/32 px rows.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import Orca from '../src/components/mascot/Orca';
import { makeRng, randomMascot, type MascotConfig } from '../src/components/mascot/config';
import { PRESETS } from '../src/components/mascot/presets';

const out = process.argv[2] || 'orca_contact_sheet.png';
const mode = process.argv[3] === 'branded' ? 'branded' : 'all';

const c = (hat: number, eyewear: number, expression: number, prop: number, background: number): MascotConfig =>
  ({ hat, eyewear, expression, prop, background });
/** One look per branded placement, so each can be judged on its own. */
const PLACEMENTS: { config: MascotConfig; name: string }[] = [
  { name: 'hoodie', config: c(16, 0, 0, 0, 10) },
  { name: 'laptop lid', config: c(0, 0, 0, 1, 0) },
  { name: 'cape crest', config: c(4, 0, 4, 0, 6) },
  { name: 'mission patch', config: c(3, 0, 0, 0, 7) },
  { name: 'rocket', config: c(0, 0, 3, 7, 1) },
  { name: 'mug', config: c(0, 0, 1, 3, 2) },
  { name: 'book cover', config: c(0, 1, 0, 2, 3) },
  { name: 'trophy', config: c(0, 0, 7, 14, 5) },
  { name: 'headphones', config: c(2, 0, 4, 0, 9) },
  { name: 'backwards cap', config: c(14, 0, 2, 0, 8) },
  { name: 'beanie', config: c(12, 0, 0, 0, 1) },
  { name: 'grad tassel', config: c(1, 0, 0, 0, 10) },
  { name: 'Master blue bg', config: c(0, 0, 0, 0, 10) },
];
const branded = [
  ...PRESETS.filter((p) => p.name.startsWith('Master')).map((p) => ({ config: p.config, name: p.name })),
  ...PLACEMENTS,
];

const CELL = mode === 'branded' ? 240 : 160;
const COLS = mode === 'branded' ? 6 : 8;
const GAP = 14;
const LABEL = 18;

function orcaSvg(config: MascotConfig, size: number, prefix: string, x: number, y: number): string {
  return renderToStaticMarkup(createElement(Orca, { config, size, idPrefix: prefix }))
    .replace('<svg ', `<svg x="${x}" y="${y}" `);
}

const rng = makeRng(42);
const items = mode === 'branded'
  ? branded
  : [
      ...branded,
      ...PRESETS.filter((p) => !p.name.startsWith('Master')).map((p) => ({ config: p.config, name: p.name })),
      ...Array.from({ length: 24 }, (_, i) => ({ config: randomMascot(rng), name: `random ${i + 1}` })),
    ];

const rows = Math.ceil(items.length / COLS);
const width = COLS * (CELL + GAP) + GAP;
const smallTop = GAP + rows * (CELL + LABEL + GAP);
const perRow = Math.floor((width - GAP) / 46);
const smallItems = branded.slice(0, perRow);
const height = smallTop + 40 + GAP + 32 + GAP * 2;
const parts: string[] = [];
items.forEach((item, i) => {
  const x = GAP + (i % COLS) * (CELL + GAP);
  const y = GAP + Math.floor(i / COLS) * (CELL + LABEL + GAP);
  parts.push(orcaSvg(item.config, CELL, `a${i}`, x, y));
  parts.push(`<text x="${x + CELL / 2}" y="${y + CELL + 14}" text-anchor="middle" font-family="Arial" font-size="12" fill="#334">${item.name.replace(/&/g, '&amp;')}</text>`);
});
smallItems.forEach((item, i) => {
  parts.push(orcaSvg(item.config, 40, `s${i}`, GAP + i * 46, smallTop));
  parts.push(orcaSvg(item.config, 32, `t${i}`, GAP + i * 46 + 4, smallTop + 40 + GAP));
});

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#F3F5FA"/>${parts.join('')}</svg>`;
await sharp(Buffer.from(sheet)).png().toFile(out);
console.log(`wrote ${out} (${items.length} looks, ${width}x${height})`);

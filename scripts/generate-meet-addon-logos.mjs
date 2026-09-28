#!/usr/bin/env node
/**
 * Logos for the Google Meet add-on and its Marketplace listing, from public/logo.svg (the PWA
 * icons' source). Google's rules: PNG, transparent, no padding; 256 px for Meet (light and dark),
 * 32 and 128 px for the Marketplace listing. The outputs are committed; rerun after a logo change:
 *   node scripts/generate-meet-addon-logos.mjs
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'meet-addon');
const LOGO_BLUE = '#2563eb'; // blue-600, as the PWA icons
const ON_DARK = '#ffffff';
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

async function render(svg, colour, size, file) {
  const painted = Buffer.from(svg.replace(/fill="#000000"/g, `fill="${colour}"`));
  // Render large, cut the transparent margin away (no padding), then fit the square.
  const trimmed = await sharp(painted, { density: 600 }).trim().png().toBuffer();
  await sharp(trimmed)
    .resize(size, size, { fit: 'contain', background: CLEAR })
    .png()
    .toFile(join(outDir, file));
  console.log(`meet-addon/${file}`);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const svg = await readFile(join(root, 'public', 'logo.svg'), 'utf-8');
  await render(svg, LOGO_BLUE, 256, 'logo-256.png');
  await render(svg, ON_DARK, 256, 'logo-256-dark.png');
  await render(svg, LOGO_BLUE, 128, 'icon-128.png');
  await render(svg, LOGO_BLUE, 32, 'icon-32.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

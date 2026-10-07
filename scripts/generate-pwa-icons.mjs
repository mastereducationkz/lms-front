#!/usr/bin/env node
/**
 * Generates the PWA's images from logo.svg (runs as `prebuild`):
 *  - icons/icon-<size>.png: the "any" icons, blue logo on white (also the iOS home-screen icon);
 *  - icons/icon-maskable-<size>.png: Android's adaptive icons, the logo shrunk into the safe zone
 *    (a circle of 80% of the width) so no launcher mask crops it;
 *  - icons/badge-96.png: the white-on-transparent silhouette Android puts in the status bar
 *    next to a notification;
 *  - icons/shortcut-*.png: the long-press shortcuts' icons, drawn from the sidebar's lucide icons;
 *  - splash/launch-*.png: iPhone launch screens, light and dark (scripts/pwa-assets.mjs lists them).
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { IPHONE_SCREENS, SHORTCUTS, SPLASH_THEMES, splashPath } from './pwa-assets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicDir = join(root, 'public');
const srcSvg = join(publicDir, 'logo.svg');
const iconsDir = join(publicDir, 'icons');
const splashDir = join(publicDir, 'splash');
const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const maskableSizes = [192, 512];

const LOGO_BLUE = '#2563eb'; // blue-600
const BG_WHITE = '#ffffff';
const SURFACE = '#eff6ff'; // --brand-surface (light)
// The logo drawn at this share of a maskable icon's width keeps its starburst (about 68% of the
// SVG box) inside the 80% safe circle with room to spare.
const MASKABLE_LOGO_SCALE = 0.84;
// …and at this share of the shorter side of a launch screen.
const SPLASH_LOGO_SCALE = 0.3;

const logoSvg = (svg, color) => Buffer.from(svg.replace(/fill="#000000"/g, `fill="${color}"`));

async function logoPng(svg, color, size) {
  return sharp(logoSvg(svg, color)).resize(size, size).png().toBuffer();
}

async function onCanvas(width, height, background, logo, logoSize, file) {
  await sharp({ create: { width, height, channels: 4, background } })
    .composite([{ input: logo, left: Math.round((width - logoSize) / 2), top: Math.round((height - logoSize) / 2) }])
    .flatten({ background })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

/** A lucide icon's SVG, from the same package the sidebar draws with. */
async function lucideSvg(name, color) {
  const mod = await import(pathToFileURL(join(root, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons', `${name}.js`)).href);
  const body = mod.__iconNode
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`,
  );
}

async function main() {
  await mkdir(iconsDir, { recursive: true });
  await mkdir(splashDir, { recursive: true });
  const svg = await readFile(srcSvg, 'utf-8');

  for (const size of sizes) {
    await sharp(logoSvg(svg, LOGO_BLUE))
      .resize(size, size)
      .flatten({ background: BG_WHITE })
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
  }

  for (const size of maskableSizes) {
    const logoSize = Math.round(size * MASKABLE_LOGO_SCALE);
    await onCanvas(size, size, BG_WHITE, await logoPng(svg, LOGO_BLUE, logoSize), logoSize, join(iconsDir, `icon-maskable-${size}.png`));
  }

  // Android uses only the alpha channel of a badge: a white logo on transparent.
  await sharp(logoSvg(svg, '#ffffff')).resize(96, 96).png().toFile(join(iconsDir, 'badge-96.png'));

  for (const shortcut of SHORTCUTS) {
    const glyph = await sharp(await lucideSvg(shortcut.icon, LOGO_BLUE)).resize(48, 48).png().toBuffer();
    await onCanvas(96, 96, SURFACE, glyph, 48, join(publicDir, shortcut.file));
  }

  for (const [w, h, ratio] of IPHONE_SCREENS) {
    const width = w * ratio;
    const height = h * ratio;
    const logoSize = Math.round(Math.min(width, height) * SPLASH_LOGO_SCALE);
    for (const [theme, colors] of Object.entries(SPLASH_THEMES)) {
      const logo = await logoPng(svg, colors.logo, logoSize);
      await onCanvas(width, height, colors.background, logo, logoSize, join(publicDir, splashPath(w, h, ratio, theme)));
    }
  }
  console.log(
    `PWA images generated: ${sizes.length} icons, ${maskableSizes.length} maskable, 1 badge, ${SHORTCUTS.length} shortcuts, ` +
      `${IPHONE_SCREENS.length * Object.keys(SPLASH_THEMES).length} launch screens.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

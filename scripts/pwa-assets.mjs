/**
 * One list of the PWA's generated images, read by scripts/generate-pwa-icons.mjs (which draws
 * them) and vite.config.js (which names them in the manifest and in index.html).
 */

// Launch screens for iPhones, portrait only (the manifest locks portrait). iOS shows the one whose
// media query matches the device exactly, else a white flash; light and dark versions each.
// [CSS width, CSS height, device pixel ratio]
export const IPHONE_SCREENS = [
  [440, 956, 3], // 16 Pro Max
  [402, 874, 3], // 16 Pro
  [430, 932, 3], // 14 Pro Max, 15 Plus/Pro Max, 16 Plus
  [393, 852, 3], // 14 Pro, 15, 15 Pro, 16
  [428, 926, 3], // 12/13 Pro Max, 14 Plus
  [390, 844, 3], // 12, 13, 14, 12/13 Pro
  [375, 812, 3], // X, XS, 11 Pro, 12/13 mini
  [414, 896, 3], // XS Max, 11 Pro Max
  [414, 896, 2], // XR, 11
  [414, 736, 3], // 6s/7/8 Plus
  [375, 667, 2], // SE (2nd/3rd gen), 6s/7/8
];

// The app's own page backgrounds (src/index.css --background), so the launch screen hands over
// to the first paint without a flash.
export const SPLASH_THEMES = {
  light: { background: '#ffffff', logo: '#2563eb' },
  dark: { background: '#121317', logo: '#60a5fa' },
};

export const splashPath = (w, h, ratio, theme) => `/splash/launch-${w * ratio}x${h * ratio}-${theme}.png`;

/** The `<link rel="apple-touch-startup-image">` tags for index.html. */
export function splashLinkTags() {
  const tags = [];
  for (const [w, h, ratio] of IPHONE_SCREENS) {
    for (const theme of Object.keys(SPLASH_THEMES)) {
      const media =
        `screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${ratio}) ` +
        `and (orientation: portrait) and (prefers-color-scheme: ${theme})`;
      tags.push(`<link rel="apple-touch-startup-image" media="${media}" href="${splashPath(w, h, ratio, theme)}"/>`);
    }
  }
  return tags.join('\n    ');
}

// Long-press shortcuts on the installed icon. `icon` names a lucide icon (the sidebar uses the same).
export const SHORTCUTS = [
  { name: 'Dashboard', url: '/dashboard', icon: 'house', file: '/icons/shortcut-dashboard.png' },
  { name: 'My Homework', short_name: 'Homework', url: '/homework', icon: 'clipboard-list', file: '/icons/shortcut-homework.png' },
  { name: 'Calendar', url: '/calendar', icon: 'calendar', file: '/icons/shortcut-calendar.png' },
];

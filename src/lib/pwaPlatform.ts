/**
 * Which way this browser can put the LMS on the home screen (owner, 2026-10-07: students must
 * learn they can install it). Pure: it reads only what it's handed, so every user agent is
 * testable in node. `src/services/pwaInstall.ts` feeds it the real `navigator`.
 */
export type InstallPlatform =
  /** iPhone/iPad Safari, or Chrome/Edge/Firefox on iOS 16.4+: Share → Add to Home Screen. */
  | 'ios-safari'
  /** Telegram, Instagram & co. on iOS: nothing installs there; open the page in Safari first. */
  | 'ios-in-app'
  /** The same on Android (a WebView). */
  | 'android-in-app'
  /** Chrome, Samsung Internet, Edge… on Android: the native prompt, or the browser menu. */
  | 'android'
  /** Chromium on a computer (Chrome, Edge, Opera, Yandex): the native prompt. */
  | 'desktop'
  /** Firefox on a computer, Safari on a Mac, anything else. */
  | 'unsupported';

export interface PlatformInfo {
  platform: InstallPlatform;
  /** iPhone Safari 26 hid Share behind the ⋯ button of its compact toolbar. */
  shareInMoreMenu: boolean;
  /** iOS only: which browser, so the steps point at the right Share button. */
  iosBrowser: 'safari' | 'chrome' | 'other' | null;
  /** In-app browsers: the app's name when the user agent says it ("Telegram"), for the copy. */
  inAppName: string | null;
}

export interface PlatformEnv {
  userAgent: string;
  /** `navigator.maxTouchPoints`: iPadOS 13+ Safari reports itself as a Mac. */
  maxTouchPoints?: number;
  /** Telegram's in-app browser exposes `window.TelegramWebviewProxy`. */
  telegramWebview?: boolean;
}

// Apps whose built-in browser can't install a web app. Telegram is the one that matters: the
// LMS links students follow mostly arrive in Telegram group chats.
const IN_APP_MARKERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Telegram/i, 'Telegram'],
  [/Instagram/i, 'Instagram'],
  [/FBAN|FBAV|FB_IAB|FBIOS/, 'Facebook'],
  [/WhatsApp/i, 'WhatsApp'],
  [/\bLine\//, 'LINE'],
  [/Snapchat/i, 'Snapchat'],
  [/musical_ly|BytedanceWebview|TikTok/i, 'TikTok'],
  [/VKClient|\bVK\//, 'VK'],
];

function inAppName(ua: string, env: PlatformEnv): string | null | undefined {
  if (env.telegramWebview) return 'Telegram';
  for (const [re, name] of IN_APP_MARKERS) if (re.test(ua)) return name;
  return undefined;
}

/** "CPU iPhone OS 17_2 like Mac OS X" → [17, 2]. iOS 26 froze this at 18_6, which still reads as ≥ 16.4. */
function iosVersion(ua: string): [number, number] | null {
  const m = /OS (\d+)_(\d+)/.exec(ua);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

export function isIosUserAgent(ua: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

export function detectPlatform(env: PlatformEnv): PlatformInfo {
  const ua = env.userAgent || '';
  const base: PlatformInfo = { platform: 'unsupported', shareInMoreMenu: false, iosBrowser: null, inAppName: null };

  if (isIosUserAgent(ua, env.maxTouchPoints)) {
    const app = inAppName(ua, env);
    // The Google app and every WKWebView (no "Safari/" token) are in-app browsers too.
    if (app !== undefined || /\bGSA\//.test(ua)) return { ...base, platform: 'ios-in-app', inAppName: app ?? null };
    const iosBrowser = /CriOS/.test(ua) ? 'chrome' : /FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua) ? 'other' : 'safari';
    if (iosBrowser === 'safari' && !/Safari\//.test(ua)) return { ...base, platform: 'ios-in-app' };
    // Other iOS browsers gained "Add to Home Screen" in 16.4; before that only Safari had it.
    const version = iosVersion(ua);
    const modern = !version || version[0] > 16 || (version[0] === 16 && version[1] >= 4);
    if (iosBrowser !== 'safari' && !modern) return { ...base, platform: 'ios-in-app' };
    const safariMajor = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
    const iphone = /iPhone|iPod/.test(ua);
    return { ...base, platform: 'ios-safari', iosBrowser, shareInMoreMenu: iosBrowser === 'safari' && iphone && safariMajor >= 26 };
  }

  if (/Android/i.test(ua)) {
    const app = inAppName(ua, env);
    if (app !== undefined || /; wv\)/.test(ua)) return { ...base, platform: 'android-in-app', inAppName: app ?? null };
    return { ...base, platform: 'android' };
  }

  // A computer: only Chromium installs web apps from a prompt. Firefox has no install; Safari on
  // a Mac has File → Add to Dock, which isn't worth a nudge for the staff who work there.
  if (/Firefox\//.test(ua)) return base;
  if (/Chrome\/|Chromium\/|Edg\//.test(ua)) return { ...base, platform: 'desktop' };
  return base;
}

/** True when the platform has some way to install, prompt or not. */
export function canEverInstall(platform: InstallPlatform): boolean {
  return platform !== 'unsupported';
}

export type DisplayMode = 'standalone' | 'browser';

/**
 * Whether the LMS is running as the installed app. `matches` is `window.matchMedia(q).matches`;
 * iOS reports a home-screen launch only through `navigator.standalone`.
 */
export function displayModeFrom(matches: (query: string) => boolean, navigatorStandalone?: boolean): DisplayMode {
  if (navigatorStandalone === true) return 'standalone';
  for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']) {
    if (matches(`(display-mode: ${mode})`)) return 'standalone';
  }
  return 'browser';
}

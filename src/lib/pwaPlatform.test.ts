import { describe, expect, it } from 'vitest';
import { detectPlatform, displayModeFrom, isIosUserAgent } from './pwaPlatform';

// Real user agents, trimmed only where noted.
const UA = {
  iphoneSafari17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  // iOS 26 froze the OS token at 18_6; Safari's own version says 26.
  iphoneSafari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  iphoneChromeOld: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/108.0.5359.112 Mobile/15E148 Safari/604.1',
  // Telegram's in-app browser on iOS is a bare WKWebView: no "Version/…" or "Safari/…".
  iphoneTelegram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,3; iOS 17_5; en_US; en; scale=3.00; 1290x2796; 610796385)',
  iphoneGoogleApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/321.0.645997016 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  androidTelegram: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240705.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Telegram-Android/11.0.0 (Google Pixel 7; Android 14; SDK 34; HIGH)',
  androidWebView: 'Mozilla/5.0 (Linux; Android 13; SM-A536B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  desktopEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68',
  desktopFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

describe('detectPlatform', () => {
  it('iPhone Safari before 26: the Share button is in the toolbar', () => {
    expect(detectPlatform({ userAgent: UA.iphoneSafari17 })).toEqual({
      platform: 'ios-safari',
      iosBrowser: 'safari',
      shareInMoreMenu: false,
      inAppName: null,
    });
  });

  it('iPhone Safari 26: Share moved behind the ⋯ button', () => {
    const info = detectPlatform({ userAgent: UA.iphoneSafari26 });
    expect(info.platform).toBe('ios-safari');
    expect(info.shareInMoreMenu).toBe(true);
  });

  it('Chrome on iOS 16.4+ can add to the Home Screen too, from its address bar', () => {
    expect(detectPlatform({ userAgent: UA.iphoneChrome })).toMatchObject({ platform: 'ios-safari', iosBrowser: 'chrome', shareInMoreMenu: false });
  });

  it('Chrome on iOS before 16.4 has to send people to Safari', () => {
    expect(detectPlatform({ userAgent: UA.iphoneChromeOld }).platform).toBe('ios-in-app');
  });

  it('Telegram on iPhone is an in-app browser, by its bare WebView user agent or its proxy object', () => {
    expect(detectPlatform({ userAgent: UA.iphoneTelegram })).toMatchObject({ platform: 'ios-in-app', inAppName: null });
    expect(detectPlatform({ userAgent: UA.iphoneTelegram, telegramWebview: true })).toMatchObject({ platform: 'ios-in-app', inAppName: 'Telegram' });
  });

  it('names Instagram and treats the Google app as in-app', () => {
    expect(detectPlatform({ userAgent: UA.iphoneInstagram })).toMatchObject({ platform: 'ios-in-app', inAppName: 'Instagram' });
    expect(detectPlatform({ userAgent: UA.iphoneGoogleApp }).platform).toBe('ios-in-app');
  });

  it('an iPad that reports itself as a Mac is still iOS (touch points give it away)', () => {
    expect(detectPlatform({ userAgent: UA.ipadAsMac, maxTouchPoints: 5 })).toMatchObject({ platform: 'ios-safari', shareInMoreMenu: false });
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 }).platform).toBe('unsupported');
  });

  it('Android: Chrome can install; Telegram and any WebView cannot', () => {
    expect(detectPlatform({ userAgent: UA.androidChrome }).platform).toBe('android');
    expect(detectPlatform({ userAgent: UA.androidTelegram })).toMatchObject({ platform: 'android-in-app', inAppName: 'Telegram' });
    expect(detectPlatform({ userAgent: UA.androidWebView })).toMatchObject({ platform: 'android-in-app', inAppName: null });
  });

  it('computers: Chromium installs, Firefox and Mac Safari do not', () => {
    expect(detectPlatform({ userAgent: UA.desktopChrome }).platform).toBe('desktop');
    expect(detectPlatform({ userAgent: UA.desktopEdge }).platform).toBe('desktop');
    expect(detectPlatform({ userAgent: UA.desktopFirefox }).platform).toBe('unsupported');
    expect(detectPlatform({ userAgent: '' }).platform).toBe('unsupported');
  });
});

describe('isIosUserAgent', () => {
  it('spots iPhones and touch Macs only', () => {
    expect(isIosUserAgent(UA.iphoneSafari17)).toBe(true);
    expect(isIosUserAgent(UA.ipadAsMac, 5)).toBe(true);
    expect(isIosUserAgent(UA.macSafari, 0)).toBe(false);
    expect(isIosUserAgent(UA.androidChrome)).toBe(false);
  });
});

describe('displayModeFrom', () => {
  it('reads the installed app from display-mode or from iOS navigator.standalone', () => {
    expect(displayModeFrom((q) => q === '(display-mode: standalone)')).toBe('standalone');
    expect(displayModeFrom((q) => q === '(display-mode: window-controls-overlay)')).toBe('standalone');
    expect(displayModeFrom(() => false, true)).toBe('standalone');
    expect(displayModeFrom(() => false, false)).toBe('browser');
    expect(displayModeFrom(() => false)).toBe('browser');
  });
});

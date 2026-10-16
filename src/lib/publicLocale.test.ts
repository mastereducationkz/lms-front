// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialPublicLocale } from './publicLocale';
import { captureAttribution } from './utm';

// Node's own `localStorage` stub has no methods; the app's code only needs get/set.
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, String(value)); },
    removeItem: (key: string) => { items.delete(key); },
    clear: () => items.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const browserLanguage = (language: string) => vi.stubGlobal('navigator', { language });

describe('the language of a page a visitor opens without signing in', () => {
  it('is Russian for Russian and Kazakh browsers, English for the rest', () => {
    browserLanguage('ru-RU'); expect(initialPublicLocale()).toBe('ru');
    browserLanguage('kk-KZ'); expect(initialPublicLocale()).toBe('ru');
    browserLanguage('en-GB'); expect(initialPublicLocale()).toBe('en');
    browserLanguage('de'); expect(initialPublicLocale()).toBe('en');
  });

  it('is what the visitor last chose on this device, whatever the browser says', () => {
    browserLanguage('ru-RU');
    localStorage.setItem('lms:ui-language', 'en');
    expect(initialPublicLocale()).toBe('en');
  });
});

describe('where a visitor came from', () => {
  it('keeps the utm_* tags and the referrer for the whole visit, and ignores everything else', () => {
    const first = captureAttribution('?utm_source=instagram&utm_campaign=oct&fbclid=zzz&utm_term=%20', 'https://instagram.com/');
    expect(first).toEqual({ utm: { utm_source: 'instagram', utm_campaign: 'oct' }, referer: 'https://instagram.com/' });
    // The form is on the next screen: the address no longer carries them, the visit still does.
    expect(captureAttribution('', '')).toEqual(first);
  });

  it('reads an empty visit as no attribution at all', () => {
    expect(captureAttribution('', '')).toEqual({ utm: {}, referer: undefined });
  });

  it('cuts overlong values', () => {
    const long = 'x'.repeat(500);
    expect(captureAttribution(`?utm_source=${long}`, '').utm.utm_source).toHaveLength(200);
  });
});

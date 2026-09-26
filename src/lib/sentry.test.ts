import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import {
  FILTERED,
  beforeBreadcrumb,
  beforeSend,
  isIgnoredEvent,
  reportError,
  scrubText,
  scrubUrl,
  sentryConfigured,
  setSentryUser,
  startSentry,
} from './sentry';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJpdGVtIjo0Mn0.c2lnbmF0dXJl';

describe('sentry is off outside the production image', () => {
  it('has no DSN in tests, so nothing loads and nothing throws', () => {
    expect(sentryConfigured()).toBe(false);
    startSentry();
    reportError(new Error('x'));
    setSentryUser({ id: 1, role: 'student' });
    setSentryUser(null);
  });
});

describe('scrubUrl', () => {
  it.each([
    [`https://lmsapi.mastereducation.kz/uploads/v/${TOKEN}/videos/1/index.m3u8`, TOKEN],
    [`/class-materials/download/${TOKEN}`, TOKEN],
    ['https://lms.mastereducation.kz/watch/abc123short', 'abc123short'],
    ['/watch-links/abc123short', 'abc123short'],
    ['/calendar/feeds/me/abc123short.ics', 'abc123short'],
    ['https://bucket.s3.amazonaws.com/submissions/a.jpg?X-Amz-Signature=deadbeef', 'deadbeef'],
    ['/users?search=Иванов', 'Иванов'],
    ['/auth/callback?code=onetime&state=s', 'onetime'],
    ['/auth/callback#access_token=abc', 'access_token'],
    ['/profile/anna.petrova@example.com', 'anna.petrova@example.com'],
    [`/x/${'a'.repeat(48)}`, 'a'.repeat(48)],
    ['wss://user:pa55word@proxy.local:1080/x', 'pa55word'],
    [`/anything/else?no=1&jwt=${TOKEN}`, TOKEN],
  ])('removes the credential from %s', (url, leaked) => {
    const out = scrubUrl(url);
    expect(out).not.toContain(leaked);
  });

  it('keeps ordinary paths', () => {
    expect(scrubUrl('/courses/12/lessons/34')).toBe('/courses/12/lessons/34');
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it('marks what it removed', () => {
    expect(scrubUrl('/watch/abc')).toBe(`/watch/${FILTERED}`);
    expect(scrubUrl('/users?search=x')).toBe(`/users?${FILTERED}`);
  });
});

describe('scrubText', () => {
  it('cleans JWTs and bearer tokens anywhere', () => {
    expect(scrubText(`bad token ${TOKEN} here`)).not.toContain(TOKEN);
    expect(scrubText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123')).not.toContain('abcdefghijklmnop');
  });

  it('cleans URLs and emails inside a message', () => {
    const out = scrubText(`GET https://x.kz/class-materials/download/${TOKEN}?a=1 failed for anna@example.com`);
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain('anna@example.com');
    expect(out).not.toContain('a=1');
  });
});

const errorEvent = (type: string, value: string, filename = 'https://lms.mastereducation.kz/assets/index.js'): ErrorEvent =>
  ({
    type: undefined,
    exception: { values: [{ type, value, stacktrace: { frames: [{ filename }] } }] },
  }) as ErrorEvent;

describe('noise is never reported', () => {
  it.each([
    ['Error', 'ResizeObserver loop completed with undelivered notifications.'],
    ['TypeError', 'Failed to fetch dynamically imported module: https://lms.mastereducation.kz/assets/Page-abc.js'],
    ['TypeError', 'Importing a module script failed.'],
    ['Error', 'Unable to preload CSS for /assets/x.css'],
    ['CanceledError', 'canceled'],
    ['AbortError', 'The user aborted a request.'],
    ['AxiosError', 'Request failed with status code 403'],
    ['Error', 'Network Error'],
    ['TypeError', 'lazy: Expected the result of a dynamic import() call. Instead received: undefined'],
    ['Error', 'Missing refresh token'],
  ])('%s: %s', (type, value) => {
    expect(isIgnoredEvent(errorEvent(type, value))).toBe(true);
  });

  it('drops errors thrown only from extension frames', () => {
    expect(isIgnoredEvent(errorEvent('TypeError', 'x is undefined', 'chrome-extension://abc/content.js'))).toBe(true);
  });

  it('drops errors whose stack never touches our /assets/ bundle (in-app browser injections)', () => {
    expect(isIgnoredEvent(errorEvent('TypeError', 'x is null', 'https://lms.mastereducation.kz/lessons/5'))).toBe(true);
    expect(isIgnoredEvent(errorEvent('ReferenceError', 'WeixinJSBridge is not defined', '<anonymous>'))).toBe(true);
  });

  it('drops frameless bare-identifier errors', () => {
    const ev = { exception: { values: [{ type: 'Error', value: 'Ea' }] } } as ErrorEvent;
    expect(isIgnoredEvent(ev)).toBe(true);
  });

  it('drops any axios error by the original exception', () => {
    const ev = errorEvent('Error', 'Request failed with status code 500');
    expect(isIgnoredEvent(ev, { originalException: { isAxiosError: true } })).toBe(true);
  });

  it('keeps a real bug', () => {
    expect(isIgnoredEvent(errorEvent('TypeError', "Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(beforeSend(errorEvent('TypeError', 'boom'), {})).not.toBeNull();
  });
});

describe('beforeSend strips personal data', () => {
  it('scrubs the request, the message, breadcrumbs and the user', () => {
    const event = {
      ...errorEvent('TypeError', 'failed for anna@example.com'),
      request: {
        url: `https://lms.mastereducation.kz/watch/${TOKEN}?x=1`,
        headers: { 'User-Agent': 'UA', Referer: `https://lms.mastereducation.kz/watch/${TOKEN}`, Cookie: 'a=b' },
        cookies: { a: 'b' },
        query_string: 'x=1',
      },
      user: { id: '7', email: 'anna@example.com', ip_address: '1.2.3.4', username: 'Анна' },
      breadcrumbs: [
        { category: 'fetch', data: { url: `https://lmsapi.mastereducation.kz/class-materials/download/${TOKEN}` } },
        { category: 'console', level: 'error', message: 'oops', data: { arguments: [{ name: 'Анна' }] } },
      ],
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const blob = JSON.stringify(out);
    for (const secret of [TOKEN, 'anna@example.com', '1.2.3.4', 'Анна', 'a=b', 'x=1']) {
      expect(blob).not.toContain(secret);
    }
    expect(out?.user).toEqual({ id: '7' });
    expect(Object.keys(out?.request ?? {}).sort()).toEqual(['headers', 'url']);
  });
});

describe('beforeBreadcrumb', () => {
  it('drops chatty console lines, keeps warnings and errors', () => {
    expect(beforeBreadcrumb({ category: 'console', level: 'log', message: 'data' })).toBeNull();
    expect(beforeBreadcrumb({ category: 'console', level: 'warning', message: 'w' })).not.toBeNull();
  });

  it('drops video segment requests, which would flood the buffer', () => {
    expect(beforeBreadcrumb({ category: 'xhr', data: { url: `https://api/uploads/v/${TOKEN}/videos/1/seg12.ts` } })).toBeNull();
    expect(beforeBreadcrumb({ category: 'fetch', data: { url: 'https://api/courses/1' } })).not.toBeNull();
  });

  it('scrubs request URLs and navigation', () => {
    const xhr = beforeBreadcrumb({ category: 'xhr', data: { url: `/uploads/v/${TOKEN}/videos/a.m3u8` } });
    expect(JSON.stringify(xhr)).not.toContain(TOKEN);
    const nav = beforeBreadcrumb({ category: 'navigation', data: { from: '/users?search=Иванов', to: `/watch/${TOKEN}` } });
    expect(JSON.stringify(nav)).not.toContain('Иванов');
    expect(JSON.stringify(nav)).not.toContain(TOKEN);
  });
});

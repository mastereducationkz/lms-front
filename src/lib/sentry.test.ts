import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import {
  FILTERED,
  beforeBreadcrumb,
  beforeSend,
  buildSentryUser,
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
    setSentryUser({ id: 1, email: 'anna@example.com', name: 'Анна', role: 'student' });
    setSentryUser(null);
  });
});

describe('scrubUrl removes secrets', () => {
  it.each([
    [`https://lmsapi.mastereducation.kz/uploads/v/${TOKEN}/videos/1/index.m3u8`, TOKEN],
    [`https://lmsapi.mastereducation.kz/uploads/s/${TOKEN}/x.jpg`, TOKEN],
    [`/class-materials/download/${TOKEN}`, TOKEN],
    ['https://lms.mastereducation.kz/watch/abc123short', 'abc123short'],
    ['/watch-links/abc123short', 'abc123short'],
    ['/calendar/feeds/me/abc123short.ics', 'abc123short'],
    ['https://bucket.s3.amazonaws.com/submissions/a.jpg?X-Amz-Signature=deadbeef&X-Amz-Credential=abc', 'deadbeef'],
    ['https://bucket.s3.amazonaws.com/submissions/a.jpg?X-Amz-Security-Token=deadbeef', 'deadbeef'],
    ['/download?Signature=deadbeef&Expires=1', 'deadbeef'],
    ['/auth/callback?code=onetime&state=s', 'onetime'],
    ['/auth/callback#access_token=abc', 'access_token'],
    ['/reset?token=abc123', 'abc123'],
    ['/api?access_token=one&refresh_token=two', 'one'],
    ['/api?api_key=abc', 'abc'],
    ['/api?apikey=abc', 'abc'],
    ['/api?secret=abc', 'abc'],
    ['/api?password=abc', 'abc'],
    ['/api?AUTH=abc', 'abc'],
    ['/api?sig=abc', 'abc'],
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

  it('stops masking emails: they stay visible in paths and queries', () => {
    expect(scrubUrl('/profile/anna.petrova@example.com')).toBe('/profile/anna.petrova@example.com');
    expect(scrubUrl('/users?email=anna@example.com')).toBe('/users?email=anna@example.com');
  });

  it('keeps non-secret query params, masks secret ones by name', () => {
    expect(scrubUrl('/users?search=Иванов&sort=name')).toBe('/users?search=Иванов&sort=name');
    expect(scrubUrl('/reset?token=abc')).toBe(`/reset?token=${FILTERED}`);
    expect(scrubUrl('/reset?email=a@b.kz&token=abc')).toBe(`/reset?email=a@b.kz&token=${FILTERED}`);
  });

  it('marks what it removed', () => {
    expect(scrubUrl('/watch/abc')).toBe(`/watch/${FILTERED}`);
  });
});

describe('scrubText', () => {
  it('cleans JWTs and bearer tokens anywhere', () => {
    expect(scrubText(`bad token ${TOKEN} here`)).not.toContain(TOKEN);
    expect(scrubText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123')).not.toContain('abcdefghijklmnop');
  });

  it('cleans embedded URLs, but keeps emails and non-secret query params in plain text', () => {
    const out = scrubText(`GET https://x.kz/class-materials/download/${TOKEN}?a=1 failed for anna@example.com`);
    expect(out).not.toContain(TOKEN);
    expect(out).toContain('anna@example.com');
    expect(out).toContain('a=1');
  });

  it('still masks a secret query param inside a URL embedded in a message', () => {
    const out = scrubText(`sync failed for https://x.kz/reset?token=abc123 (retry)`);
    expect(out).not.toContain('abc123');
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

describe('buildSentryUser (pure, no SDK)', () => {
  it('builds id/email/username plus the {{auto}} IP marker', () => {
    expect(buildSentryUser({ id: 7, email: 'anna@example.com', name: 'Анна', role: 'student' })).toEqual({
      id: '7',
      email: 'anna@example.com',
      username: 'Анна',
      ip_address: '{{auto}}',
    });
  });

  it('is what a logout sends to setUser: null in, null out', () => {
    expect(buildSentryUser(null)).toBeNull();
  });
});

describe('beforeSend keeps who was affected, still scrubs secrets', () => {
  it('keeps the user, ip marker and non-secret query; scrubs tokens and the Cookie header', () => {
    const event = {
      ...errorEvent('TypeError', 'failed for anna@example.com'),
      request: {
        url: `https://lms.mastereducation.kz/watch/${TOKEN}?x=1`,
        headers: { 'User-Agent': 'UA', Referer: `https://lms.mastereducation.kz/watch/${TOKEN}`, Cookie: 'a=b' },
        cookies: { a: 'b' },
        query_string: 'x=1',
      },
      user: { id: '7', email: 'anna@example.com', ip_address: '{{auto}}', username: 'Анна' },
      breadcrumbs: [
        { category: 'fetch', data: { url: `https://lmsapi.mastereducation.kz/class-materials/download/${TOKEN}` } },
        {
          category: 'console',
          level: 'error',
          message: 'sent reminder to anna@example.com',
          data: { arguments: [{ name: 'Анна' }] },
        },
      ],
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const blob = JSON.stringify(out);

    // Still scrubbed: the token, and the Cookie header/value (dropped, not just masked).
    for (const secret of [TOKEN, 'a=b']) expect(blob).not.toContain(secret);
    expect(Object.keys(out?.request ?? {}).sort()).toEqual(['headers', 'url']);
    expect(Object.keys(out?.request?.headers ?? {}).map((k) => k.toLowerCase())).not.toContain('cookie');

    // Now visible: the user (id/email/username/ip marker), the message email, the non-secret
    // query param, and the breadcrumb's own log line.
    expect(out?.user).toEqual({ id: '7', email: 'anna@example.com', ip_address: '{{auto}}', username: 'Анна' });
    expect(blob).toContain('anna@example.com');
    expect(blob).toContain('x=1');
    expect(out?.breadcrumbs?.[1]?.message).toBe('sent reminder to anna@example.com');
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

  it('scrubs token paths, keeps non-secret query values in navigation breadcrumbs', () => {
    const xhr = beforeBreadcrumb({ category: 'xhr', data: { url: `/uploads/v/${TOKEN}/videos/a.m3u8` } });
    expect(JSON.stringify(xhr)).not.toContain(TOKEN);
    const nav = beforeBreadcrumb({ category: 'navigation', data: { from: '/users?search=Иванов', to: `/watch/${TOKEN}` } });
    expect(nav?.data?.from).toBe('/users?search=Иванов');
    expect(JSON.stringify(nav)).not.toContain(TOKEN);
  });
});

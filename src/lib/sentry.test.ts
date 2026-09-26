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
    ['/tg/l/abc123short', 'abc123short'],
    ['/auth/callback?code=onetime&state=s', 'onetime'],
    ['/auth/callback#access_token=abc', 'access_token'],
    ['/reset?token=abc123', 'abc123'],
    ['/api?access_token=one&refresh_token=two', 'one'],
    ['/api?refresh_token=two', 'two'],
    ['/api?api_key=abc', 'abc'],
    ['/api?apikey=abc', 'abc'],
    ['/api?key=abc', 'abc'],
    ['/api?secret=abc', 'abc'],
    ['/api?password=abc', 'abc'],
    ['/api?AUTH=abc', 'abc'],
    ['/api?sig=abc', 'abc'],
    [`/x/${'a'.repeat(48)}`, 'a'.repeat(48)],
    ['wss://user:pa55word@proxy.local:1080/x', 'pa55word'],
    [`/anything/else?no=1&jwt=${TOKEN}`, TOKEN],
    [
      'https://api.telegram.org/bot123456789:AAFakeSecretValue1234567890abcXYZ/sendMessage',
      'AAFakeSecretValue1234567890abcXYZ',
    ],
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

  it('masks a Telegram bot token in a URL', () => {
    const out = scrubUrl('https://api.telegram.org/bot123456789:AAFakeSecretValue1234567890abcXYZ/sendMessage');
    expect(out).not.toContain('AAFakeSecretValue1234567890abcXYZ');
    expect(out).toContain('/bot');
  });

  describe('edge-case query structures (fix round 1)', () => {
    it('masks a secret param nested inside another param\'s value', () => {
      expect(scrubUrl('/go?next=/reset-password?token=NESTEDSECRET')).not.toContain('NESTEDSECRET');
    });

    it('decodes a percent-encoded secret param name before testing it', () => {
      expect(scrubUrl('/api?%74oken=ENCODEDSECRET1')).not.toContain('ENCODEDSECRET1');
      expect(scrubUrl('/api?access%5Ftoken=ENCODEDSECRET2')).not.toContain('ENCODEDSECRET2');
    });

    it('treats ; as a param separator', () => {
      const out = scrubUrl('/api?a=1;token=SEMISECRET');
      expect(out).not.toContain('SEMISECRET');
      expect(out).toContain('a=1');
    });

    it('strips a bracketed name before testing it', () => {
      expect(scrubUrl('/api?user[password]=BRACKETSECRET')).not.toContain('BRACKETSECRET');
    });

    it('still masks a secret param that comes after a stray quote earlier in the query', () => {
      // The value containing the `"` (`token`'s own) only gets masked up to that quote — real
      // tokens never contain one, so this is an accepted, deliberate limit, not a fix target —
      // but a later, separate secret param must not be orphaned by that truncation.
      expect(scrubUrl('/reset?token=abc"&secret=QUOTEDSECRET')).not.toContain('QUOTEDSECRET');
    });
  });

  describe('percent-encoded nested values (fix round 2)', () => {
    it('decodes and re-scrubs a nested query hidden behind one round of encoding', () => {
      const out = scrubUrl('/auth?next=%2Freset-password%3Ftoken%3DNESTEDENC1');
      expect(out).not.toContain('NESTEDENC1');
      expect(out).toContain('/reset-password'); // the non-secret part stays visible, decoded
    });

    it('decodes and re-scrubs a nested token path hidden behind encoding', () => {
      const out = scrubUrl('/go?redirect=%2Fwatch%2FNESTEDENC2');
      expect(out).not.toContain('NESTEDENC2');
      expect(out).toContain('/watch/');
    });

    it('leaves an ordinary percent-encoded value alone', () => {
      expect(scrubUrl('/search?q=%20hello%20world')).toBe('/search?q=%20hello%20world');
    });
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

  it('masks a Telegram bot token embedded in a message', () => {
    const out = scrubText(
      'webhook to https://api.telegram.org/bot123456789:AAFakeSecretValue1234567890abcXYZ/sendMessage failed',
    );
    expect(out).not.toContain('AAFakeSecretValue1234567890abcXYZ');
  });

  describe('secret params in a relative URL, no scheme (fix round 1)', () => {
    it('masks a query param in an exception-value-style message', () => {
      expect(scrubText('Request to /auth/callback?code=RELATIVESECRET1 failed')).not.toContain('RELATIVESECRET1');
    });

    it('masks a query param in a console-log-style message', () => {
      expect(scrubText('failed /reset-password?token=RELATIVESECRET2')).not.toContain('RELATIVESECRET2');
    });

    it('masks a fragment param in a navigation-style message', () => {
      expect(scrubText('navigate to /cb#access_token=RELATIVESECRET3')).not.toContain('RELATIVESECRET3');
    });
  });

  it('masks a JWT glued onto a preceding word (fix round 2)', () => {
    // JWT_RE has no leading \b (fix round 1) precisely so this matches: `\b` fails between two
    // word characters, and `_` counts as one, so "prefix_eyJ…" needs the anchor gone.
    const out = scrubText(`prefix_${TOKEN} in the log line`);
    expect(out).not.toContain(TOKEN);
  });

  it('decodes and strips brackets from param names in a relative URL too (fix round 2)', () => {
    // The old SECRET_PARAM_ANYWHERE_RE only matched an exact, literal secret name; the unified
    // scrubAnyParams now reuses isSecretParamName, so it decodes/strips brackets here exactly
    // like scrubQueryString already did for scrubUrl's own top-level query.
    expect(scrubText('GET /api?%74oken=RELSECRET5')).not.toContain('RELSECRET5');
    expect(scrubText('GET /api?user[password]=RELSECRET6')).not.toContain('RELSECRET6');
  });

  describe('percent-encoded nested values (fix round 2)', () => {
    it('decodes and re-scrubs a nested query hidden behind one round of encoding', () => {
      const out = scrubText('Redirecting to /auth?next=%2Freset-password%3Ftoken%3DNESTEDENC3 now');
      expect(out).not.toContain('NESTEDENC3');
    });

    it('decodes and re-scrubs a nested token path hidden behind encoding', () => {
      const out = scrubText('open /go?redirect=%2Fwatch%2FNESTEDENC4 please');
      expect(out).not.toContain('NESTEDENC4');
    });
  });

  describe('LONG_SEGMENT_RE on relative paths (fix round 2)', () => {
    it('masks a long opaque segment in a relative path with no scheme', () => {
      const out = scrubText(`failed /reset-password/${'a'.repeat(44)}`);
      expect(out).not.toContain('a'.repeat(44));
    });

    it('leaves ordinary prose alone', () => {
      const prose = 'The student reported that the lesson recording failed to load twice this week.';
      expect(scrubText(prose)).toBe(prose);
    });
  });
});

describe('perf: capped input length (fix round 2)', () => {
  const PERF_BUDGET_MS = 50;

  it('scrubUrl stays under budget on 60 KB of repeated "eyJ" (JWT_RE)', () => {
    const input = 'eyJ'.repeat(Math.ceil((60 * 1024) / 3));
    const t0 = Date.now();
    scrubUrl(input);
    expect(Date.now() - t0).toBeLessThan(PERF_BUDGET_MS);
  });

  it('scrubUrl stays under budget on 60 KB of repeated "a." (USERINFO_RE)', () => {
    const input = 'a.'.repeat(Math.ceil((60 * 1024) / 2));
    const t0 = Date.now();
    scrubUrl(input);
    expect(Date.now() - t0).toBeLessThan(PERF_BUDGET_MS);
  });

  it('scrubUrl stays under budget on a 60 KB bracketed param name with no closing bracket', () => {
    const input = `/api?${'['.repeat(60 * 1024)}=x`;
    const t0 = Date.now();
    scrubUrl(input);
    expect(Date.now() - t0).toBeLessThan(PERF_BUDGET_MS);
  });

  it('scrubText stays under budget on the same three adversarial inputs', () => {
    const inputs = [
      'eyJ'.repeat(Math.ceil((60 * 1024) / 3)),
      'a.'.repeat(Math.ceil((60 * 1024) / 2)),
      `/api?${'['.repeat(60 * 1024)}=x`,
    ];
    for (const input of inputs) {
      const t0 = Date.now();
      scrubText(input);
      expect(Date.now() - t0).toBeLessThan(PERF_BUDGET_MS);
    }
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

  it('omits username for an empty name rather than sending ""', () => {
    const user = buildSentryUser({ id: 7, email: 'anna@example.com', name: '', role: 'student' });
    expect(user?.username).toBeUndefined();
    // toEqual (not toStrictEqual): an explicit `username: undefined` and a missing key are the
    // same thing to JSON.stringify, which is what actually goes over the wire to Sentry.
    expect(user).toEqual({ id: '7', email: 'anna@example.com', ip_address: '{{auto}}' });
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

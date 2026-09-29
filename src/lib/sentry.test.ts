import { describe, expect, it } from 'vitest';
import type { ErrorEvent, EventHint } from '@sentry/react';
import type { QueryParams, SpanJSON, TransactionEvent } from '@sentry/core';
import {
  FILTERED,
  beforeBreadcrumb,
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  buildSentryInitOptions,
  buildSentryUser,
  isIgnoredEvent,
  reportError,
  scrubAnyParams,
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

describe('the 2 KB cut never leaves a partial secret visible (fix round 3)', () => {
  // sentry.ts's MAX_SCRUB_LENGTH. Kept in sync here rather than exported: if it ever changes,
  // these tests should be re-tuned deliberately, not silently stop straddling the cut.
  const CUT = 2048;

  /** Pads with spaces (never "token-ish", so capLength's trim-back always stops exactly at the
   *  padding, predictably) so `secretShape` starts `CUT - offsetIntoSecret` characters in — the
   *  cut then lands `offsetIntoSecret` characters into the shape, i.e. genuinely mid-secret. */
  function straddling(secretShape: string, offsetIntoSecret: number): string {
    return ' '.repeat(CUT - offsetIntoSecret) + secretShape;
  }

  it('drops a long opaque segment straddling the cut, not a partial fragment of it', () => {
    const shape = `/${'B'.repeat(60)}`;
    const out = scrubUrl(straddling(shape, 30) + ' tail');
    expect(out).not.toContain('B'.repeat(15));
  });

  it('drops a userinfo password straddling the cut, not a partial fragment of it', () => {
    const shape = 'wss://user:SUPERSECRETPASSWORDVALUE@proxy.local:1080/x';
    const out = scrubUrl(straddling(shape, 25));
    expect(out).not.toContain('SUPERSECRETPASSWORDVALUE');
    expect(out).not.toContain('SUPERSECRETPASS');
  });

  it('drops a JWT straddling the cut, not a partial fragment of it', () => {
    const shape = `eyJ${'A'.repeat(80)}.${'B'.repeat(80)}.${'C'.repeat(20)}`;
    const out = scrubText(straddling(shape, 100));
    expect(out).not.toContain('A'.repeat(15));
    expect(out).not.toContain('B'.repeat(15));
  });

  it('drops a Bearer token straddling the cut, not a partial fragment of it', () => {
    const shape = `Bearer ${'D'.repeat(60)}`;
    const out = scrubText(straddling(shape, 30));
    expect(out).not.toContain('D'.repeat(15));
  });

  it('drops a token-path route straddling the cut, not a partial fragment of it', () => {
    const shape = `/watch/${'E'.repeat(60)}`;
    const out = scrubUrl(straddling(shape, 30));
    expect(out).not.toContain('E'.repeat(15));
  });

  it('drops a ?token= value straddling the cut, not a partial fragment of it', () => {
    const shape = `/reset?token=${'F'.repeat(60)}`;
    const out = scrubUrl(straddling(shape, 30));
    expect(out).not.toContain('F'.repeat(15));
  });

  it('drops an RFC 3986 sub-delim password straddling the cut (fix round 4)', () => {
    // !, $ and , are legal raw in URL userinfo and were missing from the back-off character
    // class — a cut landing right after one of them stopped there, leaving everything before it
    // (here, "Sup3r") visible.
    const shape = 'https://admin:Sup3r!S3cret,Value$More@host/path';
    const out = scrubUrl(straddling(shape, 20));
    expect(out).not.toContain('Sup3r');
    expect(out).not.toContain('S3cret');
  });
});

describe('scrubAnyParams masks a secret value through a literal ? too (fix round 3)', () => {
  it('masks the rest of a secret value after a literal ? in plain text', () => {
    const out = scrubText('failed /x?token=abc?SECRET1');
    expect(out).not.toContain('SECRET1');
  });

  it('masks the rest of a secret value after a literal ? in a fragment', () => {
    const out = scrubText('navigate to /cb#access_token=abc?SECRET2');
    expect(out).not.toContain('SECRET2');
  });

  it('keeps round 1s nested-query test green: a non-secret name does not swallow the nested secret', () => {
    // The fix for the two cases above widened the value match for SECRET names only; a
    // non-secret name (here "next") must still stop at a literal nested "?" and let the
    // regex find the nested param on its own, or this would regress.
    expect(scrubUrl('/go?next=/reset-password?token=NESTEDSECRET3')).not.toContain('NESTEDSECRET3');
  });
});

describe('scrubAnyParams loops instead of recursing, so it cannot overflow the stack (fix round 4)', () => {
  it('handles 60 KB of "?a=?a=…" — uncapped, well past MAX_SCRUB_LENGTH — without throwing', () => {
    // Every non-secret "a=" hop used to be one level of recursion; called directly (bypassing
    // scrubUrl/scrubText, which always cap input first) with input this size, that would have
    // been on the order of 20,000 stack frames and thrown RangeError long before finishing.
    const input = '?a='.repeat(Math.ceil((60 * 1024) / 3));
    let result: string | undefined;
    expect(() => {
      result = scrubAnyParams(input);
    }).not.toThrow();
    expect(result).toBeDefined();
  });

  // A wall-clock budget on one input size is load-sensitive (this machine's shared with many
  // concurrent, unrelated CPU-heavy processes) and, worse, doesn't actually catch a moderately
  // quadratic regression: it only fails once the absolute time crosses the budget, whatever the
  // shape. Comparing CPU time (immune to scheduling noise) at two input sizes catches the *shape*
  // instead — a linear implementation costs about the same ratio as the size ratio (8x KB -> ~8x
  // cost), a quadratic one costs roughly the square (~64x). The old 2000ms wall-clock budget let
  // a 776ms quadratic regression pass right through (round 3's design: a `?`-inclusive value
  // class, with non-secret values split at the `?` and the rest re-scanned; the ratio test
  // measured 56-71 on it). Widening the class alone on today's loop is not quadratic.
  it('scrubAnyParams scales linearly on uncapped input (CPU-time ratio, load-robust)', () => {
    type Cpu = { user: number; system: number };
    const proc = (globalThis as unknown as { process: { cpuUsage(prev?: Cpu): Cpu } }).process;
    const cpuMs = (s: string) => { const a = proc.cpuUsage(); scrubAnyParams(s); const d = proc.cpuUsage(a); return (d.user + d.system) / 1000; };
    const at = (kb: number) => '?a='.repeat(Math.ceil((kb * 1024) / 3));
    const small = at(8), big = at(64);
    scrubAnyParams(small); scrubAnyParams(big); // JIT warm-up
    let s = Infinity, b = Infinity;
    for (let i = 0; i < 5; i++) { s = Math.min(s, cpuMs(small)); b = Math.min(b, cpuMs(big)); } // interleaved best-of-5
    expect(b / Math.max(s, 0.05)).toBeLessThan(20); // linear ~7-14 measured; round-3 shape 56-71
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

  describe('Telegram in-app browser postEvent bridge (LMS-FRONT-3)', () => {
    it('drops the exact observed message with no stack at all', () => {
      const ev = { exception: { values: [{ type: 'Error', value: 'Error invoking postEvent: Method not found' }] } } as ErrorEvent;
      expect(isIgnoredEvent(ev)).toBe(true);
    });

    it('drops it when the (only) frame is anonymous/injected', () => {
      expect(isIgnoredEvent(errorEvent('Error', 'Error invoking postEvent: Method not found', '<anonymous>'))).toBe(true);
    });

    it('drops any postEvent bridge message, not just "Method not found"', () => {
      expect(isIgnoredEvent(errorEvent('Error', 'Error invoking postEvent: some other reason', '<anonymous>'))).toBe(true);
    });

    it('drops it when the only /assets/ frame is Sentry\'s own wrapper chunk (the real event)', () => {
      // Sentry's browserapierrors setTimeout wrapper is what the observed event's stack held,
      // next to the injected `<anonymous>` frame: it is served from /assets/ but is not ours.
      const ev = {
        exception: {
          values: [
            {
              type: 'Error',
              value: 'Error invoking postEvent: Method not found',
              stacktrace: {
                frames: [
                  { filename: 'https://lms.mastereducation.kz/assets/sentryClient-CvR-mHnV.js', function: 'r' },
                  { filename: '<anonymous>', lineno: 233 },
                ],
              },
            },
          ],
        },
      } as ErrorEvent;
      expect(isIgnoredEvent(ev)).toBe(true);
    });

    it('still keeps a real bug whose stack passes through the Sentry wrapper and our code', () => {
      const ev = {
        exception: {
          values: [
            {
              type: 'TypeError',
              value: "Cannot read properties of undefined (reading 'map')",
              stacktrace: {
                frames: [
                  { filename: 'https://lms.mastereducation.kz/assets/sentryClient-CvR-mHnV.js', function: 'r' },
                  { filename: 'https://lms.mastereducation.kz/assets/LessonPage-abc123.js', function: 'render' },
                ],
              },
            },
          ],
        },
      } as ErrorEvent;
      expect(isIgnoredEvent(ev)).toBe(false);
    });

    it('keeps the same message when it is actually thrown from our own bundle', () => {
      // Default `errorEvent` filename is under /assets/ — i.e. one of our own frames.
      expect(isIgnoredEvent(errorEvent('Error', 'Error invoking postEvent: Method not found'))).toBe(false);
    });

    it('keeps an unrelated error untouched by this filter', () => {
      expect(isIgnoredEvent(errorEvent('TypeError', "Cannot read properties of undefined (reading 'map')"))).toBe(false);
    });
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

// ----------------------------------------------------------------------------------------------
// Addendum B: transactions and spans aren't sent today (tracing is off — see the guard test at
// the bottom of this file), but a future flip to tracesSampleRate/tracesSampler must not silently
// ship an unscrubbed path. SAT's incident (46k pageload/navigation spans holding SSO codes and
// handoff tokens verbatim) is exactly that failure mode, so this is tested now, before it exists.
// ----------------------------------------------------------------------------------------------

describe('beforeSendTransaction scrubs transactions the same way beforeSend does (Addendum B)', () => {
  it('masks every secret-bearing field, keeps state= and db.statement visible', () => {
    const event = {
      type: 'transaction',
      transaction: `GET /watch/${TOKEN}`,
      request: {
        url: 'https://lms.mastereducation.kz/auth/callback?code=SSOCODE1&state=STATEVALUE',
        query_string: 'code=SSOCODE2&state=STATEVALUE',
        headers: { 'User-Agent': 'UA', Cookie: 'a=b' },
      },
      contexts: {
        trace: {
          span_id: 'aaaaaaaaaaaaaaaa',
          trace_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          data: { 'http.url': '/auth/handoff?token=HANDOFFSECRET', 'db.statement': 'select 1' },
        },
      },
      spans: [
        {
          span_id: 'cccccccccccccccc',
          trace_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          start_timestamp: 0,
          description: 'switch to SAT #switch=SWITCHSECRET',
          data: { url: `/watch/${TOKEN}`, 'http.query': 'x=1', 'db.statement': 'select 2' },
        },
      ],
      tags: { route: '/reset?token=TAGSECRET' },
    } as unknown as TransactionEvent;

    const out = beforeSendTransaction(event, {} as EventHint);
    const blob = JSON.stringify(out);

    for (const secret of [TOKEN, 'SSOCODE1', 'SSOCODE2', 'HANDOFFSECRET', 'SWITCHSECRET', 'TAGSECRET', 'a=b']) {
      expect(blob).not.toContain(secret);
    }
    expect(blob).toContain('STATEVALUE'); // code= masked, state= stays (SSO callback policy)
    expect(blob).toContain('select 1'); // db.statement stays: trace context data
    expect(blob).toContain('select 2'); // db.statement stays: span data
  });

  it.each([
    ['SSO code, state stays', 'https://lms.mastereducation.kz/auth/callback?code=X&state=Y', 'X', 'Y'],
    ['handoff token', '/auth/handoff?token=X', 'X', null],
    ['token-path route', `/watch/${TOKEN}`, TOKEN, null],
  ])('%s: request.url is masked', (_label, url, leaked, kept) => {
    const out = beforeSendTransaction({ type: 'transaction', request: { url } } as unknown as TransactionEvent, {} as EventHint);
    expect(JSON.stringify(out)).not.toContain(leaked);
    if (kept) expect(JSON.stringify(out)).toContain(kept);
  });

  it('scrubs a query_string given as {name: value} or [name, value][], not just a string', () => {
    const objForm = beforeSendTransaction(
      { type: 'transaction', request: { query_string: { code: 'OBJSECRET', state: 'OBJSTATE' } } } as unknown as TransactionEvent,
      {} as EventHint,
    );
    expect(JSON.stringify(objForm)).not.toContain('OBJSECRET');
    expect(JSON.stringify(objForm)).toContain('OBJSTATE');

    const arrForm = beforeSendTransaction(
      {
        type: 'transaction',
        request: { query_string: [['code', 'ARRSECRET'], ['state', 'ARRSTATE']] as QueryParams },
      } as unknown as TransactionEvent,
      {} as EventHint,
    );
    expect(JSON.stringify(arrForm)).not.toContain('ARRSECRET');
    expect(JSON.stringify(arrForm)).toContain('ARRSTATE');
  });
});

describe('beforeSendSpan scrubs a standalone span the same way (Addendum B)', () => {
  it('masks a secret in description and in data values, keeps db.statement', () => {
    const span = {
      span_id: 'dddddddddddddddd',
      trace_id: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      start_timestamp: 0,
      description: `GET /watch/${TOKEN}`,
      data: {
        url: 'https://lms.mastereducation.kz/auth/callback?code=SPANSSOSECRET&state=SPANSTATE',
        'http.url': '/auth/handoff?token=SPANHANDOFFSECRET',
        'db.statement': 'select 3',
      },
    } as unknown as SpanJSON;

    const out = beforeSendSpan(span);
    const blob = JSON.stringify(out);

    for (const secret of [TOKEN, 'SPANSSOSECRET', 'SPANHANDOFFSECRET']) {
      expect(blob).not.toContain(secret);
    }
    expect(blob).toContain('SPANSTATE');
    expect(blob).toContain('select 3');
  });
});

describe('tracing stays off until someone deliberately turns it on (Addendum B guard)', () => {
  it('the init options carry no tracesSampleRate or tracesSampler', () => {
    const options = buildSentryInitOptions() as Record<string, unknown>;
    expect(options).not.toHaveProperty('tracesSampleRate');
    expect(options).not.toHaveProperty('tracesSampler');
    // And they ARE registered, so turning tracing on later doesn't also silently turn on an
    // unscrubbed transaction/span path.
    expect(options.beforeSendTransaction).toBe(beforeSendTransaction);
    expect(options.beforeSendSpan).toBe(beforeSendSpan);
  });
});

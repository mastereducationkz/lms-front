import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent, EventHint } from '@sentry/react';
import { beforeSend, buildSentryInitOptions } from './sentry';
import {
  AxiosReportBudget,
  MAX_REPORTS_PER_PAGE,
  axiosFingerprint,
  axiosReports,
  ignoredAxiosRule,
  ignoredBy,
  routeTemplate,
  type AxiosLike,
} from './sentryFilters';

const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJpdGVtIjo0Mn0.c2lnbmF0dXJl';

const axiosError = (fields: Omit<AxiosLike, 'isAxiosError'>): AxiosLike => ({ isAxiosError: true, ...fields });
const failed = (status: number, url = '/courses/12/lessons/45', method = 'get') =>
  axiosError({ code: status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config: { method, url }, response: { status } });

const event = (type = 'AxiosError', value = 'Request failed with status code 404'): ErrorEvent =>
  ({
    type: undefined,
    exception: { values: [{ type, value, stacktrace: { frames: [{ filename: 'https://lms.mastereducation.kz/assets/index.js' }] } }] },
  }) as ErrorEvent;
const send = (error: AxiosLike, ev = event()) => beforeSend(ev, { originalException: error } as EventHint);

beforeEach(() => axiosReports.reset());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('failed API calls that are never reported', () => {
  it.each([
    ['a cancelled request', axiosError({ code: 'ERR_CANCELED' }), 'axios_canceled'],
    ['a 401: the client logs the user in again', failed(401), 'axios_401'],
    ['no answer at all (a flaky connection)', axiosError({ code: 'ERR_NETWORK', config: { url: '/courses' } }), 'axios_network'],
  ])('%s', (_name, error, rule) => {
    expect(ignoredAxiosRule(error, true)).toBe(rule);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(send(error)).toBeNull();
  });

  it('anything while the browser says it is offline', () => {
    expect(ignoredAxiosRule(failed(500), false)).toBe('axios_offline');
    vi.stubGlobal('navigator', { onLine: false });
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(send(failed(500))).toBeNull();
    expect(ignoredBy(event(), { originalException: failed(404) } as EventHint)).toBe('axios_offline');
  });

  it('only the axios rules decide an axios error: no frame of ours is not a reason to drop it', () => {
    const frameless = { exception: { values: [{ type: 'AxiosError', value: 'Request failed with status code 404', stacktrace: { frames: [{ filename: '<anonymous>' }] } }] } } as ErrorEvent;
    expect(ignoredBy(frameless, { originalException: failed(404) } as EventHint)).toBeNull();
  });
});

describe('failed API calls that are reported', () => {
  it('as a warning grouped by method, route, status', () => {
    const out = send(failed(404, '/courses/12/lessons/45?search=Иванов', 'post'));
    expect(out?.level).toBe('warning');
    expect(out?.fingerprint).toEqual(['axios', 'POST', '/courses/:id/lessons/:id', '404']);
  });

  it.each([400, 403, 404, 422])('%s is reported', (status) => {
    expect(send(failed(status, `/x${status}`))?.fingerprint?.[3]).toBe(String(status));
  });

  it('a timeout is reported by its code', () => {
    const timeout = axiosError({ code: 'ECONNABORTED', config: { method: 'put', url: '/uploads/chunk' } });
    expect(send(timeout, event('AxiosError', 'timeout of 20000ms exceeded'))?.fingerprint).toEqual(['axios', 'PUT', '/uploads/chunk', 'ECONNABORTED']);
  });

  it('once per fingerprint per page load', () => {
    expect(send(failed(404))).not.toBeNull();
    expect(send(failed(404))).toBeNull();
    expect(send(failed(404, '/groups/7'))).not.toBeNull();
  });

  it(`at most ${MAX_REPORTS_PER_PAGE} per page load`, () => {
    const sent = Array.from({ length: 8 }, (_, i) => send(failed(404, `/route-${'abcdefgh'[i]}`))).filter(Boolean);
    expect(sent).toHaveLength(MAX_REPORTS_PER_PAGE);
  });

  it('a 5xx for a quarter of page loads, decided once per fingerprint', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(send(failed(502))).toBeNull();
    random.mockReturnValue(0.1);
    expect(send(failed(502))).toBeNull(); // the same page load already rolled for this one
    expect(send(failed(503, '/groups'))?.fingerprint).toEqual(['axios', 'GET', '/groups', '503']);
  });

  it('the budget is per instance, so a fresh page load starts over', () => {
    const budget = new AxiosReportBudget(1);
    expect(budget.admit(['axios', 'GET', '/a', '404'], 404)).toBe('send');
    expect(budget.admit(['axios', 'GET', '/b', '404'], 404)).toBe('budget');
    budget.reset();
    expect(budget.admit(['axios', 'GET', '/b', '404'], 404)).toBe('send');
  });
});

describe('fingerprints carry no query string, token or id', () => {
  it.each([
    ['/courses/12/lessons/45?token=abc&page=2', '/courses/:id/lessons/:id'],
    [`/class-materials/download/${TOKEN}`, '/class-materials/download/:id'],
    [`/uploads/s/${TOKEN}/homework.pdf`, '/uploads/s/:id/:id'],
    ['https://lmsapi.mastereducation.kz/users/by-email/anna@example.com#x', '/users/by-email/:id'],
    ['/students/0b7c8d2e-1f3a-4c5d-9e8f-123456789abc/report', '/students/:id/report'],
    ['/search/%D0%98%D0%B2%D0%B0%D0%BD', '/search/:id'],
    ['', '/'],
  ])('%s', (url, route) => {
    const fingerprint = send(failed(404, url))?.fingerprint ?? [];
    expect(fingerprint[2]).toBe(route);
    const joined = fingerprint.join(' ');
    for (const leaked of ['?', '#', 'abc', 'eyJ', 'anna', '12', '%D0']) expect(joined).not.toContain(leaked);
  });

  it('builds the route from a URL that went through scrubUrl', () => {
    // A token-path route is masked by scrubUrl, then cut down: the token never reaches routeTemplate raw.
    expect(routeTemplate(`/watch/[Filtered]`)).toBe('/watch/:id');
    expect(axiosFingerprint(axiosError({ code: 'weird code!', config: { method: 'get<x>' } }), '/a')).toEqual(['axios', 'OTHER', '/a', 'unknown']);
  });
});

describe('a 1% sample of the noise is still sent, tagged with the rule that dropped it', () => {
  it('sends the sampled event at level info, grouped by rule, still scrubbed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.005);
    const noise = beforeSend(event('Error', `ResizeObserver loop completed with undelivered notifications. ${TOKEN}`), {});
    expect(noise?.level).toBe('info');
    expect(noise?.tags?.dropped_by).toBe('message:ResizeObserver loop');
    expect(noise?.fingerprint).toEqual(['dropped', 'message:ResizeObserver loop']);
    expect(JSON.stringify(noise)).not.toContain(TOKEN);
  });

  it.each([
    ['type', event('ChunkLoadError', 'Loading chunk 7 failed'), {}, 'type:ChunkLoadError'],
    ['no frame of ours', { exception: { values: [{ type: 'TypeError', value: `x ${TOKEN}`, stacktrace: { frames: [{ filename: '<anonymous>' }] } }] } } as ErrorEvent, {}, 'no_app_frame'],
    ['axios', event(), { originalException: axiosError({ code: 'ERR_CANCELED' }) }, 'axios_canceled'],
  ])('%s', (_name, ev, hint, rule) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.005);
    const out = beforeSend(ev, hint as EventHint);
    expect(out?.tags?.dropped_by).toBe(rule);
    expect(JSON.stringify(out)).not.toContain(TOKEN);
  });

  it('drops the other 99%', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.01);
    expect(beforeSend(event('Error', 'ResizeObserver loop limit exceeded'), {})).toBeNull();
  });

  it('a real bug is not noise and is never sampled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const out = beforeSend(event('TypeError', "Cannot read properties of undefined (reading 'map')"), {});
    expect(out).not.toBeNull();
    expect(out?.tags?.dropped_by).toBeUndefined();
  });

  it('the SDK no longer drops the noise before beforeSend: no ignoreErrors', () => {
    const options = buildSentryInitOptions() as Record<string, unknown>;
    expect(options).not.toHaveProperty('ignoreErrors');
    expect(options.denyUrls).toHaveLength(1);
  });
});

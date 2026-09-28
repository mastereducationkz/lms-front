import { describe, expect, it } from 'vitest';
import { ApiError, createClient, SessionLost, type FetchLike } from './api';
import { TokenStore } from './tokens';

const BASE = 'https://api.test';

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
}

function harness(handler: Handler, tokens = new TokenStore(() => null)) {
  const calls: { url: string; auth: string | null; body: string | null; credentials?: RequestCredentials }[] = [];
  const fetch: FetchLike = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    calls.push({ url, auth: headers.get('Authorization'), body: (init.body as string) ?? null, credentials: init.credentials });
    return handler(url, init);
  };
  return { client: createClient({ base: BASE, tokens, fetch }), calls, tokens };
}

describe('the panel API client', () => {
  it('sends the Bearer token and never cookies', async () => {
    const { client, calls, tokens } = harness(() => json(200, { ok: 1 }));
    tokens.set('A1', 'R1');
    expect(await client.request('/lessons/5')).toEqual({ ok: 1 });
    expect(calls).toEqual([{ url: `${BASE}/lessons/5`, auth: 'Bearer A1', body: null, credentials: 'omit' }]);
  });

  it('refreshes once on a 401 and retries with the new token', async () => {
    const { client, calls, tokens } = harness((url, init) => {
      if (url.endsWith('/auth/refresh')) return json(200, { access_token: 'A2', refresh_token: 'R2' });
      return new Headers(init.headers).get('Authorization') === 'Bearer A2' ? json(200, { ok: 2 }) : json(401);
    });
    tokens.set('A1', 'R1');
    expect(await client.request('/lessons/5')).toEqual({ ok: 2 });
    expect(calls.map((c) => c.url)).toEqual([`${BASE}/lessons/5`, `${BASE}/auth/refresh`, `${BASE}/lessons/5`]);
    expect(JSON.parse(calls[1].body!)).toEqual({ refresh_token: 'R1' });
    expect(tokens.accessToken).toBe('A2');
    expect(tokens.refreshToken).toBe('R2');
  });

  it('shares one refresh between requests that hit a 401 together', async () => {
    let refreshes = 0;
    const { client, tokens } = harness(async (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        refreshes += 1;
        await new Promise((r) => setTimeout(r, 5));
        return json(200, { access_token: 'A2', refresh_token: 'R2' });
      }
      return new Headers(init.headers).get('Authorization') === 'Bearer A2' ? json(200, {}) : json(401);
    });
    tokens.set('A1', 'R1');
    await Promise.all([client.request('/a'), client.request('/b'), client.request('/c')]);
    expect(refreshes).toBe(1);
  });

  it('starts from the stored refresh token after a reload (no access token yet)', async () => {
    const tokens = new TokenStore(() => null);
    tokens.set('old', 'R1');
    const reloaded = harness((url) => (url.endsWith('/auth/refresh')
      ? json(200, { access_token: 'A2', refresh_token: 'R2' }) : json(200, { ok: true })), tokens);
    // Simulate a page reload: memory is gone, storage (here: the store's own copy) is not.
    (tokens as unknown as { access: string | null }).access = null;
    expect(await reloaded.client.request('/x')).toEqual({ ok: true });
    expect(reloaded.calls[0].url).toBe(`${BASE}/auth/refresh`);
  });

  it('a refused refresh signs the panel out', async () => {
    const { client, tokens } = harness((url) => (url.endsWith('/auth/refresh') ? json(401) : json(401)));
    tokens.set('A1', 'R1');
    await expect(client.request('/x')).rejects.toBeInstanceOf(SessionLost);
    expect(tokens.refreshToken).toBeNull();
  });

  it('a refresh that fails for another reason keeps the session for later', async () => {
    const { client, tokens } = harness((url) => (url.endsWith('/auth/refresh') ? json(502) : json(401)));
    tokens.set('A1', 'R1');
    const error = await client.request('/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(tokens.refreshToken).toBe('R1');
  });

  it('without any token it asks for a sign-in without calling anyone', async () => {
    const { client, calls } = harness(() => json(200, {}));
    await expect(client.request('/x')).rejects.toBeInstanceOf(SessionLost);
    expect(calls).toEqual([]);
  });

  it('passes the backend detail through on other errors, and null for a 204', async () => {
    const { client, tokens } = harness((url) => (url.endsWith('/gone') ? json(403, { detail: 'Нет доступа к этому уроку' }) : json(204)));
    tokens.set('A1', 'R1');
    await expect(client.request('/gone')).rejects.toMatchObject({ status: 403, message: 'Нет доступа к этому уроку' });
    expect(await client.request('/empty', { method: 'PUT', body: '{}' })).toBeNull();
  });

  it('anonymous calls carry no token and report status and body', async () => {
    const { client, calls, tokens } = harness(() => json(201, { handoff_id: 'x' }));
    tokens.set('A1', 'R1');
    expect(await client.anonymous('/auth/addon-handoff', { meeting_code: null })).toEqual({ status: 201, data: { handoff_id: 'x' } });
    expect(calls[0].auth).toBeNull();
    expect(calls[0].credentials).toBe('omit');
  });
});

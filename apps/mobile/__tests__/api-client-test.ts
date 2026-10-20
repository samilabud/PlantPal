import { z } from 'zod';

import { ApiError, createApiClient } from '@/api/client';

const Schema = z.object({ ok: z.boolean() });

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('returns parsed data on success and calls the right URL', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await expect(client.request('/x', { schema: Schema })).resolves.toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/x',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sends a JSON body with the content type', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ ok: true }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await client.request('/x', { method: 'POST', body: { a: 1 }, schema: Schema });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('maps the standard error body to an http ApiError', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: 'not_found', message: 'Nope' } }, 404));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await expect(client.request('/x', { schema: Schema })).rejects.toMatchObject({
      kind: 'http',
      status: 404,
      code: 'not_found',
      message: 'Nope',
    });
  });

  it('rejects a response that breaks the contract', async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse({ ok: 'yes' }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    await expect(client.request('/x', { schema: Schema })).rejects.toMatchObject({
      kind: 'invalid_response',
    });
  });

  it('wraps network failures', async () => {
    const fetchFn = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });

    const error = await client.request('/x', { schema: Schema }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });

  it('times out slow requests', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn: fetchFn as typeof fetch,
    });

    await expect(client.request('/x', { schema: Schema, timeoutMs: 10 })).rejects.toMatchObject({
      kind: 'timeout',
    });
  });
});

describe('createApiClient with auth hooks', () => {
  const ok = () => jsonResponse({ ok: true });
  const unauthorized = () => jsonResponse({ error: { code: 'unauthorized', message: 'no' } }, 401);
  const authHeader = (fetchFn: jest.Mock, call: number) =>
    (fetchFn.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

  it('sends the bearer token', async () => {
    const fetchFn = jest.fn().mockResolvedValue(ok());
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn,
      auth: { getAccessToken: async () => 'token-1', refreshAccessToken: async () => null },
    });
    await client.request('/x', { schema: Schema });
    expect(authHeader(fetchFn, 0).Authorization).toBe('Bearer token-1');
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    const fetchFn = jest.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());
    const refreshAccessToken = jest.fn(async () => 'token-2');
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn,
      auth: { getAccessToken: async () => 'token-1', refreshAccessToken },
    });

    await expect(client.request('/x', { schema: Schema })).resolves.toEqual({ ok: true });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(authHeader(fetchFn, 1).Authorization).toBe('Bearer token-2');
  });

  it('gives up with the 401 when the refresh fails (no retry loop)', async () => {
    const fetchFn = jest.fn().mockResolvedValue(unauthorized());
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn,
      auth: { getAccessToken: async () => 'token-1', refreshAccessToken: async () => null },
    });
    await expect(client.request('/x', { schema: Schema })).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('skips auth for public endpoints', async () => {
    const fetchFn = jest.fn().mockResolvedValue(ok());
    const getAccessToken = jest.fn(async () => 'token-1');
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetchFn,
      auth: { getAccessToken, refreshAccessToken: async () => null },
    });
    await client.request('/x', { schema: Schema, auth: false });
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(authHeader(fetchFn, 0).Authorization).toBeUndefined();
  });

  it("passes the error body's details through", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: { code: 'identify_limit', message: 'x', details: { limit: 3 } } },
          429,
        ),
      );
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn });
    const error = await client.request('/x', { schema: Schema }).catch((e) => e);
    expect(error).toMatchObject({ code: 'identify_limit', details: { limit: 3 } });
  });

  it('can be cancelled by the caller, which is not a timeout', async () => {
    const fetchFn = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetchFn: fetchFn as never });
    const controller = new AbortController();
    const pending = client.request('/x', { schema: Schema, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: 'cancelled' });
  });
});

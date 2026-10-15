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

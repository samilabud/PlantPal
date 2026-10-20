import { ApiErrorBody } from '@plantpal/shared';
import type { z } from 'zod';

/** One error type for every failure, so screens only handle `ApiError`. */
export class ApiError extends Error {
  constructor(
    public readonly kind: 'network' | 'timeout' | 'cancelled' | 'http' | 'invalid_response',
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    /** Extra facts from the server's error body, e.g. a limit and when it resets. */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Send the access token. Defaults to true when the client has auth hooks. */
  auth?: boolean;
  body?: unknown;
  /** Zod schema the response must match. The return type comes from it. */
  schema: z.ZodType<T>;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Lets the caller cancel (e.g. a "Cancel" button); ends with ApiError kind 'cancelled'. */
  signal?: AbortSignal;
};

/** How the client gets tokens. Kept as hooks so the client knows nothing about storage. */
export type AuthHooks = {
  /** A valid access token, refreshing first if it is about to expire. Null when signed out. */
  getAccessToken: () => Promise<string | null>;
  /** Force a refresh after a 401. Null means the session is over. */
  refreshAccessToken: () => Promise<string | null>;
};

export type ApiClient = {
  request<T>(path: string, options: RequestOptions<T>): Promise<T>;
};

/**
 * A small typed fetch wrapper. Every response is validated with Zod, so a server change
 * that breaks the contract shows up as a clear error instead of `undefined` in the UI.
 * With auth hooks it adds `Authorization: Bearer`, and on a 401 refreshes once and retries once.
 */
export function createApiClient(config: {
  baseUrl: string;
  fetchFn?: typeof fetch;
  defaultTimeoutMs?: number;
  auth?: AuthHooks;
}): ApiClient {
  const fetchFn = config.fetchFn ?? fetch;

  async function send<T>(path: string, options: RequestOptions<T>, token: string | null) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? config.defaultTimeoutMs ?? 10_000,
    );
    const cancel = () => controller.abort();
    if (options.signal?.aborted) cancel();
    options.signal?.addEventListener('abort', cancel);

    let response: Response;
    try {
      response = await fetchFn(`${config.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw new ApiError('cancelled', 'The request was cancelled');
      if (controller.signal.aborted) throw new ApiError('timeout', 'The request timed out');
      throw new ApiError('network', error instanceof Error ? error.message : 'Network error');
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }

    return response;
  }

  async function parse<T>(path: string, response: Response, schema: z.ZodType<T>): Promise<T> {
    const json: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const parsed = ApiErrorBody.safeParse(json);
      throw new ApiError(
        'http',
        parsed.success ? parsed.data.error.message : `Request failed with ${response.status}`,
        response.status,
        parsed.success ? parsed.data.error.code : undefined,
        parsed.success ? parsed.data.error.details : undefined,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError('invalid_response', `Unexpected response from ${path}`, response.status);
    }
    return parsed.data;
  }

  return {
    async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
      const useAuth = Boolean(config.auth) && options.auth !== false;
      const token = useAuth ? await config.auth!.getAccessToken() : null;
      let response = await send(path, options, token);

      if (response.status === 401 && useAuth) {
        const fresh = await config.auth!.refreshAccessToken();
        if (fresh) response = await send(path, options, fresh);
      }
      return parse(path, response, options.schema);
    },
  };
}

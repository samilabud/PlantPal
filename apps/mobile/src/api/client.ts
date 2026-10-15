import { ApiErrorBody } from '@plantpal/shared';
import type { z } from 'zod';

/** One error type for every failure, so screens only handle `ApiError`. */
export class ApiError extends Error {
  constructor(
    public readonly kind: 'network' | 'timeout' | 'http' | 'invalid_response',
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions<T> = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Zod schema the response must match. The return type comes from it. */
  schema: z.ZodType<T>;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export type ApiClient = {
  request<T>(path: string, options: RequestOptions<T>): Promise<T>;
};

/**
 * A small typed fetch wrapper. Every response is validated with Zod, so a server change
 * that breaks the contract shows up as a clear error instead of `undefined` in the UI.
 * Auth headers and token refresh get added in M2.
 */
export function createApiClient(config: {
  baseUrl: string;
  fetchFn?: typeof fetch;
  defaultTimeoutMs?: number;
}): ApiClient {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    async request<T>(path: string, options: RequestOptions<T>): Promise<T> {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? config.defaultTimeoutMs ?? 10_000,
      );

      let response: Response;
      try {
        response = await fetchFn(`${config.baseUrl}${path}`, {
          method: options.method ?? 'GET',
          headers: {
            Accept: 'application/json',
            ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
            ...options.headers,
          },
          body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new ApiError('timeout', 'The request timed out');
        throw new ApiError('network', error instanceof Error ? error.message : 'Network error');
      } finally {
        clearTimeout(timeout);
      }

      const json: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const parsed = ApiErrorBody.safeParse(json);
        throw new ApiError(
          'http',
          parsed.success ? parsed.data.error.message : `Request failed with ${response.status}`,
          response.status,
          parsed.success ? parsed.data.error.code : undefined,
        );
      }

      const parsed = options.schema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError('invalid_response', `Unexpected response from ${path}`, response.status);
      }
      return parsed.data;
    },
  };
}

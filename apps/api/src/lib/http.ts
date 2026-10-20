import type { ApiErrorBody } from '@plantpal/shared';
import type { z } from 'zod';

import { HttpError } from './errors';

/** Every error response uses the shared `ApiErrorBody` shape. */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
) {
  const body: ApiErrorBody = { error: { code, message, ...(details && { details }) } };
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function json<T>(body: T, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init?.headers },
  });
}

/** Parse and validate a JSON body. A bad body is a 400, never a 500. */
export async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = await request.json().catch(() => {
    throw new HttpError(400, 'invalid_json', 'Body must be JSON');
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, 'invalid_body', parsed.error.issues[0]?.message ?? 'Invalid body');
  }
  return parsed.data;
}

/** Wraps a route handler: known errors become clean responses, unknown ones a logged 500. */
export function withErrors<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof HttpError)
        return errorResponse(error.status, error.code, error.message, error.details);
      console.error(error);
      return errorResponse(500, 'internal', 'Something went wrong');
    }
  };
}

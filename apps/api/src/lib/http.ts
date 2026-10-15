import type { ApiErrorBody } from '@plantpal/shared';

/** Every error response uses the shared `ApiErrorBody` shape. */
export function errorResponse(status: number, code: string, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status });
}

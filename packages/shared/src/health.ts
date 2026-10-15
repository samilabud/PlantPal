import { z } from 'zod';

/** Response of `GET /api/health`. Shared so the app and the server agree on the shape. */
export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'down', 'not_configured']),
  version: z.string(),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

import { z } from 'zod';

/** Every non-2xx API response uses this body, so the client can show one kind of error. */
export const ApiErrorBody = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Extra machine-readable facts, e.g. a limit and when it resets. */
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBody>;

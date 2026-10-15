import { connection } from 'next/server';

import { checkDatabase } from '@/db/check';
import { buildHealth } from '@/lib/health';

/**
 * GET /api/health
 * Returns 200 with status "degraded" when the database is down: the API process itself is
 * alive, and the body says which dependency failed.
 */
export async function GET() {
  // With Cache Components a GET handler can be prerendered at build time.
  // `connection()` tells Next this must run on every request.
  await connection();
  const body = await buildHealth(checkDatabase);
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}

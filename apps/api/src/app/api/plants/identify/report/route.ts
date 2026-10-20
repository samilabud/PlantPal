import { IdentifyReportRequest, type OkResponse } from '@plantpal/shared';
import { and, eq } from 'drizzle-orm';

import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { aiIdentifications, aiReports } from '@/db/schema';
import { HttpError } from '@/lib/errors';
import { json, parseBody, withErrors } from '@/lib/http';

const ok: OkResponse = { ok: true };

/**
 * POST /api/plants/identify/report: "Report this suggestion". Google Play requires apps with
 * generative AI to let users flag offensive output from inside the app. Only the user's own
 * identifications can be reported; we keep the answer they reported, the reason and the note.
 */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, IdentifyReportRequest);
  const conn = db();
  const [identification] = await conn
    .select({ id: aiIdentifications.id })
    .from(aiIdentifications)
    .where(
      and(eq(aiIdentifications.id, body.identificationId), eq(aiIdentifications.userId, userId)),
    );
  if (!identification) throw new HttpError(404, 'not_found', 'Identification not found');

  await conn.insert(aiReports).values({
    identificationId: identification.id,
    userId,
    reason: body.reason,
    note: body.note || null,
    suggestion: body.suggestion,
  });
  return json(ok);
});

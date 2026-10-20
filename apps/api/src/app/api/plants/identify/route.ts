import { IdentifyRequest, type IdentifyResponse, type IdentifyResult } from '@plantpal/shared';

import { aiConfig } from '@/ai/config';
import { anthropicClient, identifyPlant } from '@/ai/identify';
import { finishIdentification, reserveIdentification } from '@/ai/limits';
import { requireUserId } from '@/auth/require-user';
import { db } from '@/db';
import { HttpError } from '@/lib/errors';
import { json, parseBody, withErrors } from '@/lib/http';

/** Vercel function limit. The app gives up at 20 s, so Claude gets 15 s of it. */
export const maxDuration = 20;
const CLAUDE_BUDGET_MS = 15_000;

/** Base64 of every JPEG starts with these characters (bytes FF D8 FF). */
const JPEG_BASE64_PREFIX = '/9j/';

/** What the app gets when Claude declined: the same "not sure" outcome as an unknown photo. */
const UNSURE: IdentifyResult = {
  isPlant: false,
  commonName: null,
  scientificName: null,
  confidence: 'low',
  wateringIntervalDays: null,
  careTip: null,
};

/**
 * POST /api/plants/identify: suggests a plant name and watering interval from one photo.
 * The photo is passed to Claude and then dropped: it's never stored or logged. What we keep is
 * one row per call (status, tokens, cost) for limits and cost tracking.
 */
export const POST = withErrors(async (request) => {
  const userId = await requireUserId(request);
  const body = await parseBody(request, IdentifyRequest);
  if (!body.image.startsWith(JPEG_BASE64_PREFIX)) {
    throw new HttpError(400, 'invalid_image', 'The photo must be a JPEG');
  }
  const cfg = aiConfig();
  if (!cfg.apiKey) throw new HttpError(503, 'ai_not_configured', 'AI is not configured');

  const conn = db();
  const reservation = await reserveIdentification(conn, userId, {
    model: cfg.model,
    dailyLimitMicroUsd: cfg.dailyLimitMicroUsd,
  });

  const outcome = await identifyPlant(anthropicClient(cfg.apiKey), body.image, body.language, {
    model: cfg.model,
    thinking: cfg.thinking,
    effort: cfg.effort,
    deadline: Date.now() + CLAUDE_BUDGET_MS,
    signal: request.signal,
  });
  await finishIdentification(conn, reservation.id, outcome.status, outcome.usage);
  // One line per call for cost tracking: no user id, no image, no answer text.
  console.info(
    JSON.stringify({
      event: 'identify',
      id: reservation.id,
      status: outcome.status,
      ...outcome.usage,
    }),
  );

  switch (outcome.status) {
    case 'timeout':
      throw new HttpError(504, 'ai_timeout', 'The AI took too long to answer');
    case 'error':
      throw new HttpError(502, 'ai_unavailable', 'The AI service is not available right now');
    case 'invalid_output':
      throw new HttpError(502, 'ai_invalid_output', 'The AI gave an answer we could not use');
  }
  const response: IdentifyResponse = {
    id: reservation.id,
    suggestion: 'result' in outcome ? outcome.result : UNSURE, // no result = Claude refused
    remaining: reservation.remaining,
  };
  return json(response);
});

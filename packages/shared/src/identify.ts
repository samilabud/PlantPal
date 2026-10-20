import { z } from 'zod';

import type { Plan } from './plans';

/** Languages the app (and Claude's answer) can use. */
export const AppLanguage = z.enum(['en', 'es']);
export type AppLanguage = z.infer<typeof AppLanguage>;

/**
 * What Claude must return for one photo. The same schema is sent to the Messages API as the
 * structured-output format, re-checked on the server, and checked again by the app.
 * The API can't enforce numeric ranges; the SDK checks them, and so does this schema.
 */
export const IdentifyResult = z.object({
  isPlant: z.boolean(),
  /** In the user's language. */
  commonName: z.string().min(1).max(80).nullable(),
  scientificName: z.string().min(1).max(120).nullable(),
  /** One sentence in the user's language; the prompt asks for under 140 characters. */
  careTip: z.string().min(1).max(240).nullable(),
  wateringIntervalDays: z.number().int().min(1).max(60).nullable(),
  /**
   * Last on purpose. Claude writes fields in schema order, so it rates its confidence after
   * naming the plant. And with free text last, Sonnet sometimes left a stray "}" at the end of
   * the tip (16 of 125 answers in the first evaluation); a fixed-choice field last avoids that.
   */
  confidence: z.enum(['high', 'medium', 'low']),
});
export type IdentifyResult = z.infer<typeof IdentifyResult>;

/** Only these answers may pre-fill the form; anything else shows "I'm not sure what this is". */
export const isUsableSuggestion = (r: IdentifyResult) =>
  r.isPlant && r.confidence !== 'low' && r.commonName !== null;

/** A 1024 px JPEG is ~150-300 KB; 1.5 M base64 characters (~1.1 MB) leaves plenty of room. */
export const MAX_IDENTIFY_IMAGE_BASE64 = 1_500_000;

export const IdentifyRequest = z.object({
  /** Base64 JPEG without a `data:` prefix. */
  image: z
    .string()
    .min(100, 'Image is too small')
    .max(MAX_IDENTIFY_IMAGE_BASE64, 'Image is too large')
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Image must be base64'),
  language: AppLanguage,
});
export type IdentifyRequest = z.infer<typeof IdentifyRequest>;

export const IdentifyResponse = z.object({
  /** Needed to report this suggestion. */
  id: z.uuid(),
  suggestion: IdentifyResult,
  remaining: z.object({
    today: z.number().int(),
    /** null when the plan has no monthly cap. */
    month: z.number().int().nullable(),
  }),
});
export type IdentifyResponse = z.infer<typeof IdentifyResponse>;

/** Daily and monthly identifications per plan, counted on the server in UTC. */
export const IDENTIFY_LIMITS: Record<Plan, { perDay: number; perMonth: number | null }> = {
  free: { perDay: 3, perMonth: null },
  premium: { perDay: 30, perMonth: 100 },
};

/** Error codes the identify route can answer with (in the shared `ApiErrorBody`). */
export const IdentifyErrorCode = z.enum([
  'invalid_image',
  'identify_limit',
  'ai_resting',
  'ai_not_configured',
  'ai_invalid_output',
  'ai_unavailable',
  'ai_timeout',
]);
export type IdentifyErrorCode = z.infer<typeof IdentifyErrorCode>;

/** Google Play's AI-Generated Content policy: users can flag output without leaving the app. */
export const IdentifyReportReason = z.enum(['wrong', 'offensive', 'other']);
export type IdentifyReportReason = z.infer<typeof IdentifyReportReason>;

export const IdentifyReportRequest = z.object({
  identificationId: z.uuid(),
  reason: IdentifyReportReason,
  note: z.string().trim().max(500).optional(),
  /** The AI answer being reported. The server never stored it, so the app sends it back. */
  suggestion: IdentifyResult,
});
export type IdentifyReportRequest = z.infer<typeof IdentifyReportRequest>;

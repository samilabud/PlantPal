import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { IdentifyResult, type AppLanguage } from '@plantpal/shared';

import type { Effort, ThinkingMode } from './config';
import { costMicroUsd } from './pricing';
import { IDENTIFY_SYSTEM_PROMPT, identifyUserText } from './prompt';

let cachedClient: Anthropic | null = null;

/** One SDK client per instance. The SDK's own retries are off: we decide when to retry. */
export function anthropicClient(apiKey: string): Anthropic {
  return (cachedClient ??= new Anthropic({ apiKey, maxRetries: 0 }));
}
export function setAnthropicClientForTests(client: Anthropic | null) {
  cachedClient = client;
}

/** Thinking and answer together; the JSON answer itself is ~100 tokens. */
const MAX_TOKENS = 2048;
/** A second attempt only makes sense if there's time left for it to finish. */
const MIN_RETRY_BUDGET_MS = 7_000;
/** Anthropic recommends opting into server-side fallback on these models (not on Haiku). */
const FALLBACK_MODELS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5']);

export type IdentifyOptions = {
  model: string;
  thinking: ThinkingMode;
  effort: Effort;
  /** Absolute time (ms since epoch) after which we give up. */
  deadline: number;
  /** The caller's abort (e.g. the request was cancelled). */
  signal?: AbortSignal;
};

export type IdentifyUsage = {
  /** The model that answered; differs from the requested one after a fallback. */
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  latencyMs: number;
  attempts: number;
  /** Text fields the safety net had to clean (see `tidy`). Should stay 0. */
  textRepairs: number;
};

export type IdentifyOutcome =
  | { status: 'ok' | 'low_confidence' | 'not_plant'; result: IdentifyResult; usage: IdentifyUsage }
  | { status: 'invalid_output' | 'refused' | 'timeout' | 'error'; usage: IdentifyUsage };

function buildParams(imageBase64: string, language: AppLanguage, opts: IdentifyOptions) {
  return {
    model: opts.model,
    max_tokens: MAX_TOKENS,
    system: IDENTIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user' as const,
        // Image first, then the short instruction: Anthropic's vision guide recommends it.
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/jpeg' as const,
              data: imageBase64,
            },
          },
          { type: 'text' as const, text: identifyUserText(language) },
        ],
      },
    ],
    // Structured outputs: the API constrains the answer to this JSON schema. We validate it
    // ourselves below (not with messages.parse) so a failed answer still reports its usage.
    output_config: { format: betaZodOutputFormat(IdentifyResult), effort: opts.effort },
    thinking:
      opts.thinking === 'between_tools'
        ? ({ type: 'between_tools' } as const)
        : ({ type: 'adaptive' } as const),
    ...(FALLBACK_MODELS.has(opts.model) && {
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default' as const,
    }),
  };
}

/** Returns the validated answer, or null if the text isn't valid JSON for our schema. */
function readAnswer(message: BetaMessage): IdentifyResult | null {
  const texts = message.content.filter((b) => b.type === 'text');
  const text = texts[texts.length - 1]?.text;
  if (!text) return null;
  try {
    const parsed = IdentifyResult.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Enforces the prompt's rules even if the model bends them. */
function normalize(r: IdentifyResult): {
  status: 'ok' | 'low_confidence' | 'not_plant';
  result: IdentifyResult;
} {
  if (!r.isPlant) {
    return {
      status: 'not_plant',
      result: {
        isPlant: false,
        commonName: null,
        scientificName: null,
        confidence: 'low',
        wateringIntervalDays: null,
        careTip: null,
      },
    };
  }
  const result = {
    ...r,
    commonName: tidy(r.commonName),
    scientificName: tidy(r.scientificName),
    careTip: tidy(r.careTip),
  };
  return { status: r.confidence === 'low' ? 'low_confidence' : 'ok', result };
}

/** Safety net for a stray JSON brace left inside a text field (seen with Sonnet 5.5). */
const tidy = (text: string | null) =>
  text === null ? null : text.replace(/\s*[{}]+$/, '') || null;

/**
 * Asks Claude what plant is in the photo. Never throws for model or network problems: it
 * returns a status, so the caller can always record the usage and answer with a clean error.
 * Retries once, only for an invalid answer and only if there's time left.
 */
export async function identifyPlant(
  client: Anthropic,
  imageBase64: string,
  language: AppLanguage,
  opts: IdentifyOptions,
): Promise<IdentifyOutcome> {
  const started = Date.now();
  const usage: IdentifyUsage = {
    model: opts.model,
    inputTokens: 0,
    outputTokens: 0,
    costMicroUsd: 0,
    latencyMs: 0,
    attempts: 0,
    textRepairs: 0,
  };
  const done = <T extends IdentifyOutcome['status']>(status: T) => {
    usage.latencyMs = Date.now() - started;
    return { status, usage };
  };
  const params = buildParams(imageBase64, language, opts);

  for (;;) {
    const remaining = opts.deadline - Date.now();
    if (remaining <= 0) return done('timeout');
    usage.attempts += 1;
    let message: BetaMessage;
    try {
      message = await client.beta.messages.create(params, {
        timeout: remaining,
        signal: opts.signal,
      });
    } catch (error) {
      if (
        error instanceof Anthropic.APIConnectionTimeoutError ||
        error instanceof Anthropic.APIUserAbortError
      ) {
        return done('timeout');
      }
      // Log the kind of failure only; the SDK error never contains the image.
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      console.error(`[identify] Claude call failed: ${(error as Error).name} ${status ?? ''}`);
      return done('error');
    }

    usage.model = message.model;
    usage.inputTokens += message.usage.input_tokens;
    usage.outputTokens += message.usage.output_tokens;
    usage.costMicroUsd += costMicroUsd(opts.model, message.usage);

    if (message.stop_reason === 'refusal') return done('refused');
    const answer = message.stop_reason === 'max_tokens' ? null : readAnswer(message);
    if (answer) {
      const { status, result } = normalize(answer);
      usage.textRepairs = (['commonName', 'scientificName', 'careTip'] as const).filter(
        (k) => result[k] !== answer[k],
      ).length;
      usage.latencyMs = Date.now() - started;
      return { status, result, usage };
    }
    const timeLeft = opts.deadline - Date.now();
    if (usage.attempts >= 2 || timeLeft < MIN_RETRY_BUDGET_MS) return done('invalid_output');
  }
}

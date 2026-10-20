/**
 * USD per million tokens, from Anthropic's model table (checked 2026-10-19). Tokens × this price
 * is the cost in micro-dollars, which keeps the stored cost an integer.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-opus-5-5': { input: 4, output: 20 },
};
/** A model we don't know (e.g. a fallback target): assume the most expensive tier, so the
 *  spending guard errs on the safe side. */
const UNKNOWN = { input: 10, output: 50 };

type IterationUsage = { model?: string | null; input_tokens: number; output_tokens: number };

/**
 * Cost of one response. With a server-side fallback, `usage.iterations` lists each model that
 * ran (the one that declined and the one that answered), each billed at its own price.
 */
export function costMicroUsd(
  requestedModel: string,
  usage: IterationUsage & { iterations?: IterationUsage[] | null },
): number {
  const parts = usage.iterations?.length ? usage.iterations : [usage];
  let total = 0;
  for (const part of parts) {
    const price = PRICES[part.model ?? requestedModel] ?? UNKNOWN;
    total += part.input_tokens * price.input + part.output_tokens * price.output;
  }
  return Math.ceil(total);
}

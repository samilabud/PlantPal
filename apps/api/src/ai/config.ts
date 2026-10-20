/**
 * How the server calls Claude. Only the API key is secret; the rest are tuning knobs so the
 * evaluation can compare models and thinking settings without code changes.
 */
export type ThinkingMode = 'adaptive' | 'between_tools';
export type Effort = 'low' | 'medium' | 'high';

export function aiConfig(env: Record<string, string | undefined> = process.env) {
  const dailyLimitUsd = Number(env.AI_DAILY_LIMIT ?? '1');
  return {
    /** Server only. Never in an EXPO_PUBLIC_* variable, never logged. */
    apiKey: env.ANTHROPIC_API_KEY || null,
    model: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    /** `between_tools` turns thinking off on Sonnet 5.5 (`disabled` is rejected there). */
    thinking: (env.ANTHROPIC_THINKING === 'between_tools'
      ? 'between_tools'
      : 'adaptive') as ThinkingMode,
    effort: (env.ANTHROPIC_EFFORT === 'medium' || env.ANTHROPIC_EFFORT === 'high'
      ? env.ANTHROPIC_EFFORT
      : 'low') as Effort,
    /** Spending guard in USD per UTC day, across all users. Invalid values fail closed (0). */
    dailyLimitMicroUsd: Number.isFinite(dailyLimitUsd) ? Math.round(dailyLimitUsd * 1e6) : 0,
  };
}
export type AiConfig = ReturnType<typeof aiConfig>;

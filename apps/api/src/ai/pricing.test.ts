import { describe, expect, it } from 'vitest';

import { aiConfig } from './config';
import { costMicroUsd } from './pricing';

describe('costMicroUsd', () => {
  it('prices tokens in micro-dollars', () => {
    // Sonnet 5.5: $2 in / $10 out per million tokens
    expect(costMicroUsd('claude-sonnet-5-5', { input_tokens: 1900, output_tokens: 300 })).toBe(
      6800,
    );
  });

  it('prices each model that ran when a fallback answered', () => {
    const usage = {
      input_tokens: 3800,
      output_tokens: 250,
      iterations: [
        { model: 'claude-sonnet-5-5', input_tokens: 1900, output_tokens: 50 },
        { model: 'claude-opus-5-5', input_tokens: 1900, output_tokens: 200 },
      ],
    };
    expect(costMicroUsd('claude-sonnet-5-5', usage)).toBe(1900 * 2 + 50 * 10 + 1900 * 4 + 200 * 20);
  });

  it('assumes the most expensive price for a model it does not know', () => {
    expect(costMicroUsd('claude-future-9', { input_tokens: 1000, output_tokens: 100 })).toBe(
      1000 * 10 + 100 * 50,
    );
  });
});

describe('aiConfig', () => {
  it('defaults to Sonnet 5.5, low effort, adaptive thinking and $1 a day', () => {
    expect(aiConfig({})).toMatchObject({
      apiKey: null,
      model: 'claude-sonnet-5-5',
      effort: 'low',
      thinking: 'adaptive',
      dailyLimitMicroUsd: 1_000_000,
    });
  });

  it('fails closed on a bad daily limit', () => {
    expect(aiConfig({ AI_DAILY_LIMIT: 'lots' }).dailyLimitMicroUsd).toBe(0);
  });
});

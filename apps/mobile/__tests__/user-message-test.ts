import { ApiError } from '@/api/client';
import { toUserMessage } from '@/errors/user-message';

const coded = (code: string) => Object.assign(new Error(`raw library message ${code}`), { code });

describe('toUserMessage', () => {
  beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));

  it('network and timeout problems say what to do', () => {
    expect(toUserMessage(new ApiError('network', 'fetch failed'), 'signIn')).toMatch(/No internet/);
    expect(toUserMessage(new ApiError('timeout', 'aborted'), 'sync')).toMatch(/taking too long/);
  });

  it('server errors get a reference code; session and rate limits get their own advice', () => {
    expect(toUserMessage(new ApiError('http', 'x', 503), 'sync')).toMatch(/\(ref: server-503\)/);
    expect(toUserMessage(new ApiError('http', 'x', 401), 'sync')).toMatch(/sign in again/);
    expect(toUserMessage(new ApiError('http', 'x', 429), 'signIn')).toMatch(/Too many attempts/);
  });

  it('code "10" means different things for Google sign-in and for purchases', () => {
    expect(toUserMessage(coded('10'), 'signIn')).toMatch(/Google sign-in isn't working.*google-10/);
    expect(toUserMessage(coded('10'), 'purchase')).toMatch(/No internet/);
  });

  it('purchase problems reassure about charges and point to the fix', () => {
    expect(toUserMessage(coded('6'), 'purchase')).toMatch(/Restore purchases/);
    expect(toUserMessage(coded('2'), 'purchase')).toMatch(/weren't charged/);
    expect(toUserMessage(coded('999'), 'purchase')).toMatch(/weren't charged.*store-999/);
  });

  it('unknown errors fall back to a safe message for the context, never the raw text', () => {
    const msg = toUserMessage(new Error('TypeError: undefined is not a function'), 'deleteAccount');
    expect(msg).toBe("Couldn't delete your account. Nothing was deleted. Please try again.");
  });

  it('identify: limits, resting and failures say what still works', () => {
    const limit = (details: Record<string, unknown>) =>
      new ApiError('http', 'x', 429, 'identify_limit', details);
    expect(toUserMessage(limit({ plan: 'free', period: 'day' }), 'identify')).toMatch(
      /today's free AI identifications/,
    );
    expect(toUserMessage(limit({ plan: 'premium', period: 'month' }), 'identify')).toMatch(
      /this month's/,
    );
    expect(toUserMessage(new ApiError('http', 'x', 503, 'ai_resting'), 'identify')).toMatch(
      /resting for today/,
    );
    expect(toUserMessage(new ApiError('http', 'x', 502, 'ai_unavailable'), 'identify')).toMatch(
      /add it yourself.*ref: ai_unavailable/,
    );
    // Not an identify code: the usual handling still applies.
    expect(toUserMessage(new ApiError('network', 'x'), 'identify')).toMatch(/No internet/);
  });
});

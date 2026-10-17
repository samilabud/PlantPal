import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFeatureFlag } from 'posthog-react-native';

import { posthog, track, useAnalyticsConsent } from '@/analytics/analytics';
import PaywallScreen from '@/app/paywall';
import { buy, getPackages } from '@/purchases/purchases';

jest.mock('posthog-react-native', () => {
  const actual = jest.requireActual('posthog-react-native');
  return { __esModule: true, ...actual, useFeatureFlag: jest.fn() };
});
jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ reason: 'plants' }),
}));
jest.mock('@/purchases/purchases', () => ({
  isPurchasesAvailable: () => true,
  getPackages: jest.fn(),
  buy: jest.fn(),
  restore: jest.fn(),
}));

const flag = useFeatureFlag as jest.Mock;
let capture: jest.SpyInstance;

function renderPaywall() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaywallScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  capture = jest.spyOn(posthog, 'capture').mockImplementation(() => undefined);
  (getPackages as jest.Mock).mockResolvedValue([
    { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { priceString: '$9.99' } },
  ]);
});

describe('analytics events', () => {
  it('sends only the event name and its allowed properties', () => {
    track('plant_added', { with_photo: true });
    expect(capture).toHaveBeenCalledWith('plant_added', { with_photo: true });
  });
});

describe('paywall-variant flag', () => {
  it('no flag (analytics off or not in the test): the original copy, view recorded as control', async () => {
    flag.mockReturnValue(undefined);
    await renderPaywall();
    expect(screen.getByText('PlantPal Premium')).toBeOnTheScreen();
    expect(capture).toHaveBeenCalledWith('paywall_viewed', {
      reason: 'plants',
      variant: 'control',
    });
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('"plants-first": different headline and benefits, same plans', async () => {
    flag.mockReturnValue('plants-first');
    await renderPaywall();
    expect(screen.getByText('Room for every plant')).toBeOnTheScreen();
    expect(screen.getByText('✓ Add as many plants as you own')).toBeOnTheScreen();
    expect(await screen.findByText('$9.99 per month')).toBeOnTheScreen();
    expect(capture).toHaveBeenCalledWith('paywall_viewed', {
      reason: 'plants',
      variant: 'plants-first',
    });
  });

  it('a purchase is recorded with the variant that was shown', async () => {
    flag.mockReturnValue('plants-first');
    (buy as jest.Mock).mockResolvedValue(true);
    await renderPaywall();
    await fireEvent.press(await screen.findByText('$9.99 per month'));
    await waitFor(() =>
      expect(capture).toHaveBeenCalledWith('purchase_completed', {
        package_type: 'MONTHLY',
        variant: 'plants-first',
      }),
    );
  });
});

describe('opt-out (Settings switch)', () => {
  it('switching off opts out of PostHog, switching on opts back in', async () => {
    const client = {
      optedOut: false,
      optIn: jest.fn(async () => {}),
      optOut: jest.fn(async () => {}),
    };
    const { result } = await renderHook(() => useAnalyticsConsent(client, true));
    expect(result.current.enabled).toBe(true);

    await act(() => result.current.set(false));
    expect(client.optOut).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(false);

    await act(() => result.current.set(true));
    expect(client.optIn).toHaveBeenCalledTimes(1);
    expect(result.current.enabled).toBe(true);
  });

  it('a user who opted out earlier sees the switch off', async () => {
    const client = { optedOut: true, optIn: jest.fn(), optOut: jest.fn() };
    const { result } = await renderHook(() => useAnalyticsConsent(client, true));
    expect(result.current.enabled).toBe(false);
  });
});

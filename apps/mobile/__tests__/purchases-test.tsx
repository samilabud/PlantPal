import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { router } from 'expo-router';

import PaywallScreen from '@/app/paywall';
import { canAddPhoto, canAddPlant, isPremium } from '@/purchases/limits';
import { buy, getPackages, restore } from '@/purchases/purchases';

import { testUser } from '../test/utils';

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => ({ reason: 'plants' }),
}));
jest.mock('@/purchases/purchases', () => ({
  isPurchasesAvailable: () => true,
  getPackages: jest.fn(),
  buy: jest.fn(),
  restore: jest.fn(),
  usePremiumStore: jest.fn(),
}));

const pkg = (type: 'MONTHLY' | 'ANNUAL', price: string) => ({
  identifier: `$rc_${type.toLowerCase()}`,
  packageType: type,
  product: { priceString: price },
});

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

describe('limits', () => {
  it('free: 3 plants and 1 photo per plant; premium: unlimited', () => {
    expect([canAddPlant(false, 2), canAddPlant(false, 3), canAddPlant(true, 99)]).toEqual([
      true,
      false,
      true,
    ]);
    expect([canAddPhoto(false, 0), canAddPhoto(false, 1), canAddPhoto(true, 10)]).toEqual([
      true,
      false,
      true,
    ]);
  });

  it('premium if the server says so or the device just bought it', () => {
    expect(isPremium({ ...testUser, plan: 'premium' }, null)).toBe(true);
    expect(isPremium(testUser, true)).toBe(true);
    expect(isPremium(testUser, false)).toBe(false);
    expect(isPremium(null, null)).toBe(false);
  });
});

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest
      .mocked(getPackages)
      .mockResolvedValue([pkg('MONTHLY', '$2.99'), pkg('ANNUAL', '$19.99')] as never);
    jest.clearAllMocks();
    jest
      .mocked(getPackages)
      .mockResolvedValue([pkg('MONTHLY', '$2.99'), pkg('ANNUAL', '$19.99')] as never);
  });

  it('explains why it opened and lists the plans with store prices', async () => {
    await renderPaywall();
    expect(screen.getByText('The free plan includes 3 plants.')).toBeOnTheScreen();
    expect(
      await screen.findByRole('button', { name: 'Subscribe for $2.99 per month' }),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Subscribe for $19.99 per year' })).toBeOnTheScreen();
  });

  it('a successful purchase closes the paywall', async () => {
    jest.mocked(buy).mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderPaywall();
    await fireEvent.press(await screen.findByTestId('buy-annual'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith('Welcome to Premium 🌿', expect.any(String));
  });

  it('cancelling the store sheet is not an error and keeps the paywall open', async () => {
    jest.mocked(buy).mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderPaywall();
    await fireEvent.press(await screen.findByTestId('buy-monthly'));
    await waitFor(() => expect(buy).toHaveBeenCalled());
    expect(router.back).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it('restore tells the user what happened', async () => {
    jest.mocked(restore).mockResolvedValue(false);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderPaywall();
    await fireEvent.press(screen.getByRole('button', { name: 'Restore purchases' }));
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Restore', 'No active subscription found.'),
    );
  });
});

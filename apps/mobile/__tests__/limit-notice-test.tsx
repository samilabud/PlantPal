import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { LimitNotice } from '@/components/limit-notice';
import { useSyncStore } from '@/sync/sync-manager';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/sync/sync-manager', () => {
  const { create } = jest.requireActual('zustand');
  const store = create(() => ({ refusedByLimit: 0 }));
  return { useSyncStore: store, dismissLimitNotice: () => store.setState({ refusedByLimit: 0 }) };
});

describe('LimitNotice', () => {
  beforeEach(() => useSyncStore.setState({ refusedByLimit: 0 }));

  it('shows nothing when nothing was refused', async () => {
    await render(<LimitNotice />);
    expect(screen.queryByTestId('limit-notice')).toBeNull();
  });

  it('explains what happened, with a count, and can be dismissed', async () => {
    useSyncStore.setState({ refusedByLimit: 2 });
    await render(<LimitNotice />);
    expect(screen.getByText('Premium is no longer active')).toBeOnTheScreen();
    expect(screen.getByText(/2 new items couldn't be saved/)).toBeOnTheScreen();
    expect(screen.queryByText(/another device/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('limit-notice')).toBeNull();
  });

  it('Upgrade opens the paywall and clears the notice', async () => {
    useSyncStore.setState({ refusedByLimit: 1 });
    await render(<LimitNotice />);
    await fireEvent.press(screen.getByRole('button', { name: 'Upgrade' }));
    expect(router.push).toHaveBeenCalledWith('/paywall');
    expect(useSyncStore.getState().refusedByLimit).toBe(0);
  });
});

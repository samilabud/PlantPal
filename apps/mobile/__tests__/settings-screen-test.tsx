import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';

import { deleteAccount, signOut } from '@/auth';
import SettingsScreen from '@/app/settings';

import { testUser } from '../test/utils';

let mockPending = 0;
jest.mock('@/sync/sync-manager', () => ({
  requestSync: jest.fn(),
  useSyncStore: () => ({ status: 'idle', pending: mockPending, lastSyncedAt: null, error: null }),
}));
jest.mock('@/api', () => ({ getHealth: jest.fn(() => new Promise(() => {})) }));
jest.mock('@/components/reminders-card', () => ({ RemindersCard: () => null }));
jest.mock('@/config/env', () => ({
  env: { apiUrl: 'http://api.test', appVariant: 'development' },
}));

jest.mock('@/auth', () => ({
  useAuthStore: (select: (s: { user: unknown }) => unknown) =>
    select({ user: require('../test/utils').testUser }),
  signOut: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => true),
}));

const render = (ui: ReactElement) =>
  rtlRender(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
      {ui}
    </QueryClientProvider>,
  );

describe('SettingsScreen', () => {
  beforeEach(() => {
    mockPending = 0;
    jest.clearAllMocks();
  });

  it('shows the account', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByTestId('account-email')).toHaveTextContent(testUser.email);
  });

  it('signs out', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
  });

  it('warns before signing out with unsynced changes', async () => {
    mockPending = 3;
    const alert = jest.spyOn(Alert, 'alert');
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).not.toHaveBeenCalled();
    expect(alert.mock.calls[0]![1]).toMatch(/3 change\(s\)/);
  });

  it('asks for confirmation before deleting, and deletes on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));

    expect(deleteAccount).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    const destructive = buttons.find((b) => b.style === 'destructive')!;
    await act(async () => destructive.onPress!());
    expect(deleteAccount).toHaveBeenCalled();
  });
});

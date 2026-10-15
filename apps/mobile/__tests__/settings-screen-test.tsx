import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { deleteAccount, signOut } from '@/auth';
import SettingsScreen from '@/app/settings';

import { testUser } from '../test/utils';

jest.mock('@/auth', () => ({
  useAuthStore: (select: (s: { user: unknown }) => unknown) =>
    select({ user: require('../test/utils').testUser }),
  signOut: jest.fn(async () => undefined),
  deleteAccount: jest.fn(async () => true),
}));

describe('SettingsScreen', () => {
  it('shows the account', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByTestId('account-email')).toHaveTextContent(testUser.email);
  });

  it('signs out', async () => {
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalled();
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

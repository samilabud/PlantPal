import { fireEvent, render, screen } from '@testing-library/react-native';

import { signInDev } from '@/auth';
import SignInScreen from '@/app/sign-in';

jest.mock('@/auth', () => ({
  isAppleSignInAvailable: jest.fn(async () => false),
  isGoogleSignInConfigured: jest.fn(() => false),
  isDevSignInEnabled: true,
  signInDev: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
}));

const mockedSignInDev = jest.mocked(signInDev);

describe('SignInScreen', () => {
  beforeEach(() => mockedSignInDev.mockReset());

  it('signs in with the dev button', async () => {
    mockedSignInDev.mockResolvedValue(true);
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Dev sign-in (test only)' }));
    expect(mockedSignInDev).toHaveBeenCalledWith('dev');
  });

  it('shows a plain-language error, never the raw library message', async () => {
    mockedSignInDev.mockRejectedValue(
      Object.assign(new Error('DEVELOPER_ERROR: Follow troubleshooting instructions at …'), {
        code: '10',
      }),
    );
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByTestId('dev-sign-in'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Google sign-in isn't working in this version/);
    expect(alert).not.toHaveTextContent(/DEVELOPER_ERROR/);
  });

  it('hides Google when it is not configured', async () => {
    await render(<SignInScreen />);
    expect(screen.queryByTestId('google-sign-in')).toBeNull();
  });
});

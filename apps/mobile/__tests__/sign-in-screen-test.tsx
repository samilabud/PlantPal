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

  it('shows the error when sign-in fails', async () => {
    mockedSignInDev.mockRejectedValue(new Error('Server unreachable'));
    await render(<SignInScreen />);
    await fireEvent.press(screen.getByTestId('dev-sign-in'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unreachable');
  });

  it('hides Google when it is not configured', async () => {
    await render(<SignInScreen />);
    expect(screen.queryByTestId('google-sign-in')).toBeNull();
  });
});

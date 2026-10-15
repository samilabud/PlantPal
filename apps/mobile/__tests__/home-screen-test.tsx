import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError, getHealth } from '@/api';
import HomeScreen from '@/app/index';

jest.mock('@/config/env', () => ({
  env: { apiUrl: 'http://api.test', appVariant: 'development' },
}));
jest.mock('@/api', () => ({
  ...jest.requireActual('@/api/client'),
  getHealth: jest.fn(),
}));

const mockedGetHealth = jest.mocked(getHealth);

async function renderWithQuery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

describe('HomeScreen', () => {
  beforeEach(() => mockedGetHealth.mockReset());

  it('shows the backend status when the API is healthy', async () => {
    mockedGetHealth.mockResolvedValue({
      status: 'ok',
      db: 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
    });
    await renderWithQuery();

    expect(await screen.findByText('API ok · database ok · v0.1.0')).toBeOnTheScreen();
  });

  it('shows an error and lets the user retry', async () => {
    mockedGetHealth.mockRejectedValueOnce(new ApiError('network', 'Network request failed'));
    await renderWithQuery();

    expect(await screen.findByTestId('health-error')).toHaveTextContent(/Network request failed/);

    mockedGetHealth.mockResolvedValueOnce({
      status: 'degraded',
      db: 'down',
      version: '0.1.0',
      time: new Date().toISOString(),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Check backend again' }));
    expect(await screen.findByTestId('health-status')).toHaveTextContent(/database down/);
  });
});

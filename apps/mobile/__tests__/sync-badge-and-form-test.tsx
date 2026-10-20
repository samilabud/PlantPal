import { fireEvent, render, screen } from '@testing-library/react-native';

import { PlantForm, validatePlantForm } from '@/components/plant-form';
import { SyncBadge } from '@/components/sync-badge';
import { requestSync } from '@/sync/sync-manager';

let mockSync = { status: 'offline', pending: 2 };
jest.mock('@/sync/sync-manager', () => ({
  requestSync: jest.fn(),
  useSyncStore: () => mockSync,
}));
jest.mock('@/photos/capture', () => ({ capturePhoto: jest.fn(), localFileExists: () => false }));
jest.mock('@/api', () => ({ getPhotoViewUrl: jest.fn() }));
jest.mock('@/components/ai-identify', () => ({ AiIdentify: () => null }));

describe('SyncBadge', () => {
  it.each([
    [{ status: 'offline', pending: 2 }, 'Offline · 2 to sync'],
    [{ status: 'idle', pending: 0 }, 'Synced'],
    [{ status: 'syncing', pending: 1 }, 'Syncing…'],
    [{ status: 'error', pending: 1 }, 'Sync failed · retry'],
  ])('%o -> %s', async (state, text) => {
    mockSync = state;
    await render(<SyncBadge />);
    expect(screen.getByText(text)).toBeOnTheScreen();
  });

  it('syncs now when tapped', async () => {
    mockSync = { status: 'idle', pending: 0 };
    await render(<SyncBadge />);
    await fireEvent.press(screen.getByTestId('sync-badge'));
    expect(requestSync).toHaveBeenCalledWith({ immediate: true });
  });
});

describe('PlantForm', () => {
  it('validates name and interval', () => {
    expect(validatePlantForm('', '7')).toMatch(/name/);
    expect(validatePlantForm('Fern', '0')).toMatch(/1 to 365/);
    expect(validatePlantForm('Fern', '2.5')).toMatch(/1 to 365/);
    expect(validatePlantForm('Fern', '7')).toBeNull();
  });

  it('submits trimmed values and blocks invalid input', async () => {
    const onSubmit = jest.fn(async () => undefined);
    await render(<PlantForm submitLabel="Save plant" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByTestId('plant-submit'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give your plant a name');
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('plant-name-input'), '  Monstera  ');
    await fireEvent.changeText(screen.getByTestId('plant-interval-input'), '10');
    await fireEvent.press(screen.getByTestId('plant-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Monstera',
      wateringIntervalDays: 10,
      photo: null,
    });
  });
});

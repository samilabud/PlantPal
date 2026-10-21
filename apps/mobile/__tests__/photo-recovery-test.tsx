import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { PlantPhoto } from '@/components/plant-photo';
import { recoverPendingPhoto } from '@/photos/capture';
import { usePendingPhoto } from '@/photos/use-pending-photo';

jest.mock('expo-image-picker', () => ({ getPendingResultAsync: jest.fn() }));
const mockCrop = jest.fn();
const mockResize = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => {
      const context = {
        crop: (...args: unknown[]) => (mockCrop(...args), context),
        resize: (...args: unknown[]) => (mockResize(...args), context),
        renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///cache/out.jpg' }) }),
      };
      return context;
    },
  },
}));
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map(String).join('/');
    }
    move() {}
    get exists() {
      return true;
    }
  },
}));
jest.mock('@/db/database', () => ({
  photosDirectory: () => ({ create: () => undefined, toString: () => 'file:///photos' }),
}));
jest.mock('@/api', () => ({ getPhotoViewUrl: jest.fn() }));
jest.mock('@/data/ids', () => ({ newId: () => 'photo-1' }));

beforeEach(() => jest.clearAllMocks());
const withQuery = (ui: ReactElement) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
    {ui}
  </QueryClientProvider>
);

const pending = ImagePicker.getPendingResultAsync as jest.Mock;
const asset = (width: number, height: number) => ({ uri: 'file:///camera.jpg', width, height });

describe('recoverPendingPhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['nothing pending', null],
    ['a cancelled pick', { canceled: true, assets: null }],
    ['an error', { code: 'ERR', message: 'failed' }],
  ])('returns null for %s', async (_, value) => {
    pending.mockResolvedValue(value);
    await expect(recoverPendingPhoto()).resolves.toBeNull();
  });

  it('saves a photo the camera returned while the app was closed, squared like the crop does', async () => {
    pending.mockResolvedValue({ canceled: false, assets: [asset(4000, 3000)] });
    const photo = await recoverPendingPhoto();
    expect(photo?.uri).toMatch(/^file:\/\/\/photos\/.+\.jpg$/);
    expect(mockCrop).toHaveBeenCalledWith({ originX: 500, originY: 0, width: 3000, height: 3000 });
    expect(mockResize).toHaveBeenCalledWith({ width: 1280 });
  });
});

describe('usePendingPhoto', () => {
  const original = Platform.OS;
  beforeAll(() => {
    Platform.OS = 'android';
  });
  afterAll(() => {
    Platform.OS = original;
  });

  it('hands a recovered photo to the screen when it opens', async () => {
    pending.mockResolvedValue({ canceled: false, assets: [asset(1000, 1000)] });
    const onPhoto = jest.fn();
    function Probe() {
      usePendingPhoto(onPhoto);
      return null;
    }
    await render(<Probe />);
    await act(async () => undefined);
    expect(onPhoto).toHaveBeenCalledWith({ photoId: 'photo-1', uri: 'file:///photos/photo-1.jpg' });
  });

  it('does nothing when disabled', async () => {
    pending.mockResolvedValue({ canceled: false, assets: [asset(1000, 1000)] });
    const onPhoto = jest.fn();
    function Probe() {
      usePendingPhoto(onPhoto, false);
      return null;
    }
    await render(<Probe />);
    await act(async () => undefined);
    expect(pending).not.toHaveBeenCalled();
    expect(onPhoto).not.toHaveBeenCalled();
  });
});

describe('PlantPhoto', () => {
  it('shows a new photo after a previous one failed to load', async () => {
    const { rerender } = await render(
      withQuery(
        <PlantPhoto photoId="p1" localUri="file:///photos/p1.jpg" size={96} label="Plant photo" />,
      ),
    );
    await fireEvent(screen.getByTestId('plant-photo-image'), 'error', {
      nativeEvent: { error: 'decode failed' },
    });
    expect(screen.queryByTestId('plant-photo-image')).toBeNull(); // placeholder now

    await rerender(
      withQuery(
        <PlantPhoto photoId="p2" localUri="file:///photos/p2.jpg" size={96} label="Plant photo" />,
      ),
    );
    expect(screen.getByTestId('plant-photo-image')).toBeOnTheScreen();
  });
});

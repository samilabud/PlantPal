import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { getPhotoViewUrl } from '@/api';
import { PlantPhoto } from '@/components/plant-photo';
import { notifyDataChanged, useLiveQuery } from '@/data/live';
import { localFileExists } from '@/photos/capture';
import { Button } from '@/ui';

jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => ({})) }));
jest.mock('@/api', () => ({ getPhotoViewUrl: jest.fn() }));
jest.mock('@/photos/capture', () => ({ localFileExists: jest.fn(() => false) }));

describe('useLiveQuery', () => {
  it('reads once, then re-reads every time local data changes', async () => {
    let n = 0;
    const query = jest.fn(async () => ++n);
    const { result } = await renderHook(() => useLiveQuery(query, []));
    await waitFor(() => expect(result.current.data).toBe(1));

    await act(async () => notifyDataChanged());
    await waitFor(() => expect(result.current.data).toBe(2));
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('reports errors instead of throwing', async () => {
    const { result } = await renderHook(() =>
      useLiveQuery(async () => {
        throw new Error('disk full');
      }, []),
    );
    await waitFor(() => expect(result.current.error?.message).toBe('disk full'));
    expect(result.current.loading).toBe(false);
  });
});

describe('Button', () => {
  it('exposes role, label and busy/disabled state to screen readers', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeBusy();
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('PlantPhoto', () => {
  const wrap = (ui: React.ReactElement) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}>
      {ui}
    </QueryClientProvider>
  );

  beforeEach(() => jest.clearAllMocks());

  it('no photo: an accessible placeholder, no network call', async () => {
    await render(wrap(<PlantPhoto photoId={null} size={56} label="Photo of Fern" />));
    expect(screen.getByLabelText('Photo of Fern')).toBeOnTheScreen();
    expect(getPhotoViewUrl).not.toHaveBeenCalled();
  });

  it('a file on this phone is used directly (works offline, no signed URL)', async () => {
    jest.mocked(localFileExists).mockReturnValue(true);
    await render(
      wrap(<PlantPhoto photoId="p1" localUri="file:///p1.jpg" size={56} label="Photo" />),
    );
    expect(getPhotoViewUrl).not.toHaveBeenCalled();
  });

  it('a photo from another device asks the API for a signed URL', async () => {
    jest.mocked(localFileExists).mockReturnValue(false);
    jest
      .mocked(getPhotoViewUrl)
      .mockResolvedValue({ url: 'https://blob.test/p2', expiresAt: new Date().toISOString() });
    await render(wrap(<PlantPhoto photoId="p2" size={56} label="Photo" />));
    await waitFor(() => expect(getPhotoViewUrl).toHaveBeenCalledWith('p2'));
  });
});

// Keeps the Text import used for JSX type-checking in this file.
void Text;

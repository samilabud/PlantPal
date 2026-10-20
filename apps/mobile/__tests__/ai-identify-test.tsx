import type { IdentifyResponse, IdentifyResult } from '@plantpal/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';

import { confirmAiNotice } from '@/ai/identify';
import { identifyPlant, reportSuggestion } from '@/api';
import { ApiError } from '@/api/client';
import { AiIdentify } from '@/components/ai-identify';
import { PlantForm } from '@/components/plant-form';
import { capturePhoto } from '@/photos/capture';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/api', () => ({
  identifyPlant: jest.fn(),
  reportSuggestion: jest.fn(async () => ({ ok: true })),
  getPhotoViewUrl: jest.fn(),
  ApiError: jest.requireActual('@/api/client').ApiError,
}));
jest.mock('@/ai/identify', () => ({
  prepareForAi: jest.fn(async () => 'BASE64JPEG'),
  aiLanguage: () => 'en',
  confirmAiNotice: jest.fn(async () => true),
}));
jest.mock('@/components/plant-photo', () => ({ PlantPhoto: () => null }));
jest.mock('@/photos/capture', () => ({ capturePhoto: jest.fn(), localFileExists: () => true }));
let mockConnected: boolean | null = true;
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: mockConnected }),
}));

const MONSTERA: IdentifyResult = {
  isPlant: true,
  commonName: 'Monstera',
  scientificName: 'Monstera deliciosa',
  careTip: 'Let the top of the soil dry between waterings.',
  wateringIntervalDays: 7,
  confidence: 'high',
};
const answer = (suggestion: IdentifyResult): IdentifyResponse => ({
  id: '11111111-1111-4111-8111-111111111111',
  suggestion,
  remaining: { today: 2, month: null },
});
const identifyMock = identifyPlant as jest.Mock;

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
beforeEach(() => {
  jest.clearAllMocks();
  mockConnected = true;
});

describe('AiIdentify', () => {
  it('shows nothing until there is a photo', async () => {
    await render(<AiIdentify photoUri={null} />);
    expect(screen.queryByTestId('ai-identify')).toBeNull();
  });

  it('labels a good answer as the AI’s and hands it over for pre-filling', async () => {
    identifyMock.mockResolvedValue(answer(MONSTERA));
    const onSuggestion = jest.fn();
    await render(<AiIdentify photoUri="file:///p.jpg" onSuggestion={onSuggestion} />);

    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(await screen.findByText('Suggested by AI. Please check it.')).toBeOnTheScreen();
    expect(screen.getByText('Water about every 7 days')).toBeOnTheScreen();
    expect(onSuggestion).toHaveBeenCalledWith(MONSTERA);
    expect(identifyMock).toHaveBeenCalledWith(
      { image: 'BASE64JPEG', language: 'en' },
      expect.any(AbortSignal),
    );
  });

  it.each([
    ['low confidence', { ...MONSTERA, confidence: 'low' as const }],
    [
      'not a plant',
      {
        isPlant: false,
        commonName: null,
        scientificName: null,
        careTip: null,
        wateringIntervalDays: null,
        confidence: 'low' as const,
      },
    ],
  ])('%s: says it is not sure and pre-fills nothing', async (_, suggestion) => {
    identifyMock.mockResolvedValue(answer(suggestion));
    const onSuggestion = jest.fn();
    await render(<AiIdentify photoUri="file:///p.jpg" onSuggestion={onSuggestion} />);
    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(await screen.findByText(/not sure what this is/)).toBeOnTheScreen();
    expect(onSuggestion).not.toHaveBeenCalled();
  });

  it('is disabled offline, with an explanation', async () => {
    mockConnected = false;
    await render(<AiIdentify photoUri="file:///p.jpg" />);
    expect(screen.getByTestId('ai-identify-button')).toBeDisabled();
    expect(screen.getByText(/needs an internet connection/)).toBeOnTheScreen();
  });

  it('does nothing if the first-use notice is not accepted', async () => {
    (confirmAiNotice as jest.Mock).mockResolvedValueOnce(false);
    await render(<AiIdentify photoUri="file:///p.jpg" />);
    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(identifyMock).not.toHaveBeenCalled();
  });

  it('can be cancelled, and a late answer is ignored', async () => {
    let resolve!: (r: IdentifyResponse) => void;
    identifyMock.mockImplementation(
      (_body: unknown, signal: AbortSignal) =>
        new Promise((res, reject) => {
          resolve = res;
          signal.addEventListener('abort', () => reject(new ApiError('cancelled', 'cancelled')));
        }),
    );
    const onSuggestion = jest.fn();
    await render(<AiIdentify photoUri="file:///p.jpg" onSuggestion={onSuggestion} />);
    // Not awaited: the handler only finishes when the (never answered) request does.
    void fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(await screen.findByTestId('ai-cancel')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('ai-cancel'));
    await act(async () => resolve(answer(MONSTERA)));
    expect(screen.getByTestId('ai-identify-button')).toBeOnTheScreen();
    expect(onSuggestion).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ai-error')).toBeNull();
  });

  it('explains the free daily limit and offers Premium', async () => {
    identifyMock.mockRejectedValue(
      new ApiError('http', 'limit', 429, 'identify_limit', { plan: 'free', period: 'day' }),
    );
    await render(<AiIdentify photoUri="file:///p.jpg" />);
    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(await screen.findByText(/today's free AI identifications/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('See Premium'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/paywall', params: { reason: 'ai' } });
  });

  it('shows a plain message when the AI is unavailable, and allows a retry', async () => {
    identifyMock.mockRejectedValueOnce(new ApiError('http', 'x', 502, 'ai_unavailable'));
    await render(<AiIdentify photoUri="file:///p.jpg" />);
    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    expect(await screen.findByText(/You can still add it yourself/)).toBeOnTheScreen();
    expect(screen.getByText('Try again with AI')).toBeOnTheScreen();
  });

  it('reports a suggestion without leaving the app', async () => {
    identifyMock.mockResolvedValue(answer(MONSTERA));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await render(<AiIdentify photoUri="file:///p.jpg" />);
    await fireEvent.press(screen.getByTestId('ai-identify-button'));
    await fireEvent.press(await screen.findByTestId('ai-report'));

    const buttons = alert.mock.calls[0]![2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual(['Wrong plant', 'Offensive', 'Cancel']);
    await act(async () => buttons[1]!.onPress!());
    expect(reportSuggestion).toHaveBeenCalledWith({
      identificationId: '11111111-1111-4111-8111-111111111111',
      reason: 'offensive',
      suggestion: MONSTERA,
    });
    expect(alert).toHaveBeenLastCalledWith('Thanks', expect.stringMatching(/review/));
  });
});

describe('PlantForm with AI', () => {
  it('pre-fills name and interval, labels them, and saves only when the user taps Save', async () => {
    (capturePhoto as jest.Mock).mockResolvedValue({ photoId: 'p1', uri: 'file:///p1.jpg' });
    identifyMock.mockResolvedValue(answer(MONSTERA));
    const onSubmit = jest.fn(async () => undefined);
    await render(<PlantForm allowPhoto submitLabel="Save plant" onSubmit={onSubmit} />);

    expect(screen.queryByTestId('ai-identify-button')).toBeNull(); // no photo yet
    await fireEvent.press(screen.getByText('Choose photo'));
    await fireEvent.press(await screen.findByTestId('ai-identify-button'));

    expect(await screen.findByTestId('ai-prefilled')).toBeOnTheScreen();
    expect(screen.getByTestId('plant-name-input')).toHaveDisplayValue('Monstera');
    expect(screen.getByTestId('plant-interval-input')).toHaveDisplayValue('7');
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('plant-interval-input'), '9'); // user edits
    await fireEvent.press(screen.getByTestId('plant-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Monstera',
      wateringIntervalDays: 9,
      photo: { photoId: 'p1', uri: 'file:///p1.jpg' },
    });
  });
});

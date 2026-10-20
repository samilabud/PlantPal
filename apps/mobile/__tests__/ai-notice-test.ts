import { Alert, Linking, type AlertButton } from 'react-native';

import { confirmAiNotice } from '@/ai/identify';
import { hasSeen, markSeen } from '@/data/first-run';

jest.mock('@/db/database', () => ({ getDb: jest.fn(async () => ({})) }));
jest.mock('@/data/first-run', () => ({ hasSeen: jest.fn(), markSeen: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({}));
jest.mock('expo-file-system', () => ({}));

/** Answers the dialog by tapping the button with this text. */
const tap = (text: string) =>
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    (buttons as AlertButton[]).find((b) => b.text === text)!.onPress!();
  });

describe('first-use notice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('explains where the photo goes and is marked seen only after Continue', async () => {
    (hasSeen as jest.Mock).mockResolvedValue(false);
    const alert = tap('Continue');
    await expect(confirmAiNotice()).resolves.toBe(true);
    expect(alert.mock.calls[0]![1]).toMatch(/sends this photo to Anthropic's AI service/);
    expect(markSeen).toHaveBeenCalledWith({}, 'seenAiNotice');
  });

  it('Cancel stops the identification and asks again next time', async () => {
    (hasSeen as jest.Mock).mockResolvedValue(false);
    tap('Cancel');
    await expect(confirmAiNotice()).resolves.toBe(false);
    expect(markSeen).not.toHaveBeenCalled();
  });

  it('links to the privacy policy', async () => {
    (hasSeen as jest.Mock).mockResolvedValue(false);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    tap('Privacy policy');
    await expect(confirmAiNotice()).resolves.toBe(false);
    expect(open).toHaveBeenCalledWith('https://plantpal-api.vercel.app/privacy');
  });

  it('is not shown again once accepted', async () => {
    (hasSeen as jest.Mock).mockResolvedValue(true);
    const alert = jest.spyOn(Alert, 'alert');
    await expect(confirmAiNotice()).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });
});

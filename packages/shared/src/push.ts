import { z } from 'zod';

/** Expo push tokens look like ExponentPushToken[xxxx] (older) or ExpoPushToken[xxxx]. */
export const ExpoPushToken = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Not an Expo push token');

export const RegisterDeviceRequest = z.object({
  expoPushToken: ExpoPushToken,
  platform: z.enum(['ios', 'android']),
});
export type RegisterDeviceRequest = z.infer<typeof RegisterDeviceRequest>;

export const UnregisterDeviceRequest = z.object({ expoPushToken: ExpoPushToken });
export type UnregisterDeviceRequest = z.infer<typeof UnregisterDeviceRequest>;

export const TestPushRequest = z.object({ plantId: z.uuid().optional() });
export type TestPushRequest = z.infer<typeof TestPushRequest>;

export const PushSendResult = z.object({
  devices: z.number().int(),
  accepted: z.number().int(),
  failed: z.number().int(),
  removedTokens: z.number().int(),
});
export type PushSendResult = z.infer<typeof PushSendResult>;

/** Notification payload contract: `url` is an in-app path that the app navigates to on tap. */
export const NotificationData = z.object({ url: z.string().startsWith('/') });
export type NotificationData = z.infer<typeof NotificationData>;

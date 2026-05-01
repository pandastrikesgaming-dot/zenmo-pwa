export type PushTokenPlatform = 'android' | 'ios';

export type RegisterPushTokenInput = {
  userId: string;
  expoPushToken: string;
  platform: PushTokenPlatform;
};

export type RequestNotificationEventType = 'created' | 'fulfilled';

export type TriggerRequestNotificationInput = {
  requestId: string;
};

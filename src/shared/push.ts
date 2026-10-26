/**
 * Push notifications via the free Expo push service (no Firebase console
 * code, no paid provider). Founder decision by Ali, 2026-10-25, lifts the
 * earlier "no push yet" rule.
 *
 * Delivery is server-side: every row in public.notifications is handed to
 * Expo by a database trigger (migration 0049), so the app's only jobs are:
 *  1. ask permission IN CONTEXT — right after the first booking request, or
 *     when a barber goes on the way — never at app entry, and only once;
 *  2. register this device's token for the signed-in user (and drop it on
 *     sign-out, so a shared phone never receives the previous user's pushes);
 *  3. open the right screen when a push is tapped.
 *
 * Everything here is best effort: a device without push (simulator, Expo Go
 * on Android, permission denied) simply keeps the in-app notification feed.
 */
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { supabase } from '../../lib/supabase';
import { getAppLanguage } from './locale';
import type { NotificationEventType } from './notifications';
import { devWarn } from './devLog';

const ASKED_KEY = 'privelier.push.asked.v1';
const TOKEN_KEY = 'privelier.push.token.v1';

export interface PushOpenData {
  notificationId?: string;
  bookingId?: string;
  eventType?: NotificationEventType;
}

let configured = false;

/** Foreground presentation + Android channels. Idempotent. */
export function configurePush(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('default', {
      name: 'Bookings and messages',
      importance: AndroidImportance.DEFAULT,
    });
    void Notifications.setNotificationChannelAsync('trip', {
      name: 'Barber arrival',
      description: 'Your barber is on the way, almost there, or has arrived.',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 180, 120, 180],
      lightColor: '#BFA06B',
    });
  }
}

/** Expo Go on Android cannot receive remote push since SDK 53. */
function pushSupported(): boolean {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') return false;
  return true;
}

function projectId(): string | undefined {
  return (
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    Constants.easConfig?.projectId
  );
}

async function registerToken(): Promise<boolean> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: projectId() });
    const { error } = await supabase.rpc('register_push_token', {
      p_token: data,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_language: getAppLanguage() === 'de' ? 'de' : 'en',
    });
    if (error) {
      devWarn('[push] register failed', error);
      return false;
    }
    await AsyncStorage.setItem(TOKEN_KEY, data);
    return true;
  } catch (raw) {
    devWarn('[push] token unavailable', raw);
    return false;
  }
}

/**
 * Silent refresh for a signed-in user who already granted permission
 * (tokens rotate; language may have changed). Never shows a prompt.
 */
export async function refreshPushRegistration(): Promise<void> {
  if (!pushSupported()) return;
  configurePush();
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') await registerToken();
}

/**
 * Ask once, at a moment where the value is obvious. Returns whether push is
 * now enabled. A previous "no" is respected: we never re-prompt (the OS
 * would ignore it anyway on iOS).
 */
export async function askForPushPermissionInContext(): Promise<boolean> {
  if (!pushSupported()) return false;
  configurePush();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return registerToken();
    if ((await AsyncStorage.getItem(ASKED_KEY)) || !current.canAskAgain) return false;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    const asked = await Notifications.requestPermissionsAsync();
    return asked.status === 'granted' ? registerToken() : false;
  } catch (raw) {
    devWarn('[push] permission flow failed', raw);
    return false;
  }
}

/** Called before sign-out while the session is still valid. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await supabase.rpc('unregister_push_token', { p_token: token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (raw) {
    devWarn('[push] unregister failed', raw);
  }
}

/**
 * Routes taps on pushes — including the one that cold-started the app — to
 * `onOpen`. Mount once per app, in a screen that stays mounted (the tabs).
 */
export function usePushOpen(onOpen: (data: PushOpenData) => void): void {
  const handler = useRef(onOpen);
  useEffect(() => {
    handler.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    configurePush();
    void refreshPushRegistration();
    const handled = new Set<string>();
    const route = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (handled.has(id)) return;
      handled.add(id);
      handler.current((response.notification.request.content.data ?? {}) as PushOpenData);
    };
    void Notifications.getLastNotificationResponseAsync().then(route);
    const subscription = Notifications.addNotificationResponseReceivedListener(route);
    return () => subscription.remove();
  }, []);
}

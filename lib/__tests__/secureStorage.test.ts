import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { secureStorage } from '../secureStorage';

jest.mock('expo-secure-store', () => {
  const keys = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => keys.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      keys.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      keys.delete(key);
    }),
  };
});

const KEY = 'sb-test-auth-token';

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('round-trips a stored session', async () => {
  await secureStorage.setItem(KEY, '{"access_token":"abc"}');
  await expect(secureStorage.getItem(KEY)).resolves.toBe('{"access_token":"abc"}');
});

it('treats an unreadable encryption key as signed out instead of throwing', async () => {
  await secureStorage.setItem(KEY, '{"access_token":"abc"}');
  // e.g. Android Keystore key missing after an app-data backup restore.
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('Could not decrypt the value'));

  await expect(secureStorage.getItem(KEY)).resolves.toBeNull();
  // The unusable blob is cleared, so the next launch starts cleanly.
  await expect(AsyncStorage.getItem(KEY)).resolves.toBeNull();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(KEY);
});

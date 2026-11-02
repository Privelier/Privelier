import { Platform } from 'react-native';
import { isOAuthProviderEnabled } from '../authService';

jest.mock('../../../lib/supabase', () => ({ supabase: { auth: {} } }));

const originalOS = Platform.OS;

function setup(os: 'ios' | 'android', providers: string | undefined) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
  if (providers === undefined) delete process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;
  else process.env.EXPO_PUBLIC_OAUTH_PROVIDERS = providers;
}

afterEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
  delete process.env.EXPO_PUBLIC_OAUTH_PROVIDERS;
});

it('hides every provider until the project lists one', () => {
  setup('ios', undefined);
  expect(isOAuthProviderEnabled('google')).toBe(false);
  expect(isOAuthProviderEnabled('apple')).toBe(false);
});

it('shows the listed providers on iOS', () => {
  setup('ios', ' Apple, google ');
  expect(isOAuthProviderEnabled('apple')).toBe(true);
  expect(isOAuthProviderEnabled('google')).toBe(true);
});

it('never offers Google on iOS without Sign in with Apple', () => {
  setup('ios', 'google');
  expect(isOAuthProviderEnabled('google')).toBe(false);
});

it('offers Google alone on Android and never Apple there', () => {
  setup('android', 'google,apple');
  expect(isOAuthProviderEnabled('google')).toBe(true);
  expect(isOAuthProviderEnabled('apple')).toBe(false);
});

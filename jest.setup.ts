/**
 * Global Jest setup for the Expo/RN test environment.
 *
 * lib/supabase.ts throws at import time if these env vars are missing. Every
 * test that touches auth code mocks '../../lib/supabase' directly, but this
 * keeps any accidental un-mocked import from crashing the whole suite with a
 * confusing "Missing EXPO_PUBLIC_SUPABASE_URL" error instead of a real test
 * failure.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL ??= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Screen tests run without a native Worklets runtime. Focused motion tests
// replace this with their own stateful mock when they assert animation values.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => (value: number) => value },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useReducedMotion: () => false,
    useSharedValue: (initial: number) => {
      let value = initial;
      return {
        get: () => value,
        set: (next: number) => { value = next; },
        get value() { return value; },
        set value(next: number) { value = next; },
      };
    },
    useAnimatedStyle: (updater: () => unknown) => updater(),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
  };
});

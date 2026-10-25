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
    default: {
      View,
      ScrollView: jest.requireActual('react-native').ScrollView,
      // Animated SVG parts (SuccessBurst) render as their plain component.
      createAnimatedComponent: <T,>(component: T) => component,
    },
    Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    interpolate: (value: number, input: number[], output: number[]) =>
      value <= input[0] ? output[0] : value >= input[input.length - 1] ? output[output.length - 1] : output[0],
    useAnimatedScrollHandler: () => () => {},
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
    withDelay: (_ms: number, value: number) => value,
    withRepeat: (value: number) => value,
    cancelAnimation: () => {},
    useAnimatedProps: (updater: () => unknown) => updater(),
    // Layout-animation builders are chainable no-ops under Jest; the
    // `entering` prop they produce is ignored by the plain View above.
    FadeInDown: new Proxy({}, { get: () => function chain() { return new Proxy({}, { get: () => chain }); } }),
    FadeIn: new Proxy({}, { get: () => function chain() { return new Proxy({}, { get: () => chain }); } }),
    FadeOut: new Proxy({}, { get: () => function chain() { return new Proxy({}, { get: () => chain }); } }),
  };
});

// NetInfo's native module is absent under Jest; the package ships this mock.
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js')
);

// @gorhom/bottom-sheet needs a native Reanimated runtime. Screens that only
// embed a sheet should still render under Jest; sheets themselves are
// exercised through their own focused tests with explicit mocks.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View, TextInput } = jest.requireActual('react-native') as typeof import('react-native');
  const BottomSheetModal = React.forwardRef(function BottomSheetModal(_props: object, ref) {
    React.useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }));
    return null;
  });
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetModalProvider: ({ children }: { children?: React.ReactNode }) => children,
    BottomSheetView: View,
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: () => null,
  };
});

// AsyncStorage's native module is absent under Jest; the package ships this mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-image-manipulator is native-only. The mock re-encodes to a predictable
// JPEG URI so upload tests can assert that the normalized file is uploaded.
jest.mock('expo-image-manipulator', () => {
  const ref = (width: number, height: number) => ({
    width,
    height,
    saveAsync: jest.fn(async () => ({ uri: 'file:///normalized.jpg', width, height })),
  });
  interface MockContext { resize: jest.Mock; renderAsync: jest.Mock }
  const manipulate = jest.fn(() => {
    const context: MockContext = {
      resize: jest.fn(() => context),
      renderAsync: jest.fn(async () => ref(1024, 768)),
    };
    return context;
  });
  return { ImageManipulator: { manipulate }, SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' } };
});

// react-native-webview resolves its TurboModule at import time; the map's
// Expo Go/web fallback renderer imports it. Screens under test render a plain
// View in its place (map behaviour is covered by the scene/geo unit tests).
jest.mock('react-native-webview', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const WebView = React.forwardRef(function WebView(props: Record<string, unknown>, ref: unknown) {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
    return React.createElement(View, { testID: props.testID });
  });
  return { WebView, default: WebView };
});

// Icon/web fonts load through expo-asset's registry, which has no entries
// under Jest (jest-expo 58 stopped stubbing it). Treat every font as loaded.
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn(async () => undefined),
  useFonts: () => [true, null],
  unloadAllAsync: jest.fn(async () => undefined),
  getLoadedFonts: () => [],
}));

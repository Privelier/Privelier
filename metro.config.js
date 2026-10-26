const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Agent tooling and generated graphs are never app code. Metro watches every
// file it does not block, and a browser profile under .claude/ churns
// constantly — leaving it watched kept the dev server re-scanning for hours.
const toolingDirs = /[\\/](\.claude|graphify-out)[\\/].*/;
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  toolingDirs,
];

// Startup speed: evaluate a module only when it is first used instead of
// all modules at launch (screens the user never opens never run). Side-effect
// imports such as index.ts's trip task registration are unaffected.
const baseTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (...args) => {
  const options = await baseTransformOptions(...args);
  return { ...options, transform: { ...options.transform, inlineRequires: true } };
};

// Expo's own resolver (handles platform aliases such as react-native-web);
// captured before NativeWind wraps it.
const expoResolveRequest = config.resolver.resolveRequest;
const nativewindConfig = withNativewind(config, { inlineRem: 16 });

// NativeWind 5 (react-native-css 3.0.x) redirects EVERY `react-native` import
// to its className-aware component shim. That shim lacks some React Native
// APIs — notably `NativeComponentRegistry`, which expo-modules-core 58 uses to
// create native views — so on SDK 58 any Expo native view crashed at load
// ("Cannot read property 'get' of undefined", first hit via the Apple sign-in
// button). Third-party packages never use `className`, so they get the real
// React Native; our own code keeps the shim. (react-native-css 3.1 adds the
// export; drop this once NativeWind ships a stable release with it.)
const cssResolveRequest = nativewindConfig.resolver.resolveRequest;
const fromNodeModules = /[\\/]node_modules[\\/]/;
const fromCssRuntime = /[\\/]node_modules[\\/](react-native-css|nativewind)[\\/]/;
nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform !== 'web' &&
    moduleName === 'react-native' &&
    fromNodeModules.test(context.originModulePath) &&
    !fromCssRuntime.test(context.originModulePath)
  ) {
    return expoResolveRequest
      ? expoResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  }
  return cssResolveRequest
    ? cssResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = nativewindConfig;

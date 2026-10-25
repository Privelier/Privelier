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

module.exports = withNativewind(config, { inlineRem: 16 });

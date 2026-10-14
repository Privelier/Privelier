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

module.exports = withNativewind(config, { inlineRem: 16 });

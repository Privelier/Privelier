/**
 * Dynamic Expo config — extends app.json (Expo merges: app.json is loaded
 * first, then this function transforms it).
 *
 * Sole purpose: inject the @rnmapbox/maps config plugin with the Mapbox
 * SECRET download token (Downloads:Read scope) WITHOUT the token ever
 * touching git. The token lives ONLY in EAS env ("RNMAPBOX_DOWNLOAD_TOKEN",
 * visibility: secret, all three environments) and is injected into the build
 * environment by EAS; app.json stays static and committed.
 *
 * The plugin entry is added ONLY when the env var is present:
 *  - EAS builds: the secret is present -> plugin configures the Mapbox maven
 *    credentials so Gradle/CocoaPods can download the native SDK.
 *  - Local `expo start` / tooling: the var is absent -> no plugin entry, and
 *    nothing breaks (config plugins only execute during prebuild anyway).
 *
 * DO NOT put the sk. token in this file, app.json, or .env — the public
 * pk. token (EXPO_PUBLIC_MAPBOX_TOKEN, runtime API access) is the only
 * Mapbox value allowed in .env, and no Mapbox value is allowed in git.
 */
module.exports = ({ config }) => {
  // Primary name is our EAS secret; the second is @rnmapbox/maps 10.3+'s
  // canonical env name (the plugin prop is deprecated in favor of it), so a
  // future rename of the EAS variable keeps working without touching this.
  const downloadToken =
    process.env.RNMAPBOX_DOWNLOAD_TOKEN ?? process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ...(downloadToken
        ? [["@rnmapbox/maps", { RNMapboxMapsDownloadToken: downloadToken }]]
        : []),
    ],
  };
};

/**
 * Dynamic Expo config — extends app.json (Expo merges: app.json is loaded
 * first, then this function transforms it).
 *
 * Maps are MapLibre + OpenFreeMap (app.json plugin "@maplibre/maplibre-react-native"):
 * open source, no API key, no download token and no secret of any kind, so
 * nothing map-related needs EAS secrets anymore. (The former Mapbox
 * RNMAPBOX_DOWNLOAD_TOKEN EAS secret can be deleted.)
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [...(config.plugins ?? []), 'expo-web-browser'],
});

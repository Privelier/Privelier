// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

// CLAUDE.md: "Two completely separate mobile apps (Customer app, Barber app)
// ... They must never share UI or navigation." Enforce that boundary in
// tooling, not just convention, so an accidental cross-import fails lint.
const noRestrictedImports = (forbiddenGroup, message) => ({
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{ group: forbiddenGroup, message }],
    }],
  },
});

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: ['src/customer/**/*.{ts,tsx}'],
    ...noRestrictedImports(
      ['**/barber/**'],
      'Customer code must not import from src/barber — CLAUDE.md requires the two apps never share UI or navigation.'
    ),
  },
  {
    files: ['src/barber/**/*.{ts,tsx}'],
    ...noRestrictedImports(
      ['**/customer/**'],
      'Barber code must not import from src/customer — CLAUDE.md requires the two apps never share UI or navigation.'
    ),
  },
]);

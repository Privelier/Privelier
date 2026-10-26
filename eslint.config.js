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
    ignores: ["dist/*", "supabase/functions/**", "graphify-out/**", "artifacts/**", ".claude/**"],
  },
  {
    // Hardening 2026-10-26: no stray logging (src/shared/devLog.ts is the
    // one dev-only exit), no untyped values, and no promise whose failure
    // is silently dropped.
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
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

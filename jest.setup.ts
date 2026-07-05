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

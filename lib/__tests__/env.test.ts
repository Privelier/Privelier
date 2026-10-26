import { readClientEnv } from '../env';

const URL = 'https://abcdefghijklmnop.supabase.co';

function jwt(role: string): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256' })}.${encode({ role })}.signature`;
}

describe('readClientEnv', () => {
  it('accepts the project URL with a publishable key', () => {
    expect(readClientEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' })).toEqual({
      supabaseUrl: URL,
      supabasePublishableKey: 'sb_publishable_abc',
    });
  });

  it('still accepts a legacy anon key during the key migration', () => {
    expect(() => readClientEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt('anon') })).not.toThrow();
  });

  it.each([
    ['a secret key', 'sb_secret_abc'],
    ['a legacy service_role key', jwt('service_role')],
  ])('refuses to start with %s in the app', (_label, key) => {
    expect(() => readClientEnv({ EXPO_PUBLIC_SUPABASE_URL: URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })).toThrow(/SECRET key/);
  });

  it.each([
    [{ EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }, /SUPABASE_URL/],
    [{ EXPO_PUBLIC_SUPABASE_URL: 'http://insecure.example', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc' }, /https/],
    [{ EXPO_PUBLIC_SUPABASE_URL: URL }, /PUBLISHABLE_KEY is missing/],
  ])('explains a missing or invalid value', (source, message) => {
    expect(() => readClientEnv(source)).toThrow(message);
  });
});

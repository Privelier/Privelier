export type AppLanguage = 'de' | 'en';

export function getAppLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale): AppLanguage {
  return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/**
 * Prefill for the optional Country field: most of Privelier's barbers are in
 * Nuremberg today, so Germany is the likely answer. It stays a plain,
 * editable suggestion — the app remains open in every location.
 */
export function defaultCountry(): string {
  return getAppLanguage() === 'de' ? 'Deutschland' : 'Germany';
}

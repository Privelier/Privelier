export type AppLanguage = 'de' | 'en';

export function getAppLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale): AppLanguage {
  return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
}

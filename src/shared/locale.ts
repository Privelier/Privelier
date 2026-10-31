export type AppLanguage = 'de' | 'en';

export function getAppLanguage(locale = Intl.DateTimeFormat().resolvedOptions().locale): AppLanguage {
  return locale.toLowerCase().startsWith('de') ? 'de' : 'en';
}

const COUNTRY_NAMES: Record<string, { de: string; en: string }> = {
  DE: { de: 'Deutschland', en: 'Germany' },
  AT: { de: 'Österreich', en: 'Austria' },
  CH: { de: 'Schweiz', en: 'Switzerland' },
};

/**
 * Prefill for the optional Country field, from the device region. Privelier
 * is open in every location, so an unknown region leaves the field empty
 * instead of guessing Germany; the value is always an editable suggestion.
 */
export function defaultCountry(locale = Intl.DateTimeFormat().resolvedOptions().locale): string {
  const region = locale.split(/[-_]/).find((part, index) => index > 0 && /^[A-Za-z]{2}$/.test(part));
  const names = region ? COUNTRY_NAMES[region.toUpperCase()] : undefined;
  return names ? names[getAppLanguage(locale)] : '';
}

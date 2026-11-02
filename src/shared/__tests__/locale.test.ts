import { defaultCountry, getAppLanguage } from '../locale';

describe('getAppLanguage', () => {
  it('uses German for German device locales and English as the fallback', () => {
    expect(getAppLanguage('de-DE')).toBe('de');
    expect(getAppLanguage('de-AT')).toBe('de');
    expect(getAppLanguage('en-US')).toBe('en');
    expect(getAppLanguage('fr-FR')).toBe('en');
  });
});

describe('defaultCountry', () => {
  it('names the device region in the app language', () => {
    expect(defaultCountry('de-DE')).toBe('Deutschland');
    expect(defaultCountry('en-DE')).toBe('Germany');
    expect(defaultCountry('de-AT')).toBe('Österreich');
    expect(defaultCountry('de-Latn-CH')).toBe('Schweiz');
  });

  it('leaves the field empty for other or missing regions (open in every location)', () => {
    expect(defaultCountry('en-US')).toBe('');
    expect(defaultCountry('fr-FR')).toBe('');
    expect(defaultCountry('en')).toBe('');
  });
});

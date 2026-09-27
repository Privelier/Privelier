import { getAppLanguage } from '../locale';

describe('getAppLanguage', () => {
  it('uses German for German device locales and English as the fallback', () => {
    expect(getAppLanguage('de-DE')).toBe('de');
    expect(getAppLanguage('de-AT')).toBe('de');
    expect(getAppLanguage('en-US')).toBe('en');
    expect(getAppLanguage('fr-FR')).toBe('en');
  });
});

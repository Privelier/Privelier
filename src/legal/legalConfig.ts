/**
 * Placeholder legal configuration. Replace every URL and version before any
 * store submission or production launch.
 */
export const LEGAL_URLS = {
  impressum: 'https://example.com/privelier-placeholder/impressum',
  privacy: 'https://example.com/privelier-placeholder/datenschutzerklaerung',
  customerTerms: 'https://example.com/privelier-placeholder/nutzungsbedingungen-kunden',
  barberTerms: 'https://example.com/privelier-placeholder/nutzungsbedingungen-barbiere',
} as const;

export const LEGAL_VERSIONS = {
  privacy: 'placeholder-privacy-v1',
  customerTerms: 'placeholder-customer-terms-v1',
  barberTerms: 'placeholder-barber-terms-v1',
} as const;

export type LegalDocument = keyof typeof LEGAL_URLS;

/** Consent versions remain stable until approved legal texts replace these drafts. */
export const LEGAL_VERSIONS = {
  privacy: 'placeholder-privacy-v1',
  customerTerms: 'placeholder-customer-terms-v1',
  barberTerms: 'placeholder-barber-terms-v1',
} as const;

export type LegalDocument = 'impressum' | 'privacy' | 'customerTerms' | 'barberTerms';

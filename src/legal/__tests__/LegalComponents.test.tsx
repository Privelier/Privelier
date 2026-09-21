import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { LegalConsentFields, LegalLinks, openLegalDocument } from '../LegalComponents';
import { LEGAL_URLS } from '../legalConfig';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
}));

jest.mock('../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8',
      textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214',
      error: '#A8453E', errorText: '#A8453E', success: '#51785C', successText: '#51785C',
    },
    fonts: { body: 'sans', bodyMedium: 'sans', headingMedium: 'serif' },
  }),
}));

const mockOpenBrowser = WebBrowser.openBrowserAsync as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('legal infrastructure', () => {
  it('keeps all four placeholder documents in one config and opens the selected URL', async () => {
    await openLegalDocument('privacy');
    expect(mockOpenBrowser).toHaveBeenCalledWith(LEGAL_URLS.privacy);
    expect(Object.values(LEGAL_URLS).every((url) => url.includes('placeholder'))).toBe(true);
  });

  it('shows both app terms from the account placement', async () => {
    await render(<LegalLinks includeAll testIDPrefix="account-legal" />);
    expect(screen.getByTestId('account-legal-impressum')).toBeTruthy();
    expect(screen.getByTestId('account-legal-privacy')).toBeTruthy();
    expect(screen.getByTestId('account-legal-customerTerms')).toBeTruthy();
    expect(screen.getByTestId('account-legal-barberTerms')).toBeTruthy();
  });

  it('starts consent unchecked and toggles both required confirmations', async () => {
    await render(
      <LegalConsentFields
        role="barber"
        termsAccepted={false}
        adultConfirmed={false}
        onTermsChange={jest.fn()}
        onAdultChange={jest.fn()}
        testIDPrefix="signup"
      />
    );
    expect(screen.getByTestId('signup-legal-terms').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('signup-legal-adult').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('signup-legal-terms-link')).toBeTruthy();
    expect(screen.getByTestId('signup-legal-privacy-link')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('signup-legal-terms'));
    await fireEvent.press(screen.getByTestId('signup-legal-adult'));
  });
});

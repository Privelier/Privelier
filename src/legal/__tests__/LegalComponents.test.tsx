import { fireEvent, render, screen } from '@testing-library/react-native';
import { LegalConsentFields, LegalLinks } from '../LegalComponents';
import impressum from '../documents/impressum';
import privacy from '../documents/privacy';
import customerTerms from '../documents/customerTerms';
import barberTerms from '../documents/barberTerms';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));

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

beforeEach(() => jest.clearAllMocks());

describe('legal infrastructure', () => {
  it('bundles all four draft texts and opens legal documents in the app', async () => {
    expect([impressum, privacy, customerTerms, barberTerms].every((text) => text.startsWith('ENTWURF, NOCH NICHT RECHTSVERBINDLICH'))).toBe(true);
    await render(<LegalLinks role="customer" testIDPrefix="login-legal" />);
    await fireEvent.press(screen.getByTestId('login-legal-privacy'));
    expect(mockNavigate).toHaveBeenCalledWith('Legal', { document: 'privacy' });
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
    await fireEvent.press(screen.getByTestId('signup-legal-terms-link'));
    expect(mockNavigate).toHaveBeenCalledWith('Legal', { document: 'barberTerms' });
  });
});

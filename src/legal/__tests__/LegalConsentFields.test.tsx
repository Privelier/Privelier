import { render, screen } from '@testing-library/react-native';
import { LegalConsentFields, LegalLinks } from '../LegalComponents';
import { getAppLanguage } from '../../shared/locale';

jest.mock('../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

const mockLanguage = getAppLanguage as jest.MockedFunction<typeof getAppLanguage>;

function renderConsent() {
  return render(
    <LegalConsentFields
      role="customer"
      termsAccepted={false}
      adultConfirmed={false}
      onTermsChange={jest.fn()}
      onAdultChange={jest.fn()}
      testIDPrefix="t"
    />
  );
}

describe('legal consent copy', () => {
  it('reads entirely in English for English users, with inline links and a German-documents note', async () => {
    mockLanguage.mockReturnValue('en');
    await renderConsent();
    expect(screen.getByText(/I accept the .* and confirm I have read the .* \(both in German\)\./)).toBeTruthy();
    expect(screen.getByTestId('t-legal-terms-link').props.children).toBe('Customer terms');
    expect(screen.getByTestId('t-legal-privacy-link').props.children).toBe('Privacy policy');
    expect(screen.getByText('I confirm that I am at least 18 years old.')).toBeTruthy();
    expect(screen.queryByText(/Ich akzeptiere/)).toBeNull();
  });

  it('keeps the German statement for German users, linking the privacy policy once, inside the sentence', async () => {
    mockLanguage.mockReturnValue('de');
    await renderConsent();
    expect(screen.getByText(/Ich akzeptiere die .* und bestätige, die .* zur Kenntnis genommen zu haben\./)).toBeTruthy();
    expect(screen.getByTestId('t-legal-privacy-link').props.children).toBe('Datenschutzerklärung');
    expect(screen.getAllByText('Datenschutzerklärung')).toHaveLength(1);
  });

  it('labels footer links in the app language', async () => {
    mockLanguage.mockReturnValue('en');
    await render(<LegalLinks role="barber" testIDPrefix="f" />);
    expect(screen.getByText('Legal notice')).toBeTruthy();
    expect(screen.getByText('Barber terms')).toBeTruthy();
  });
});

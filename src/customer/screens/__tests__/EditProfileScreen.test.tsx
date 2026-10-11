import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fetchOwnProfile } from '../../../auth/authService';
import { updateOwnProfile } from '../../profileData';
import EditProfileScreen from '../EditProfileScreen';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../profileData', () => ({ updateOwnProfile: jest.fn() }));
// The gluestack Input cannot be transformed under Jest; a plain TextInput
// keeps the field contract (value, testID, keyboard chain) observable.
jest.mock('../../../auth/screens/ui', () => {
  const React = jest.requireActual('react');
  const { TextInput } = jest.requireActual('react-native');
  return {
    FormTextField: ({ value, onChangeText, testID, returnKeyType, onSubmitEditing, inputRef }: Record<string, never>) =>
      React.createElement(TextInput, { value, onChangeText, testID, returnKeyType, onSubmitEditing, ref: inputRef }),
  };
});
jest.mock('../../../shared/components/ScreenBackHeader', () => ({ ScreenBackHeader: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', error: '#A8453E', errorText: '#CE7A73', onAccent: '#121214' },
    fonts: { headingMedium: 'Playfair', body: 'Inter', bodyMedium: 'Inter' },
  }),
}));

const navigation = { goBack: jest.fn() };
const profile = { name: 'Lena Weber', city: 'Berlin', country: 'Germany' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchOwnProfile).mockResolvedValue({ status: 'ok', profile: profile as never });
});

async function renderLoaded() {
  await render(<EditProfileScreen navigation={navigation as never} route={{} as never} />);
  await waitFor(() => expect(screen.getByTestId('customer-edit-profile-city').props.value).toBe('Berlin'));
}

it('keeps unsaved edits after a failed save and retries the same edits', async () => {
  await renderLoaded();
  jest.mocked(updateOwnProfile).mockResolvedValueOnce({
    status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true,
  } as never);

  await fireEvent.changeText(screen.getByTestId('customer-edit-profile-city'), 'Munich');
  await fireEvent.press(screen.getByTestId('customer-edit-profile-save'));

  await waitFor(() => expect(screen.getByTestId('customer-edit-profile-save-error')).toBeTruthy());
  expect(screen.getByText('Your changes are still here.')).toBeTruthy();
  expect(screen.getByTestId('customer-edit-profile-city').props.value).toBe('Munich');
  // The failed save must not trigger a reload that would overwrite the edit.
  expect(fetchOwnProfile).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('customer-edit-profile-retry')).toBeNull();

  jest.mocked(updateOwnProfile).mockResolvedValueOnce({ status: 'ok' } as never);
  await fireEvent.press(screen.getByTestId('customer-edit-profile-save'));
  await waitFor(() => expect(navigation.goBack).toHaveBeenCalledTimes(1));
  expect(updateOwnProfile).toHaveBeenLastCalledWith({ name: 'Lena Weber', city: 'Munich', country: 'Germany' });
});

it('hides the form after a failed load so empty fields can never be saved', async () => {
  jest.mocked(fetchOwnProfile).mockResolvedValueOnce({
    status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true,
  } as never);
  await render(<EditProfileScreen navigation={navigation as never} route={{} as never} />);

  await waitFor(() => expect(screen.getByTestId('customer-edit-profile-retry')).toBeTruthy());
  expect(screen.queryByTestId('customer-edit-profile-save')).toBeNull();

  await fireEvent.press(screen.getByTestId('customer-edit-profile-retry'));
  await waitFor(() => expect(screen.getByTestId('customer-edit-profile-city').props.value).toBe('Berlin'));
  expect(screen.queryByTestId('customer-edit-profile-error')).toBeNull();
});

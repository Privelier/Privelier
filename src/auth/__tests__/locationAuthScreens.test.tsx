import { fireEvent, render, screen } from '@testing-library/react-native';
import SignupScreen from '../screens/SignupScreen';
import LoginScreen from '../screens/LoginScreen';
import { signIn, signInWithProvider, signUpBarber, signUpCustomer } from '../authService';
import { checkLocationEligibility } from '../../location/locationEligibility';

jest.mock('../authService', () => ({
  signIn: jest.fn(),
  signInWithProvider: jest.fn(),
  signUpBarber: jest.fn(),
  signUpCustomer: jest.fn(),
}));
jest.mock('../../location/locationEligibility', () => ({ checkLocationEligibility: jest.fn() }));
jest.mock('../../location/LocationAccessNotice', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  return { LocationAccessNotice: ({ testID }: { testID: string }) => React.createElement(Text, { testID }, 'Location required') };
});
jest.mock('../../theme/useTheme', () => ({
  useTheme: () => ({ colors: { textSecondary: '#9A968C' }, fonts: { body: 'sans' } }),
}));
jest.mock('../screens/ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, TextInput, View } = require('react-native');
  return {
    AuthScreenShell: ({ children, testID }: { children: unknown; testID: string }) => React.createElement(View, { testID }, children),
    BackLink: () => null,
    ScreenHeading: () => null,
    FormTextField: ({ testID, onChangeText, value }: { testID: string; onChangeText: (text: string) => void; value: string }) =>
      React.createElement(TextInput, { testID, onChangeText, value }),
    Notice: ({ testID, message }: { testID: string; message: string }) => React.createElement(Text, { testID }, message),
    PrimaryButton: ({ testID, onPress, disabled, loading }: { testID: string; onPress: () => void; disabled?: boolean; loading?: boolean }) =>
      React.createElement(Pressable, { testID, onPress, disabled: disabled || loading }),
    OAuthButton: ({ testID, onPress, disabled, loading }: { testID: string; onPress: () => void; disabled?: boolean; loading?: boolean }) =>
      React.createElement(Pressable, { testID, onPress, disabled: disabled || loading }),
    TextLink: ({ testID, onPress }: { testID: string; onPress: () => void }) => React.createElement(Pressable, { testID, onPress }),
  };
});

const location = { status: 'eligible' as const, city: 'Nuremberg' as const, country: 'Germany' as const };
const mockCheck = checkLocationEligibility as jest.Mock;
const mockCustomer = signUpCustomer as jest.Mock;
const mockBarber = signUpBarber as jest.Mock;
const mockSignIn = signIn as jest.Mock;
const mockProvider = signInWithProvider as jest.Mock;

it('checks location before both signup roles, login, and provider launch', async () => {
  mockCheck.mockResolvedValue(location);
  mockCustomer.mockResolvedValue({ status: 'confirmation_email_sent', email: 'alex@example.com' });
  mockBarber.mockResolvedValue({ status: 'confirmation_email_sent', email: 'alex@example.com' });
  mockSignIn.mockResolvedValue({ status: 'signed_in' });
  mockProvider.mockResolvedValue({ status: 'started' });
  const navigation = { navigate: jest.fn(), goBack: jest.fn() } as never;

  const rendered = await render(<SignupScreen navigation={navigation} route={{ params: { role: 'customer' } } as never} />);
  expect(screen.queryByTestId('auth-signup-city')).toBeNull();
  expect(screen.queryByTestId('auth-signup-country')).toBeNull();
  await fireEvent.changeText(screen.getByTestId('auth-signup-name'), 'Alex');
  await fireEvent.changeText(screen.getByTestId('auth-signup-email'), 'alex@example.com');
  await fireEvent.changeText(screen.getByTestId('auth-signup-password'), 'strongpassword');

  mockCheck.mockResolvedValueOnce({ status: 'outside_service_area' });
  await fireEvent.press(screen.getByTestId('auth-signup-submit'));
  expect(mockCustomer).not.toHaveBeenCalled();
  expect(screen.getByTestId('auth-signup-location-error')).toBeTruthy();

  await fireEvent.press(screen.getByTestId('auth-signup-submit'));
  expect(mockCustomer).toHaveBeenCalledWith('alex@example.com', 'strongpassword', { name: 'Alex', phone: undefined }, location);

  await rendered.rerender(<SignupScreen navigation={navigation} route={{ params: { role: 'barber' } } as never} />);
  await fireEvent.changeText(screen.getByTestId('auth-signup-bio'), 'Private cuts');
  await fireEvent.press(screen.getByTestId('auth-signup-submit'));
  expect(mockBarber).toHaveBeenCalledWith('alex@example.com', 'strongpassword', { name: 'Alex', phone: undefined, bio: 'Private cuts' }, location);

  mockCheck.mockResolvedValueOnce({ status: 'permission_denied' });
  await fireEvent.press(screen.getByTestId('auth-signup-google'));
  expect(mockProvider).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('auth-signup-apple'));
  expect(mockProvider).toHaveBeenCalledWith('apple');

  await rendered.rerender(<LoginScreen navigation={navigation} route={{ params: { role: 'customer' } } as never} />);
  await fireEvent.changeText(screen.getByTestId('auth-login-email'), 'alex@example.com');
  await fireEvent.changeText(screen.getByTestId('auth-login-password'), 'strongpassword');
  mockCheck.mockResolvedValueOnce({ status: 'unavailable' });
  await fireEvent.press(screen.getByTestId('auth-login-submit'));
  expect(mockSignIn).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('auth-login-submit'));
  expect(mockSignIn).toHaveBeenCalledWith('alex@example.com', 'strongpassword');

  mockCheck.mockResolvedValueOnce({ status: 'outside_service_area' });
  await fireEvent.press(screen.getByTestId('auth-login-apple'));
  expect(mockProvider).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByTestId('auth-login-google'));
  expect(mockProvider).toHaveBeenLastCalledWith('google');
});

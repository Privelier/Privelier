import { fireEvent, render, screen } from '@testing-library/react-native';
import BarberSettingsScreen from '../BarberSettingsScreen';

const mockSignOut = jest.fn();
jest.mock('../../../RoleContext', () => ({ useExitRole: () => mockSignOut }));
jest.mock('../../../legal/LegalComponents', () => ({ LegalLinks: () => null }));
jest.mock('../../../shared/components/DeleteAccountAction', () => {
  const React = jest.requireActual('react');
  const { Pressable } = jest.requireActual('react-native');
  return { DeleteAccountAction: ({ testID }: { testID: string }) => React.createElement(Pressable, { testID }) };
});
jest.mock('../../../shared/components/ScreenBackHeader', () => ({ ScreenBackHeader: () => null }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

it('gives the Barber app a home for profile edits, sign-out and account deletion', async () => {
  await render(<BarberSettingsScreen navigation={navigation as never} route={{} as never} />);

  await fireEvent.press(screen.getByTestId('barber-settings-row-bio'));
  expect(navigation.navigate).toHaveBeenCalledWith('BioEdit');
  await fireEvent.press(screen.getByTestId('barber-settings-row-location'));
  expect(navigation.navigate).toHaveBeenCalledWith('LocationEdit');

  await fireEvent.press(screen.getByTestId('barber-settings-logout'));
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('barber-settings-delete')).toBeTruthy();
});

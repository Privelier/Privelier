import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ServicesScreen from '../ServicesScreen';
import { deleteService, listOwnServices } from '../../servicesData';

const mockShowToast = jest.fn();

jest.mock('../../../shared/haptics', () => ({ haptics: { selection: jest.fn() } }));
jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { id: 'barber-1' } } } })) },
  },
}));
jest.mock('../../servicesData', () => ({
  listOwnServices: jest.fn(),
  deleteService: jest.fn(),
  createService: jest.fn(),
  updateService: jest.fn(),
}));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('../../../shared/components/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock('../../../shared/components/ConfirmSheet', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    ConfirmSheet: ({ open, message, onConfirm, onClose, testID }: { open: boolean; message: string; onConfirm: () => void; onClose: () => void; testID: string }) =>
      open
        ? React.createElement(View, { testID }, [
            React.createElement(Text, { key: 'm' }, message),
            React.createElement(Pressable, { key: 'k', testID: `${testID}-keep`, onPress: onClose }),
            React.createElement(Pressable, { key: 'c', testID: `${testID}-confirm`, onPress: onConfirm }),
          ])
        : null,
  };
});
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

const SERVICE = { id: 'svc-1', barber_id: 'barber-1', name: 'Skin fade', price: 25, duration_minutes: 30 };
const navigation = { goBack: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listOwnServices).mockResolvedValue({ status: 'ok', services: [SERVICE] } as never);
});

async function renderLoaded() {
  await render(<ServicesScreen navigation={navigation as never} route={{} as never} />);
  await waitFor(() => expect(screen.getByTestId('barber-services-row-svc-1')).toBeTruthy());
}

it('deletes only after the barber confirms in the sheet', async () => {
  jest.mocked(deleteService).mockResolvedValue({ status: 'ok' } as never);
  await renderLoaded();

  await fireEvent.press(screen.getByTestId('barber-services-delete-svc-1'));
  expect(screen.getByText('Delete "Skin fade"? This cannot be undone.')).toBeTruthy();
  expect(deleteService).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('barber-services-delete-confirm-keep'));
  expect(screen.queryByTestId('barber-services-delete-confirm')).toBeNull();
  expect(deleteService).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('barber-services-delete-svc-1'));
  await fireEvent.press(screen.getByTestId('barber-services-delete-confirm-confirm'));
  await waitFor(() => expect(screen.queryByTestId('barber-services-row-svc-1')).toBeNull());
  expect(deleteService).toHaveBeenCalledWith('svc-1');
  expect(mockShowToast).toHaveBeenCalledWith({ message: 'Deleted "Skin fade".' });
});

it('keeps the service and explains a failed delete in a toast', async () => {
  jest.mocked(deleteService).mockResolvedValue({
    status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true,
  } as never);
  await renderLoaded();

  await fireEvent.press(screen.getByTestId('barber-services-delete-svc-1'));
  await fireEvent.press(screen.getByTestId('barber-services-delete-confirm-confirm'));
  await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith({ message: 'Could not delete. We could not reach the server.' }));
  expect(screen.getByTestId('barber-services-row-svc-1')).toBeTruthy();
});

it('fills the duration from a preset chip and marks it selected', async () => {
  await renderLoaded();
  await fireEvent.press(screen.getByTestId('barber-services-duration-preset-45'));
  expect(screen.getByTestId('barber-services-duration').props.value).toBe('45');
  expect(screen.getByTestId('barber-services-duration-preset-45').props.accessibilityState).toMatchObject({ selected: true });
});

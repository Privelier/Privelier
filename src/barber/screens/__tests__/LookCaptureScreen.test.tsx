/**
 * LookCaptureScreen (Looks S2): the barber tags styles, adds a photo
 * (draft first, upload, then attach), confirms no face and sends. The data
 * layer and the system picker are mocked. RNTL v14 render() is async.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import LookCaptureScreen from '../LookCaptureScreen';
import { attachLookPhoto, fetchLookForBooking, fetchLookStyles, saveLookDraft, sendLook, signLookPhotos, uploadLookPhoto } from '../../../looks/looksData';

jest.mock('../../../shared/locale', () => ({ getAppLanguage: () => 'en' }));
jest.mock('../../../looks/looksData', () => ({
  attachLookPhoto: jest.fn(),
  fetchLookForBooking: jest.fn(),
  fetchLookStyles: jest.fn(),
  removeLookPhoto: jest.fn(),
  saveLookDraft: jest.fn(),
  sendLook: jest.fn(),
  signLookPhotos: jest.fn(),
  takeBackLook: jest.fn(),
  uploadLookPhoto: jest.fn(),
}));
const mockToast = jest.fn();
jest.mock('../../../shared/components/ToastProvider', () => ({ useToast: () => ({ showToast: mockToast }) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: { background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214', error: '#A8453E' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children) };
});

const DRAFT = {
  id: 'look-1', booking_id: 'b-1', barber_id: 'x', customer_id: 'a', service_id: 's', styles: ['skin_fade'], status: 'draft',
  no_face_confirmed: false, submitted_at: null, responded_at: null, consented_at: null, created_at: '2026-10-28T10:00:00Z', look_photos: [],
};
const route = { params: { bookingId: 'b-1', barberId: 'x', customerName: 'Ada', serviceName: 'Fade' } } as never;
const navigation = { goBack: jest.fn() } as never;

beforeEach(() => {
  jest.clearAllMocks();
  for (const fn of [attachLookPhoto, fetchLookForBooking, saveLookDraft, sendLook, uploadLookPhoto, ImagePicker.launchImageLibraryAsync]) {
    (fn as jest.Mock).mockReset();
  }
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [
    { key: 'skin_fade', label_en: 'Skin fade', label_de: 'Skin Fade', sort_order: 1 },
    { key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 },
  ] });
  (signLookPhotos as jest.Mock).mockResolvedValue(new Map());
});

it('captures a look: style, photo, no-face confirmation, send', async () => {
  (fetchLookForBooking as jest.Mock)
    .mockResolvedValueOnce({ status: 'ok', value: null })
    .mockResolvedValueOnce({ status: 'ok', value: { ...DRAFT, submitted_at: new Date().toISOString(), no_face_confirmed: true } });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cut.jpg' }] });
  (saveLookDraft as jest.Mock).mockResolvedValue({ status: 'ok', value: DRAFT });
  (uploadLookPhoto as jest.Mock).mockResolvedValue({ status: 'ok', value: 'x/look-1.jpg' });
  (attachLookPhoto as jest.Mock).mockResolvedValue({ status: 'ok', value: { id: 'p1', look_id: 'look-1', storage_path: 'x/look-1.jpg', position: 1 } });
  (sendLook as jest.Mock).mockResolvedValue({ status: 'ok', value: null });
  await render(<LookCaptureScreen route={route} navigation={navigation} />);

  const send = await screen.findByTestId('barber-look-capture-send');
  expect(send.props.accessibilityState).toMatchObject({ disabled: true });

  await fireEvent.press(screen.getByTestId('barber-look-capture-add-photo'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: 'Pick at least one style first.' }));
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByTestId('barber-look-capture-style-skin_fade'));
  await fireEvent.press(screen.getByTestId('barber-look-capture-add-photo'));
  expect(await screen.findByTestId('barber-look-capture-photo-1')).toBeTruthy();
  expect(saveLookDraft).toHaveBeenCalledWith({ bookingId: 'b-1', styles: ['skin_fade'], noFace: false });
  expect(uploadLookPhoto).toHaveBeenCalledWith('x', 'file:///cut.jpg');
  expect(attachLookPhoto).toHaveBeenCalledWith('look-1', 'x/look-1.jpg');

  expect(screen.getByTestId('barber-look-capture-send').props.accessibilityState).toMatchObject({ disabled: true });
  await fireEvent.press(screen.getByTestId('barber-look-capture-no-face'));
  await fireEvent.press(screen.getByTestId('barber-look-capture-send'));

  await waitFor(() => expect(sendLook).toHaveBeenCalledWith('look-1'));
  expect(saveLookDraft).toHaveBeenLastCalledWith({ bookingId: 'b-1', styles: ['skin_fade'], noFace: true });
  expect(await screen.findByText('Waiting for the client')).toBeTruthy();
});

it('never attaches a photo whose upload failed', async () => {
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: DRAFT });
  (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cut.jpg' }] });
  (uploadLookPhoto as jest.Mock).mockResolvedValue({ status: 'error', code: 'network', message: 'We could not reach the server.', retryable: true });
  await render(<LookCaptureScreen route={route} navigation={navigation} />);

  await fireEvent.press(await screen.findByTestId('barber-look-capture-add-photo'));
  await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ message: 'We could not reach the server.' }));
  expect(attachLookPhoto).not.toHaveBeenCalled();
  expect(saveLookDraft).not.toHaveBeenCalled();
});

it('shows where a sent look stands instead of the editor', async () => {
  (fetchLookForBooking as jest.Mock).mockResolvedValue({ status: 'ok', value: { ...DRAFT, status: 'published', submitted_at: '2026-10-28T10:00:00Z', no_face_confirmed: true } });
  await render(<LookCaptureScreen route={route} navigation={navigation} />);
  expect(await screen.findByText('Confirmed and shown')).toBeTruthy();
  expect(screen.getByTestId('barber-look-capture-withdraw')).toBeTruthy();
  expect(screen.queryByTestId('barber-look-capture-send')).toBeNull();
});

/**
 * LookReferenceNote (Looks S3/S4): which style the client booked, from a
 * feed look or a look search, and their private reference photo. RNTL v14
 * render() is async.
 */
import { render, screen } from '@testing-library/react-native';
import { LookReferenceNote } from '../LookReferenceNote';
import { fetchLookReference, fetchLookStyles, signReferencePhoto } from '../../../../looks/looksData';

jest.mock('../../../../looks/looksData', () => ({
  fetchLookReference: jest.fn(),
  fetchLookStyles: jest.fn(),
  signReferencePhoto: jest.fn(),
}));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: View };
});
jest.mock('../../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { border: '#2A2A2E', surface: '#1B1B1E', textPrimary: '#F5F1E8', accentText: '#BFA06B' },
    fonts: { body: 'sans' },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (fetchLookStyles as jest.Mock).mockResolvedValue({ status: 'ok', value: [{ key: 'taper', label_en: 'Taper', label_de: 'Taper', sort_order: 3 }] });
});

it('names the feed look the client booked from, without a photo', async () => {
  (fetchLookReference as jest.Mock).mockResolvedValue({ status: 'ok', value: { booking_id: 'b', look_id: 'l', style: 'taper' } });
  await render(<LookReferenceNote bookingId="b" de={false} />);
  expect(await screen.findByText('Booked from your look: Taper')).toBeTruthy();
  expect(signReferencePhoto).not.toHaveBeenCalled();
  expect(screen.queryByTestId('barber-look-reference-photo-b')).toBeNull();
});

it('shows a searched style with the client reference photo', async () => {
  (fetchLookReference as jest.Mock).mockResolvedValue({ status: 'ok', value: { booking_id: 'b', look_id: null, style: 'taper', photo_path: 'c/ref.jpg' } });
  (signReferencePhoto as jest.Mock).mockResolvedValue('https://signed/ref');
  await render(<LookReferenceNote bookingId="b" de />);
  expect(await screen.findByText('Gebucht über die Look-Suche: Taper')).toBeTruthy();
  expect(signReferencePhoto).toHaveBeenCalledWith('c/ref.jpg');
  expect(screen.getByTestId('barber-look-reference-photo-b').props.accessibilityLabel).toBe('Referenzfoto des Kunden, nur für dich');
});

it('renders nothing for an ordinary booking', async () => {
  (fetchLookReference as jest.Mock).mockResolvedValue({ status: 'ok', value: null });
  await render(<LookReferenceNote bookingId="b" de={false} />);
  expect(screen.queryByTestId('barber-look-reference-b')).toBeNull();
});

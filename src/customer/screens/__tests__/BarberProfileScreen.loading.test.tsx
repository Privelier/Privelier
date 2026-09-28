import { fireEvent, render, screen } from '@testing-library/react-native';
import { getBarberProfile, listPortfolioForBarber, listServicesForBarber } from '../../discoveryData';
import { fetchReviewsForBarber } from '../../reviewsData';
import BarberProfileScreen from '../BarberProfileScreen';

jest.mock('../../discoveryData', () => ({
  getBarberProfile: jest.fn(),
  listPortfolioForBarber: jest.fn(),
  listServicesForBarber: jest.fn(),
}));
jest.mock('../../reviewsData', () => ({ fetchReviewsForBarber: jest.fn() }));
jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('@expo/vector-icons', () => ({ Feather: () => null, Ionicons: () => null, MaterialCommunityIcons: () => null }));
jest.mock('../../../shared/components/ScreenBackHeader', () => ({
  BackButton: () => null,
  OVER_IMAGE_BG: '#121214',
  OVER_IMAGE_ICON: '#F5F1E8',
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#333', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B' },
    fonts: { headingMedium: 'Playfair', body: 'Inter', bodyMedium: 'Inter' },
  }),
}));

beforeEach(() => {
  jest.mocked(getBarberProfile).mockReset().mockImplementation(() => new Promise(() => {}));
  jest.mocked(listPortfolioForBarber).mockReset();
  jest.mocked(listServicesForBarber).mockReset();
  jest.mocked(fetchReviewsForBarber).mockReset();
});

it('shows a neutral hero and service layout while the real profile is pending', async () => {
  await render(<BarberProfileScreen route={{ params: { barberId: 'barber-1' } } as never} navigation={{ goBack: jest.fn() } as never} />);

  expect(screen.getByTestId('barber-profile-loading').props.accessibilityLabel).toBe('Loading barber profile');
  expect(screen.queryByTestId('barber-profile-not-found')).toBeNull();
  expect(screen.queryByTestId('barber-profile-services-empty')).toBeNull();
  expect(listServicesForBarber).not.toHaveBeenCalled();
  expect(listPortfolioForBarber).not.toHaveBeenCalled();
  expect(fetchReviewsForBarber).not.toHaveBeenCalled();
});


it('keeps real service selection reachable from portfolio and uses the selected service for booking', async () => {
  const barber = { id: 'barber-1', name: 'Ada Barber', city: 'Berlin', country: 'DE', rating: 0, profile_image: null, bio: null };
  const service = { id: 'service-1', barber_id: barber.id, name: 'Haircut', price: 35, duration_minutes: 30 };
  jest.mocked(getBarberProfile).mockResolvedValue({ status: 'ok', barber } as never);
  jest.mocked(listServicesForBarber).mockResolvedValue({ status: 'ok', services: [service] } as never);
  jest.mocked(listPortfolioForBarber).mockResolvedValue({ status: 'ok', images: [] });
  jest.mocked(fetchReviewsForBarber).mockResolvedValue({ status: 'ok', reviews: [], firstNameByReviewId: new Map() });
  const navigate = jest.fn();
  await render(<BarberProfileScreen route={{ params: { barberId: barber.id } } as never} navigation={{ goBack: jest.fn(), navigate } as never} />);
  expect(await screen.findByTestId('barber-profile-monogram')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('barber-profile-tab-portfolio'));
  expect(screen.queryByTestId('barber-profile-service-service-1')).toBeNull();
  await fireEvent.press(screen.getByTestId('barber-profile-choose-service'));
  expect(navigate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('barber-profile-book-service-1'));
  expect(navigate).toHaveBeenCalledWith('BookingDateTime', { barberId: barber.id, barberName: barber.name, service });
});

it('does not offer a booking or starting price when no services exist', async () => {
  jest.mocked(getBarberProfile).mockResolvedValue({ status: 'ok', barber: { id: 'barber-1', name: 'Ada', rating: 0 } } as never);
  jest.mocked(listServicesForBarber).mockResolvedValue({ status: 'ok', services: [] });
  jest.mocked(listPortfolioForBarber).mockResolvedValue({ status: 'ok', images: [] });
  jest.mocked(fetchReviewsForBarber).mockResolvedValue({ status: 'ok', reviews: [], firstNameByReviewId: new Map() });
  await render(<BarberProfileScreen route={{ params: { barberId: 'barber-1' } } as never} navigation={{ goBack: jest.fn() } as never} />);
  await screen.findByTestId('barber-profile-services-empty');
  expect(screen.queryByTestId('barber-profile-booking-dock')).toBeNull();
});

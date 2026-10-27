import { fireEvent, render, screen } from '@testing-library/react-native';
import { getBarberProfile, listPortfolioForBarber, listServicesForBarber } from '../../discoveryData';
import { fetchReviewsForBarber } from '../../reviewsData';
import BarberProfileScreen from '../BarberProfileScreen';

jest.mock('../../personalData', () => ({
  listFavoriteBarberIds: jest.fn(() => Promise.resolve({ status: 'ok', ids: new Set() })),
  setFavorite: jest.fn(() => Promise.resolve({ status: 'ok' })),
}));
jest.mock('../../discoveryData', () => ({
  getBarberProfile: jest.fn(),
  listPortfolioForBarber: jest.fn(),
  listServicesForBarber: jest.fn(),
}));
jest.mock('../../reviewsData', () => ({ fetchReviewsForBarber: jest.fn() }));
jest.mock('../../../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../../shared/components/ReportSheet', () => {
  const React = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return { ReportSheet: ({ target }: { target: { reviewId: string } }) => React.createElement(Text, { testID: 'report-sheet' }, target.reviewId) };
});
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
  expect(navigate).toHaveBeenCalledWith('BookingDateTime', { barberId: barber.id, barberName: barber.name, barberImage: null, service });
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

it('shows the review summary, a real distribution, and a report action on written reviews', async () => {
  const barber = { id: 'barber-1', name: 'Ada', city: 'Berlin', country: 'DE', rating: 4.5, profile_image: null, bio: 'Calm fades' };
  const reviews = [
    { id: 'r-1', booking_id: 'b-1', customer_id: 'c-1', barber_id: barber.id, rating: 5, comment: 'Great cut', created_at: '2026-10-01T10:00:00Z' },
    { id: 'r-2', booking_id: 'b-2', customer_id: null, barber_id: barber.id, rating: 4, comment: null, created_at: '2026-10-02T10:00:00Z' },
  ];
  jest.mocked(getBarberProfile).mockResolvedValue({ status: 'ok', barber } as never);
  jest.mocked(listServicesForBarber).mockResolvedValue({ status: 'ok', services: [] });
  jest.mocked(listPortfolioForBarber).mockResolvedValue({ status: 'ok', images: [] });
  jest.mocked(fetchReviewsForBarber).mockResolvedValue({ status: 'ok', reviews, firstNameByReviewId: new Map([['r-1', 'Nora']]) } as never);
  await render(<BarberProfileScreen route={{ params: { barberId: barber.id } } as never} navigation={{ goBack: jest.fn() } as never} />);

  await fireEvent.press(await screen.findByTestId('barber-profile-tab-reviews'));
  expect(screen.getByTestId('barber-profile-rating-distribution').props.accessibilityLabel).toBe('5 stars: 1, 4 stars: 1, 3 stars: 0, 2 stars: 0, 1 stars: 0');
  expect(screen.getByText('Nora')).toBeTruthy();
  expect(screen.queryByTestId('barber-profile-review-report-r-2')).toBeNull();
  await fireEvent.press(screen.getByTestId('barber-profile-review-report-r-1'));
  expect(screen.getByTestId('report-sheet').props.children).toBe('r-1');
});

it('keeps a failed reviews read local to its tab', async () => {
  jest.mocked(getBarberProfile).mockResolvedValue({ status: 'ok', barber: { id: 'barber-1', name: 'Ada', rating: 0 } } as never);
  jest.mocked(listServicesForBarber).mockResolvedValue({ status: 'ok', services: [] });
  jest.mocked(listPortfolioForBarber).mockResolvedValue({ status: 'ok', images: [] });
  jest.mocked(fetchReviewsForBarber).mockResolvedValue({ status: 'error', message: 'Reviews could not load.' } as never);
  await render(<BarberProfileScreen route={{ params: { barberId: 'barber-1' } } as never} navigation={{ goBack: jest.fn() } as never} />);
  await screen.findByTestId('barber-profile-services-empty');
  await fireEvent.press(screen.getByTestId('barber-profile-tab-reviews'));
  expect(screen.getByTestId('barber-profile-reviews-error')).toBeTruthy();
});

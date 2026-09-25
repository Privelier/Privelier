import { render, screen } from '@testing-library/react-native';
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

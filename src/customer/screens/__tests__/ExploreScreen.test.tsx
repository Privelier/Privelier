import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExploreScreen from '../ExploreScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import { listAvailabilityForBarberIds } from '../../availabilityData';
import { listBarbersByCity, listServicesForBarberIds } from '../../discoveryData';
import { getAppLanguage } from '../../../shared/locale';

jest.mock('../../personalData', () => ({
  listFavoriteBarberIds: jest.fn(() => Promise.resolve({ status: 'ok', ids: new Set() })),
  setFavorite: jest.fn(() => Promise.resolve({ status: 'ok' })),
}));
jest.mock('../../../auth/authService', () => ({ fetchOwnProfile: jest.fn() }));
jest.mock('../../availabilityData', () => ({ listAvailabilityForBarberIds: jest.fn() }));
jest.mock('../../discoveryData', () => ({ listBarbersByCity: jest.fn(), listServicesForBarberIds: jest.fn() }));
jest.mock('../../../shared/locale', () => ({ getAppLanguage: jest.fn(() => 'en') }));
jest.mock('../../../shared/components/RetryNotice', () => ({ RetryNotice: () => null }));
jest.mock('../../components/BarberCard', () => () => null);
// The real map renders native MapLibre or a WebView; the stub exposes the
// scene it was given and lets a test fire map events.
const mockMapEvents: { current: ((event: unknown) => void) | null } = { current: null };
jest.mock('../../../shared/maps/PrivelierMap', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    PrivelierMap: ({ scene, onEvent, testID }: { scene: { pins?: unknown[] }; onEvent: (e: unknown) => void; testID: string }) => {
      mockMapEvents.current = onEvent;
      return React.createElement(View, { testID, accessibilityHint: JSON.stringify(scene.pins ?? []) });
    },
  };
});
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    colors: { background: '#121214', surface: '#1B1B1E', border: '#2A2A2E', textPrimary: '#F5F1E8', textSecondary: '#9A968C', accent: '#BFA06B', accentText: '#BFA06B', onAccent: '#121214' },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans' },
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: ({ children, ...props }: { children?: unknown }) => React.createElement(View, props, children) };
});

const mockLanguage = getAppLanguage as jest.MockedFunction<typeof getAppLanguage>;

describe('ExploreScreen map', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLanguage.mockReturnValue('en');
    (fetchOwnProfile as jest.Mock).mockResolvedValue({ status: 'ok', profile: { city: 'Berlin' } });
    (listBarbersByCity as jest.Mock).mockResolvedValue({
      status: 'ok',
      barbers: [{ id: 'barber-1', name: 'Test Barber', display_latitude: 52.52, display_longitude: 13.4 }],
    });
    (listServicesForBarberIds as jest.Mock).mockResolvedValue({ status: 'ok', services: [] });
    (listAvailabilityForBarberIds as jest.Mock).mockResolvedValue({ status: 'ok', windows: [] });
  });

  async function renderExplore() {
    let view!: ReturnType<typeof render>;
    await act(async () => {
      view = render(<ExploreScreen navigation={{ navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) } as never} route={{} as never} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.queryByTestId('customer-explore-loading')).toBeNull());
    return view;
  }

  it('renders the free MapLibre map with one pin per located barber and docks a card on pin tap', async () => {
    await renderExplore();
    await waitFor(() => expect(screen.getByTestId('customer-explore-toggle-map')).toBeTruthy());
    fireEvent.press(screen.getByTestId('customer-explore-toggle-map'));

    const surface = await screen.findByTestId('customer-explore-map-surface');
    const pins = JSON.parse(surface.props.accessibilityHint) as { id: string; lngLat: number[]; title: string; subtitle: string | null; imageUrl: string | null }[];
    expect(pins).toEqual([expect.objectContaining({ id: 'barber-1', lngLat: [13.4, 52.52], title: 'Test', subtitle: null, imageUrl: null, accessibilityLabel: 'Test Barber' })]);
    expect(screen.queryByTestId('customer-explore-docked-card')).toBeNull();

    await act(async () => { mockMapEvents.current?.({ type: 'pin', id: 'barber-1' }); });
    expect(await screen.findByTestId('customer-explore-docked-card')).toBeTruthy();
    await act(async () => { mockMapEvents.current?.({ type: 'map' }); });
    await waitFor(() => expect(screen.queryByTestId('customer-explore-docked-card')).toBeNull());
  });

  it('shows the empty state with a list shortcut, localized in German, when no barber has a location', async () => {
    mockLanguage.mockReturnValue('de');
    (listBarbersByCity as jest.Mock).mockResolvedValue({
      status: 'ok',
      barbers: [{ id: 'barber-1', name: 'Test Barber', display_latitude: null, display_longitude: null }],
    });
    await renderExplore();
    await waitFor(() => expect(screen.getByTestId('customer-explore-toggle-map')).toBeTruthy());
    fireEvent.press(screen.getByTestId('customer-explore-toggle-map'));

    expect(await screen.findByTestId('customer-explore-map-empty')).toBeTruthy();
    expect(screen.getByText('Noch keine Barber auf der Karte')).toBeTruthy();
    expect(screen.queryByTestId('customer-explore-map-surface')).toBeNull();
    const toList = screen.getByTestId('customer-explore-map-switch-to-list');
    expect(toList.props.accessibilityLabel).toBe('Zur Liste wechseln');
    fireEvent.press(toList);
    await waitFor(() => expect(screen.queryByTestId('customer-explore-map-area')).toBeNull());
  });
});

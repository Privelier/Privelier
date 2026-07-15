/**
 * Component tests for the barber LocationEditScreen (Explore/location Run A).
 * A leaf editor on a plain useEffect (bio-edit C6 precedent), so it is fully
 * component-testable — unlike the focus-effect screens. The data layer and
 * the geocoding client are mocked; fake timers drive the search debounce.
 *
 * What these pin hardest: coordinates only ever come from a PICKED geocode
 * candidate — free text alone can never save coordinates — and clearing the
 * field saves an explicit NULL location (the pin-removal path).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import LocationEditScreen from '../LocationEditScreen';
import { fetchOwnLocation, updateOwnLocation } from '../../locationData';
import { forwardGeocode } from '../../../shared/geocoding';

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: { user: { id: 'barber-1' } } } })
      ),
    },
  },
}));

jest.mock('../../locationData', () => ({
  MAX_ADDRESS_LENGTH: 300,
  fetchOwnLocation: jest.fn(),
  updateOwnLocation: jest.fn(),
}));

jest.mock('../../../shared/geocoding', () => ({
  forwardGeocode: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({ Feather: () => null }));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      background: '#121214',
      surface: '#1B1B1E',
      border: '#2A2A2E',
      textPrimary: '#F5F1E8',
      textSecondary: '#9A968C',
      accent: '#BFA06B',
      accentText: '#BFA06B',
      onAccent: '#121214',
      error: '#A8453E',
      errorText: '#A8453E',
      successText: '#51785C',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans', bodySemiBold: 'sans' },
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, ...props }: { children?: unknown }) =>
      React.createElement(View, props, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockFetchLocation = fetchOwnLocation as jest.Mock;
const mockUpdateLocation = updateOwnLocation as jest.Mock;
const mockGeocode = forwardGeocode as jest.Mock;
const navigation = { goBack: jest.fn() };

const CANDIDATE = { label: 'Prinsengracht 263, Amsterdam', latitude: 52.3752, longitude: 4.8837 };

async function renderScreen() {
  await render(<LocationEditScreen navigation={navigation as never} route={{} as never} />);
}

/** Flush the mount's awaited chain (getSession -> fetchOwnLocation -> state). */
async function flushMount() {
  await act(async () => {});
  await act(async () => {});
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(async () => {
  cleanup();
  jest.useRealTimers();
});

describe('LocationEditScreen', () => {
  it('renders consent copy, geocodes typed input after the debounce, and saves only a picked candidate', async () => {
    mockFetchLocation.mockResolvedValue({ status: 'ok', location: null });
    mockGeocode.mockResolvedValue({ status: 'ok', candidates: [CANDIDATE] });
    mockUpdateLocation.mockResolvedValue({
      status: 'ok',
      location: { user_id: 'barber-1', address: CANDIDATE.label },
    });

    await renderScreen();
    await flushMount();
    expect(screen.getByTestId('barber-location-input')).toBeTruthy();

    // The privacy consent copy is a hard requirement (founder decision D2).
    expect(screen.getByTestId('barber-location-consent')).toBeTruthy();

    // Type an address: no geocode before the debounce elapses.
    await fireEvent.changeText(screen.getByTestId('barber-location-input'), 'Prinsengracht 263');
    expect(mockGeocode).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(450));
    await act(async () => {});
    expect(mockGeocode).toHaveBeenCalledWith('Prinsengracht 263');
    expect(screen.getByTestId('barber-location-candidate-0')).toBeTruthy();

    // Free text alone is not saveable — the pick hint is showing and save is disabled.
    expect(screen.getByTestId('barber-location-pick-hint')).toBeTruthy();
    expect(
      screen.getByTestId('barber-location-save').props.accessibilityState?.disabled
    ).toBe(true);

    // Pick the candidate: save enables, and the write carries ITS coordinates.
    await fireEvent.press(screen.getByTestId('barber-location-candidate-0'));
    expect(
      screen.getByTestId('barber-location-save').props.accessibilityState?.disabled
    ).toBe(false);
    await fireEvent.press(screen.getByTestId('barber-location-save'));
    await act(async () => {});
    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockUpdateLocation).toHaveBeenCalledWith('barber-1', {
      address: CANDIDATE.label,
      latitude: CANDIDATE.latitude,
      longitude: CANDIDATE.longitude,
    });
  });

  it('seeds from a saved location and saves an explicit clear when the field is emptied', async () => {
    mockFetchLocation.mockResolvedValue({
      status: 'ok',
      location: {
        user_id: 'barber-1',
        address: CANDIDATE.label,
        latitude: CANDIDATE.latitude,
        longitude: CANDIDATE.longitude,
        display_latitude: 52.377,
        display_longitude: 4.886,
        location_updated_at: '2026-07-15T12:00:00Z',
      },
    });
    mockUpdateLocation.mockResolvedValue({
      status: 'ok',
      location: { user_id: 'barber-1', address: null },
    });

    await renderScreen();
    await flushMount();
    expect(screen.getByTestId('barber-location-input')).toBeTruthy();

    // Seeded and not dirty: the untouched screen cannot save.
    expect(screen.getByTestId('barber-location-input').props.value).toBe(CANDIDATE.label);
    expect(
      screen.getByTestId('barber-location-save').props.accessibilityState?.disabled
    ).toBe(true);

    // Clearing flips the action to removal and enables it.
    await fireEvent.changeText(screen.getByTestId('barber-location-input'), '');
    expect(screen.getByText('Remove location')).toBeTruthy();
    expect(
      screen.getByTestId('barber-location-save').props.accessibilityState?.disabled
    ).toBe(false);
    await fireEvent.press(screen.getByTestId('barber-location-save'));
    await act(async () => {});
    expect(navigation.goBack).toHaveBeenCalled();
    expect(mockUpdateLocation).toHaveBeenCalledWith('barber-1', {
      address: '',
      latitude: null,
      longitude: null,
    });
  });

  it('surfaces a geocode failure as a calm search error, not a form error', async () => {
    mockFetchLocation.mockResolvedValue({ status: 'ok', location: null });
    mockGeocode.mockResolvedValue({
      status: 'error',
      code: 'network',
      message: 'We could not reach the address service. Check your connection and try again.',
      retryable: true,
    });

    await renderScreen();
    await flushMount();
    expect(screen.getByTestId('barber-location-input')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('barber-location-input'), 'Prinsengracht 263');
    await act(() => jest.advanceTimersByTime(450));
    await act(async () => {});
    expect(screen.getByTestId('barber-location-search-error')).toBeTruthy();
    expect(screen.queryByTestId('barber-location-error')).toBeNull();
    expect(
      screen.getByTestId('barber-location-save').props.accessibilityState?.disabled
    ).toBe(true);
  });
});

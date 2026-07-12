/**
 * Integration tests for the barber Verify tab (src/barber/screens/VerifyScreen.tsx,
 * build-order step 17). The data layer (../verificationData, ../profileData),
 * the auth profile read (../../auth/authService) and the native image picker
 * (expo-image-picker) are all mocked — the screen is rendered with
 * @testing-library/react-native and driven purely through its testIDs. Nothing
 * here touches a real network, storage bucket or native module.
 *
 * useTheme reads useColorScheme directly (no provider), so the screen needs no
 * theme wrapper; react-native-safe-area-context is mocked to a plain View that
 * forwards props so the screen's testIDs survive.
 *
 * Coverage: permission denied and picker-cancel both short-circuit before any
 * upload; the happy path runs upload -> submit -> refetch and reflects the
 * uploading indicator during and 'Uploaded' after; an upload failure surfaces
 * an alert and never submits or refetches; and the idle sibling row is
 * disabled while the other row uploads.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import VerifyScreen from '../VerifyScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import { fetchOwnBarberProfile, fetchOwnVerificationRequest } from '../../profileData';
import { submitVerificationDocument, uploadVerificationDocument } from '../../verificationData';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// @expo/vector-icons pulls expo-font -> expo-asset at import, which isn't
// resolvable in the jest env; the icon glyph is irrelevant to behaviour.
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

// useTheme -> theme/typography -> @expo-google-fonts -> expo-font -> expo-asset
// (unresolvable here). Stub the theme to a flat palette/font map; only the
// keys the screen reads matter, and their exact values are irrelevant to the
// behaviour under test.
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
      error: '#A8453E',
      errorText: '#A8453E',
      successText: '#51785C',
    },
    fonts: { headingMedium: 'serif', body: 'sans', bodyMedium: 'sans' },
  }),
}));

jest.mock('../../../auth/authService', () => ({
  fetchOwnProfile: jest.fn(),
}));

jest.mock('../../profileData', () => ({
  fetchOwnBarberProfile: jest.fn(),
  fetchOwnVerificationRequest: jest.fn(),
}));

jest.mock('../../verificationData', () => ({
  uploadVerificationDocument: jest.fn(),
  submitVerificationDocument: jest.fn(),
}));

// react-native-safe-area-context is not in the jest transform allow-list;
// mock its wrappers to a transparent passthrough (the screen's own inner Views
// carry every testID the tests query, so SafeAreaView need not forward props).
jest.mock('react-native-safe-area-context', () => {
  const passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockRequestPerm = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockFetchProfile = fetchOwnProfile as jest.Mock;
const mockFetchBarberProfile = fetchOwnBarberProfile as jest.Mock;
const mockFetchRequest = fetchOwnVerificationRequest as jest.Mock;
const mockUpload = uploadVerificationDocument as jest.Mock;
const mockSubmit = submitVerificationDocument as jest.Mock;

/** A never-uploaded verification_requests row (both columns still null). */
const EMPTY_REQUEST = {
  id: 'v1',
  user_id: 'u1',
  id_image_url: null,
  license_image_url: null,
  status: 'pending',
  reviewed_by: null,
  reviewed_at: null,
};

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  // Default happy load: a signed-in barber, pending status, no docs yet.
  mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'u1' } });
  mockFetchBarberProfile.mockResolvedValue({
    status: 'ok',
    profile: { verification_status: 'pending' },
  });
  mockFetchRequest.mockResolvedValue({ status: 'ok', request: EMPTY_REQUEST });
});

afterEach(() => {
  alertSpy.mockRestore();
});

/**
 * Render and wait out the initial load. Queries are read off the shared
 * `screen` object (this RTL setup returns queries there, not on the render
 * result).
 */
async function renderLoaded() {
  render(<VerifyScreen />);
  await waitFor(() => expect(screen.getByTestId('barber-verify-status')).toBeTruthy());
}

// A deferred promise handle, for holding the upload in its in-flight state.
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('VerifyScreen', () => {
  it('renders the status card and both document rows after loading', async () => {
    await renderLoaded();

    expect(screen.getByTestId('barber-verify-doc-id')).toBeTruthy();
    expect(screen.getByTestId('barber-verify-doc-license')).toBeTruthy();
    expect(screen.getByTestId('barber-verify-status')).toBeTruthy();
  });

  it('does nothing (no upload) when photo permission is denied', async () => {
    mockRequestPerm.mockResolvedValue({ granted: false });
    await renderLoaded();

    fireEvent.press(screen.getByTestId('barber-verify-doc-id'));

    await waitFor(() => expect(mockRequestPerm).toHaveBeenCalled());
    expect(mockLaunchPicker).not.toHaveBeenCalled();
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
  });

  it('does nothing (no upload) when the picker is canceled', async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    mockLaunchPicker.mockResolvedValue({ canceled: true });
    await renderLoaded();

    fireEvent.press(screen.getByTestId('barber-verify-doc-id'));

    await waitFor(() => expect(mockLaunchPicker).toHaveBeenCalled());
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('runs upload -> submit -> refetch on the happy path, showing the uploading indicator then Uploaded', async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    mockLaunchPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/id.jpg', mimeType: 'image/jpeg' }],
    });

    // Hold the upload in flight so we can observe the uploading state.
    const uploadGate = deferred<{ status: 'ok'; path: string }>();
    mockUpload.mockReturnValueOnce(uploadGate.promise);
    mockSubmit.mockResolvedValueOnce({
      status: 'ok',
      request: { ...EMPTY_REQUEST, id_image_url: 'u1/id.jpg' },
    });
    // The post-success refetch returns the row with the id doc now present.
    mockFetchRequest.mockResolvedValue({
      status: 'ok',
      request: { ...EMPTY_REQUEST, id_image_url: 'u1/id.jpg' },
    });

    await renderLoaded();

    fireEvent.press(screen.getByTestId('barber-verify-doc-id'));

    // In-flight: the id row shows its uploading indicator...
    await waitFor(() => expect(screen.getByTestId('barber-verify-doc-id-uploading')).toBeTruthy());
    // ...and the license row is disabled while the id row uploads.
    expect(
      screen.getByTestId('barber-verify-doc-license').props.accessibilityState.disabled
    ).toBe(true);

    // Resolve the upload; submit + refetch then run.
    uploadGate.resolve({ status: 'ok', path: 'u1/id.jpg' });

    await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('u1', 'id', 'u1/id.jpg'));
    await waitFor(() =>
      expect(screen.queryByTestId('barber-verify-doc-id-uploading')).toBeNull()
    );

    expect(mockUpload).toHaveBeenCalledWith('u1', 'id', 'file:///tmp/id.jpg', 'image/jpeg');
    // fetchOwnProfile ran once for the initial load and once for the refetch.
    expect(mockFetchProfile).toHaveBeenCalledTimes(2);
    // The id row now reads 'Uploaded'.
    expect(screen.getByText('Uploaded')).toBeTruthy();
  });

  it('surfaces an upload failure and never submits or refetches', async () => {
    mockRequestPerm.mockResolvedValue({ granted: true });
    mockLaunchPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/id.jpg', mimeType: 'image/jpeg' }],
    });
    mockUpload.mockResolvedValueOnce({
      status: 'error',
      code: 'network',
      message: 'We could not reach the server. Check your connection and try again.',
      retryable: true,
    });

    await renderLoaded();

    fireEvent.press(screen.getByTestId('barber-verify-doc-id'));

    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Upload failed', expect.stringContaining('server'))
    );
    expect(mockSubmit).not.toHaveBeenCalled();
    // Only the initial load ran — a failed upload must never refetch.
    expect(mockFetchProfile).toHaveBeenCalledTimes(1);
    // The uploading indicator is cleared again (finally block).
    await waitFor(() =>
      expect(screen.queryByTestId('barber-verify-doc-id-uploading')).toBeNull()
    );
  });
});

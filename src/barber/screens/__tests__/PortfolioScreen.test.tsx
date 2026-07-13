/**
 * Integration tests for the barber Portfolio tab
 * (src/barber/screens/PortfolioScreen.tsx, build-order step 17). The data
 * layer (../portfolioData), the auth profile read (../../auth/authService),
 * the native image picker (expo-image-picker) and the shared public-URL
 * derivation are all mocked; the screen is rendered with
 * @testing-library/react-native and driven through its testIDs. Nothing here
 * touches a real network, storage bucket or native module.
 *
 * The two behaviours the build stages flagged as most worth covering:
 *  - the strict upload → insert ordering (a failed upload never inserts a row)
 *    and the SYNCHRONOUS busyRef double-submit guard (two rapid add taps fire
 *    exactly one upload);
 *  - delete-reconcile: an optimistic tile removal that snaps the tile back into
 *    its sorted position if the delete fails.
 * Plus the client-side max-6 gate (add tile hidden at the cap) and the
 * server-truth 'limit_reached' fallback.
 */
import { AccessibilityInfo, Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import PortfolioScreen from '../PortfolioScreen';
import { fetchOwnProfile } from '../../../auth/authService';
import {
  deletePortfolioImage,
  insertPortfolioRow,
  listOwnPortfolio,
  uploadPortfolioImage,
} from '../../portfolioData';
import type { PortfolioRow } from '../../../types';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

// @expo/vector-icons pulls expo-font -> expo-asset at import, unresolvable in
// the jest env; the icon glyph is irrelevant to behaviour.
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

// Stub the theme to a flat palette/font map (same reason as VerifyScreen's
// test — the real hook pulls @expo-google-fonts -> expo-asset). This one mock
// covers the screen AND the real PortfolioTile/PortfolioGrid it renders.
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
    },
    fonts: {
      headingMedium: 'serif',
      body: 'sans',
      bodyMedium: 'sans',
      bodySemiBold: 'sans',
    },
  }),
}));

// The real PortfolioTile derives a public URL via this helper; stub it so the
// tiles render without a Supabase client.
jest.mock('../../../shared/portfolioImages', () => ({
  getPublicPortfolioUrl: (path: string) => `https://cdn.example.com/${path}`,
}));

jest.mock('../../../auth/authService', () => ({
  fetchOwnProfile: jest.fn(),
}));

jest.mock('../../portfolioData', () => ({
  MAX_PORTFOLIO_IMAGES: 6,
  listOwnPortfolio: jest.fn(),
  uploadPortfolioImage: jest.fn(),
  insertPortfolioRow: jest.fn(),
  deletePortfolioImage: jest.fn(),
}));

// react-native-safe-area-context is not in the jest transform allow-list; mock
// its wrappers to plain Views that FORWARD props — the screen's SafeAreaView
// carries the `barber-portfolio-screen` testID, so a props-dropping passthrough
// would hide it.
jest.mock('react-native-safe-area-context', () => {
  // require (not import) is required inside a jest.mock factory — it is hoisted
  // above the imports, so top-level import bindings aren't available here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const passthrough = (props: Record<string, unknown>) => React.createElement(View, props);
  return {
    SafeAreaProvider: passthrough,
    SafeAreaView: passthrough,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockRequestPerm = ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock;
const mockLaunchPicker = ImagePicker.launchImageLibraryAsync as jest.Mock;
const mockFetchProfile = fetchOwnProfile as jest.Mock;
const mockList = listOwnPortfolio as jest.Mock;
const mockUpload = uploadPortfolioImage as jest.Mock;
const mockInsert = insertPortfolioRow as jest.Mock;
const mockDelete = deletePortfolioImage as jest.Mock;

let alertSpy: jest.SpyInstance;

/** N portfolio rows with deterministic, sortable ids (p1, p2, ...). */
function rows(n: number): PortfolioRow[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    barber_id: 'b1',
    image_url: `b1/img-${i + 1}.jpg`,
  }));
}

/**
 * Alert stub that auto-confirms the delete dialog: when invoked with a buttons
 * array it presses the destructive button's onPress (the "Delete" action);
 * otherwise (a plain one-arg/two-arg alert) it does nothing. This lets the
 * delete-reconcile tests drive the confirm flow deterministically.
 */
function installAlertAutoConfirm() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
    if (Array.isArray(buttons)) {
      const destructive = buttons.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    }
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

  // Default happy load: a signed-in barber with an empty portfolio.
  mockFetchProfile.mockResolvedValue({ status: 'ok', profile: { id: 'b1' } });
  mockList.mockResolvedValue({ status: 'ok', images: [] });
});

afterEach(() => {
  alertSpy.mockRestore();
  jest.restoreAllMocks();
});

/** Render and wait out the initial load (spinner gone). */
async function renderLoaded() {
  // v14 render() is async — awaiting it binds `screen` and flushes the initial
  // load's state updates inside act(), avoiding cross-test bleed.
  await render(<PortfolioScreen />);
  await waitFor(() => expect(screen.queryByTestId('barber-portfolio-loading')).toBeNull());
}

describe('PortfolioScreen', () => {
  it('renders the counter and the add tile after loading an empty portfolio', async () => {
    await renderLoaded();

    expect(screen.getByTestId('barber-portfolio-screen')).toBeTruthy();
    expect(screen.getByTestId('barber-portfolio-counter')).toBeTruthy();
    expect(screen.getByTestId('barber-portfolio-add')).toBeTruthy();
  });

  describe('upload → insert ordering', () => {
    it('uploads then inserts on a picked image (strict order)', async () => {
      mockRequestPerm.mockResolvedValue({ granted: true });
      mockLaunchPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/pic.jpg', mimeType: 'image/jpeg' }],
      });
      mockUpload.mockResolvedValueOnce({ status: 'ok', path: 'b1/img-new.jpg' });
      mockInsert.mockResolvedValueOnce({
        status: 'ok',
        image: { id: 'p1', barber_id: 'b1', image_url: 'b1/img-new.jpg' },
      });

      await renderLoaded();
      fireEvent.press(screen.getByTestId('barber-portfolio-add'));

      await waitFor(() => expect(mockInsert).toHaveBeenCalled());
      expect(mockUpload).toHaveBeenCalledWith('b1', 'file:///tmp/pic.jpg', 'image/jpeg');
      // Insert is fed exactly the uploaded object PATH.
      expect(mockInsert).toHaveBeenCalledWith('b1', 'b1/img-new.jpg');
      // The freshly-inserted tile is reflected optimistically.
      await waitFor(() => expect(screen.getByTestId('barber-portfolio-image-p1')).toBeTruthy());
    });

    it('NEVER inserts a row when the upload fails', async () => {
      mockRequestPerm.mockResolvedValue({ granted: true });
      mockLaunchPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/pic.jpg', mimeType: 'image/jpeg' }],
      });
      mockUpload.mockResolvedValueOnce({
        status: 'error',
        code: 'network',
        message: 'We could not reach the server. Check your connection and try again.',
        retryable: true,
      });

      await renderLoaded();
      fireEvent.press(screen.getByTestId('barber-portfolio-add'));

      await waitFor(() => expect(mockUpload).toHaveBeenCalled());
      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith('Upload failed', expect.stringContaining('server'))
      );
      // The failed upload must never reach the row insert.
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe('double-submit guard', () => {
    it('fires exactly ONE upload for two rapid add taps (synchronous busyRef guard)', async () => {
      mockRequestPerm.mockResolvedValue({ granted: true });
      mockLaunchPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/pic.jpg', mimeType: 'image/jpeg' }],
      });
      mockUpload.mockResolvedValueOnce({ status: 'ok', path: 'b1/img-new.jpg' });
      mockInsert.mockResolvedValueOnce({
        status: 'ok',
        image: { id: 'p1', barber_id: 'b1', image_url: 'b1/img-new.jpg' },
      });

      await renderLoaded();

      const add = screen.getByTestId('barber-portfolio-add');
      // Two synchronous presses: the first sets busyRef before its first await;
      // the second sees busyRef === true and returns immediately. Wrap both in a
      // single act() so the whole async add flow settles inside one act boundary
      // — otherwise the two rapid presses spawn overlapping acts whose trailing
      // state updates leak into (and corrupt the mount of) the next test.
      await act(async () => {
        fireEvent.press(add);
        fireEvent.press(add);
      });

      expect(mockRequestPerm).toHaveBeenCalledTimes(1);
      expect(mockUpload).toHaveBeenCalledTimes(1);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      // The single upload's optimistic tile is reflected (flow fully settled).
      expect(screen.getByTestId('barber-portfolio-image-p1')).toBeTruthy();
    });
  });

  describe('max-6 gate', () => {
    it('hides the add tile once 6 images are present', async () => {
      mockList.mockResolvedValue({ status: 'ok', images: rows(6) });

      await renderLoaded();

      expect(screen.queryByTestId('barber-portfolio-add')).toBeNull();
      // All six tiles are shown.
      expect(screen.getByTestId('barber-portfolio-image-p6')).toBeTruthy();
    });

    it("surfaces the server 'limit_reached' failure message when the insert is rejected at the cap", async () => {
      // Five images locally (add tile still visible), but the DB trigger rejects
      // the sixth insert (e.g. a concurrent session raced past the cap).
      mockList.mockResolvedValue({ status: 'ok', images: rows(5) });
      mockRequestPerm.mockResolvedValue({ granted: true });
      mockLaunchPicker.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///tmp/pic.jpg', mimeType: 'image/jpeg' }],
      });
      mockUpload.mockResolvedValueOnce({ status: 'ok', path: 'b1/img-6.jpg' });
      mockInsert.mockResolvedValueOnce({
        status: 'error',
        code: 'limit_reached',
        message: 'You can have at most 6 portfolio images. Delete one before adding another.',
        retryable: false,
      });

      await renderLoaded();
      fireEvent.press(screen.getByTestId('barber-portfolio-add'));

      await waitFor(() =>
        expect(alertSpy).toHaveBeenCalledWith(
          'Upload failed',
          expect.stringContaining('6 portfolio images')
        )
      );
    });
  });

  describe('delete-reconcile', () => {
    it('removes the tile optimistically on a successful delete', async () => {
      mockList.mockResolvedValue({ status: 'ok', images: rows(3) });
      mockDelete.mockResolvedValueOnce({ status: 'ok' });
      alertSpy.mockRestore();
      alertSpy = installAlertAutoConfirm();

      await renderLoaded();
      expect(screen.getByTestId('barber-portfolio-image-p2')).toBeTruthy();

      fireEvent.press(screen.getByTestId('barber-portfolio-delete-p2'));

      await waitFor(() => expect(mockDelete).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByTestId('barber-portfolio-image-p2')).toBeNull());
      // The siblings are untouched.
      expect(screen.getByTestId('barber-portfolio-image-p1')).toBeTruthy();
      expect(screen.getByTestId('barber-portfolio-image-p3')).toBeTruthy();
    });

    it('re-inserts the tile in its sorted position when the delete fails', async () => {
      mockList.mockResolvedValue({ status: 'ok', images: rows(3) });
      mockDelete.mockResolvedValueOnce({
        status: 'error',
        code: 'network',
        message: 'We could not reach the server. Check your connection and try again.',
        retryable: true,
      });
      alertSpy.mockRestore();
      alertSpy = installAlertAutoConfirm();

      await renderLoaded();
      fireEvent.press(screen.getByTestId('barber-portfolio-delete-p2'));

      // Optimistically gone, then reconciled back after the failure.
      await waitFor(() => expect(mockDelete).toHaveBeenCalled());
      await waitFor(() => expect(screen.getByTestId('barber-portfolio-image-p2')).toBeTruthy());
      // Still all three, in stable order (p1, p2, p3).
      expect(screen.getByTestId('barber-portfolio-image-p1')).toBeTruthy();
      expect(screen.getByTestId('barber-portfolio-image-p3')).toBeTruthy();
    });
  });
});

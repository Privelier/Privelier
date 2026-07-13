/**
 * Tests for the reusable PortfolioTile "ultra component"
 * (src/shared/components/PortfolioTile.tsx, build-order step 17). It is
 * presentation-only: the public-URL derivation (getPublicPortfolioUrl), the
 * theme hook and the icon font are all mocked, and the tile is driven purely
 * through its props/testIDs. Nothing here touches a real bucket.
 *
 * The delete affordance is conditional on `onDelete`:
 *  - onDelete present → a floating destructive disc (barber's own grid),
 *    disabled+dimmed when `deleteDisabled`.
 *  - onDelete absent  → read-only tile (the customer's Portfolio tab), no disc.
 * The passed testIDs are preserved verbatim (Maestro/other tests depend on them).
 *
 * NB: @testing-library/react-native v14's `render()` is async — every test
 * `await`s it before touching the global `screen`, or `screen` is still unbound
 * and every query throws "`render` function has not been called".
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PortfolioTile } from '../PortfolioTile';
import { getPublicPortfolioUrl } from '../../portfolioImages';

jest.mock('../../portfolioImages', () => ({
  getPublicPortfolioUrl: jest.fn((path: string) => `https://cdn.example.com/portfolio/${path}`),
}));

const mockGetUrl = getPublicPortfolioUrl as jest.Mock;

beforeEach(() => {
  mockGetUrl.mockClear();
});

// @expo/vector-icons pulls expo-font -> expo-asset at import; the glyph is
// irrelevant to behaviour here.
jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

// The real useTheme pulls in @expo-google-fonts at import; stub the one colour
// the tile reads.
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({ isDark: true, colors: { surface: '#1B1B1E' } }),
}));

describe('PortfolioTile', () => {
  it('renders the tile and resolves the public URL from the given path', async () => {
    await render(<PortfolioTile imagePath="b1/img-1.jpg" testID="tile-1" />);

    expect(screen.getByTestId('tile-1')).toBeTruthy();
    // The tile derives the image URL from the stored object PATH (never a baked URL).
    expect(mockGetUrl).toHaveBeenCalledWith('b1/img-1.jpg');
  });

  it('renders the delete disc and fires onDelete when it is pressed (barber grid)', async () => {
    const onDelete = jest.fn();
    await render(
      <PortfolioTile
        imagePath="b1/img-1.jpg"
        testID="tile-1"
        onDelete={onDelete}
        deleteTestID="tile-1-delete"
      />
    );

    const disc = screen.getByTestId('tile-1-delete');
    expect(disc).toBeTruthy();

    fireEvent.press(disc);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('is read-only (no delete disc) when onDelete is absent (customer tab)', async () => {
    await render(
      <PortfolioTile imagePath="b1/img-1.jpg" testID="tile-1" deleteTestID="tile-1-delete" />
    );

    // No onDelete → the disc is never rendered even if a deleteTestID is passed.
    expect(screen.queryByTestId('tile-1-delete')).toBeNull();
  });

  it('disables the delete disc when deleteDisabled is set', async () => {
    const onDelete = jest.fn();
    await render(
      <PortfolioTile
        imagePath="b1/img-1.jpg"
        testID="tile-1"
        onDelete={onDelete}
        deleteTestID="tile-1-delete"
        deleteDisabled
      />
    );

    const disc = screen.getByTestId('tile-1-delete');
    expect(disc.props.accessibilityState.disabled).toBe(true);
  });
});

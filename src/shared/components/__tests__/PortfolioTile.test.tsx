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
 */
import { Image } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PortfolioTile } from '../PortfolioTile';
import { getPublicPortfolioUrl } from '../../portfolioImages';

jest.mock('../../portfolioImages', () => ({
  getPublicPortfolioUrl: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Feather: () => null,
}));

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: {
      surface: '#1B1B1E',
    },
  }),
}));

const mockUrl = getPublicPortfolioUrl as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockUrl.mockReturnValue('https://cdn.example.com/portfolio/b1/img-1.jpg');
});

describe('PortfolioTile', () => {
  it('renders the image at the resolved public URL for the given path', () => {
    render(<PortfolioTile imagePath="b1/img-1.jpg" testID="tile-1" />);

    expect(mockUrl).toHaveBeenCalledWith('b1/img-1.jpg');
    expect(screen.getByTestId('tile-1')).toBeTruthy();

    const image = screen.UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({ uri: 'https://cdn.example.com/portfolio/b1/img-1.jpg' });
  });

  it('renders the delete disc and fires onDelete when it is pressed (barber grid)', () => {
    const onDelete = jest.fn();
    render(
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

  it('is read-only (no delete disc) when onDelete is absent (customer tab)', () => {
    render(
      <PortfolioTile
        imagePath="b1/img-1.jpg"
        testID="tile-1"
        deleteTestID="tile-1-delete"
      />
    );

    // No onDelete → the disc is never rendered even if a deleteTestID is passed.
    expect(screen.queryByTestId('tile-1-delete')).toBeNull();
  });

  it('disables the delete disc when deleteDisabled is set', () => {
    const onDelete = jest.fn();
    render(
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

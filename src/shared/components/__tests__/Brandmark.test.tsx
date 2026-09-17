import { render, screen } from '@testing-library/react-native';
import Brandmark from '../Brandmark';

jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: jest.requireActual('../../../theme/colors').darkPalette,
    fonts: {},
  }),
}));

describe('Brandmark', () => {
  it('renders the supplied wordmark for every supported lockup', async () => {
    await render(<Brandmark />);
    expect(screen.getByTestId('brandmark')).toBeTruthy();
    expect(screen.getByRole('image')).toBeTruthy();

    await render(<Brandmark lockup="vertical" size="xl" />);
    expect(screen.getByRole('image')).toBeTruthy();

    await render(<Brandmark lockup="horizontal" size="lg" />);
    expect(screen.getByRole('image')).toBeTruthy();
  });

  it('preserves the accessible brand label exactly once', async () => {
    await render(<Brandmark lockup="vertical" size="lg" />);
    const root = screen.getByTestId('brandmark');
    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityLabel).toBe('Privelier');
    expect(root.props.accessibilityRole).toBe('image');
  });

  it('hides decorative wordmarks from accessibility', async () => {
    await render(<Brandmark decorative />);
    const root = screen.getByTestId('brandmark', { includeHiddenElements: true });
    expect(root.props.accessible).toBe(false);
    expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});

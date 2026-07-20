/**
 * Tests for the Privelier Signet (src/shared/components/Brandmark.tsx).
 *
 * The mark is presentation-only, so what is worth pinning is its CONTRACT
 * rather than its pixels: it must announce once as the brand and never as a
 * stray "P"; the wordmark must appear in exactly the two lockups that carry
 * it; and `ground` must be able to override the theme (that is the branch
 * that lets the mark sit on a dark hero while the app is in light mode).
 *
 * The palette module is NOT mocked — it is a plain object with no font
 * imports, and letting it be real is the only way the ground override is
 * actually verified against the authoritative brand values.
 *
 * NB: @testing-library/react-native v14's `render()` is async — every test
 * `await`s it before touching the global `screen`.
 */
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Brandmark from '../Brandmark';
import { darkPalette, lightPalette } from '../../../theme/colors';

// The real useTheme pulls in @expo-google-fonts at import. The app is in DARK
// mode throughout these tests, so any light-palette ink proves an override.
jest.mock('../../../theme/useTheme', () => ({
  useTheme: () => ({
    isDark: true,
    colors: jest.requireActual('../../../theme/colors').darkPalette,
    fonts: { logo: 'Cinzel_400Regular', logoSemiBold: 'Cinzel_600SemiBold' },
  }),
}));

/** The flattened style of the rendered wordmark. */
function wordmarkStyle() {
  return StyleSheet.flatten(screen.getByText('PRIVELIER').props.style);
}

describe('Brandmark', () => {
  describe('lockups', () => {
    it('renders the mark alone by default, with no wordmark', async () => {
      await render(<Brandmark />);

      expect(screen.getByTestId('brandmark')).toBeTruthy();
      expect(screen.queryByText('PRIVELIER')).toBeNull();
    });

    it.each(['vertical', 'horizontal'] as const)('renders the wordmark in the %s lockup', async (lockup) => {
      await render(<Brandmark lockup={lockup} size="lg" />);

      expect(screen.getByText('PRIVELIER')).toBeTruthy();
    });

    it('accepts a caller testID, so a screen can address its own instance', async () => {
      await render(<Brandmark testID="role-select-brandmark" />);

      expect(screen.getByTestId('role-select-brandmark')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('announces once as the brand, not as a stray letter', async () => {
      await render(<Brandmark lockup="vertical" size="lg" />);

      const root = screen.getByTestId('brandmark');
      expect(root.props.accessible).toBe(true);
      expect(root.props.accessibilityLabel).toBe('Privelier');
      expect(root.props.accessibilityRole).toBe('image');
      // The brand name must be reachable exactly once — via the label above,
      // never by a reader walking into the glyph or the wordmark.
      expect(screen.getByText('P').props.accessible).toBe(false);
      expect(screen.getByText('PRIVELIER').props.accessible).toBe(false);
    });

    it('hides itself entirely when decorative (the name is already on screen)', async () => {
      await render(<Brandmark decorative />);

      // A default query does not see it at all — RNTL excludes elements hidden
      // from accessibility, which IS the property under test here.
      expect(screen.queryByTestId('brandmark')).toBeNull();

      const root = screen.getByTestId('brandmark', { includeHiddenElements: true });
      expect(root.props.accessible).toBe(false);
      expect(root.props.importantForAccessibility).toBe('no-hide-descendants');
      expect(root.props.accessibilityLabel).toBeUndefined();
    });

    it('never reflows with Dynamic Type — a logo is a drawn object', async () => {
      await render(<Brandmark lockup="vertical" size="lg" />);

      expect(screen.getByText('P').props.allowFontScaling).toBe(false);
      expect(screen.getByText('PRIVELIER').props.allowFontScaling).toBe(false);
    });
  });

  describe('ground', () => {
    it('follows the theme by default (dark here ⇒ cream ink)', async () => {
      await render(<Brandmark lockup="vertical" size="lg" />);

      expect(wordmarkStyle().color).toBe(darkPalette.textPrimary);
    });

    it('takes the light palette when the ground is forced light, despite a dark theme', async () => {
      await render(<Brandmark lockup="vertical" size="lg" ground="light" />);

      expect(wordmarkStyle().color).toBe(lightPalette.textPrimary);
      expect(wordmarkStyle().color).not.toBe(darkPalette.textPrimary);
    });

    it('takes the dark palette when the ground is forced dark', async () => {
      await render(<Brandmark lockup="vertical" size="lg" ground="dark" />);

      expect(wordmarkStyle().color).toBe(darkPalette.textPrimary);
    });
  });

  describe('typography tokens', () => {
    // The two faces are a deliberate one-weight step apart: the P must read
    // heavier than the wordmark or the seal looks hollow inside its frame.
    it('sets the wordmark in the logo face and the P one weight up', async () => {
      await render(<Brandmark lockup="vertical" size="lg" />);

      expect(wordmarkStyle().fontFamily).toBe('Cinzel_400Regular');
      expect(StyleSheet.flatten(screen.getByText('P').props.style).fontFamily).toBe(
        'Cinzel_600SemiBold'
      );
    });
  });
});

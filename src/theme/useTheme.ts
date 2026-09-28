import { darkPalette, type Palette } from './colors';
import { fontFamily } from './typography';

export function useTheme(): { colors: Palette; fonts: typeof fontFamily; isDark: boolean } {
  return {
    colors: darkPalette,
    fonts: fontFamily,
    isDark: true,
  };
}

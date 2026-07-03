import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './colors';
import { fontFamily } from './typography';

export function useTheme(): { colors: Palette; fonts: typeof fontFamily; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  return {
    colors: isDark ? darkPalette : lightPalette,
    fonts: fontFamily,
    isDark,
  };
}

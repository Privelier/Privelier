import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import { darkPalette, lightPalette } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

export type BrandmarkLockup = 'mark' | 'vertical' | 'horizontal';
export type BrandmarkSize = 'sm' | 'md' | 'lg' | 'xl';
export type BrandmarkGround = 'auto' | 'dark' | 'light';

interface BaseProps {
  size?: BrandmarkSize;
  ground?: BrandmarkGround;
  decorative?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export type BrandmarkProps = BaseProps &
  (
    | { lockup?: 'mark' }
    | { lockup: 'vertical'; size?: 'md' | 'lg' | 'xl' }
    | { lockup: 'horizontal'; size?: 'sm' | 'md' | 'lg' }
  );

const WORDMARK_WHITE = require('../../../assets/privelier-wordmark-white.png') as ImageSourcePropType;
const WORDMARK_BLACK = require('../../../assets/privelier-wordmark-black.png') as ImageSourcePropType;

const WIDTHS: Record<BrandmarkSize, number> = {
  sm: 120,
  md: 160,
  lg: 220,
  xl: 280,
};

export default function Brandmark(props: BrandmarkProps) {
  const { size = 'lg', ground = 'auto', decorative = false, testID, style } = props;
  const { colors, isDark } = useTheme();
  const resolvedColors = ground === 'dark' ? darkPalette : ground === 'light' ? lightPalette : colors;
  const source = resolvedColors === darkPalette || (ground === 'auto' && isDark)
    ? WORDMARK_WHITE
    : WORDMARK_BLACK;
  const width = WIDTHS[size];

  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Privelier' } as const);

  return (
    <View {...a11y} testID={testID ?? 'brandmark'} style={[styles.root, style]}>
      <Image
        source={source}
        resizeMode="contain"
        accessible={false}
        importantForAccessibility="no"
        style={{ width, height: width * 0.114 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
});

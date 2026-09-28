import { Image, StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';

export type BrandmarkLockup = 'mark' | 'vertical' | 'horizontal';
export type BrandmarkSize = 'sm' | 'md' | 'lg' | 'xl';
interface BaseProps {
  size?: BrandmarkSize;
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

const WIDTHS: Record<BrandmarkSize, number> = {
  sm: 120,
  md: 160,
  lg: 220,
  xl: 280,
};

export default function Brandmark(props: BrandmarkProps) {
  const { size = 'lg', decorative = false, testID, style } = props;
  const width = WIDTHS[size];

  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Privelier' } as const);

  return (
    <View {...a11y} testID={testID ?? 'brandmark'} style={[styles.root, style]}>
      <Image
        source={WORDMARK_WHITE}
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

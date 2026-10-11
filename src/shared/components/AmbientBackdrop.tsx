/**
 * The ambient light behind every screen: deep charcoal with two soft, very
 * low-opacity pools of brass and warm bronze. Glass surfaces need something
 * to frost — over a flat colour, translucency and blur are invisible.
 *
 * Speed: a single static SVG (no animation, no blur, no re-render on
 * scroll); it is drawn once per mounted screen and never changes. It sits
 * behind content with pointerEvents="none" and is hidden from assistive
 * technology.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { darkPalette } from '../../theme/colors';

function AmbientBackdropBase() {
  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[StyleSheet.absoluteFill, { backgroundColor: darkPalette.background }]}
      testID="ambient-backdrop"
    >
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="brass" cx="12%" cy="8%" rx="70%" ry="45%" fx="12%" fy="8%">
            <Stop offset="0" stopColor="#BFA06B" stopOpacity="0.20" />
            <Stop offset="1" stopColor="#BFA06B" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="bronze" cx="92%" cy="78%" rx="65%" ry="42%" fx="92%" fy="78%">
            <Stop offset="0" stopColor="#7A5A3A" stopOpacity="0.22" />
            <Stop offset="1" stopColor="#7A5A3A" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ivory" cx="70%" cy="30%" rx="40%" ry="25%" fx="70%" fy="30%">
            <Stop offset="0" stopColor="#F5F1E8" stopOpacity="0.05" />
            <Stop offset="1" stopColor="#F5F1E8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#brass)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#bronze)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#ivory)" />
      </Svg>
    </View>
  );
}

export const AmbientBackdrop = memo(AmbientBackdropBase);

/** Navigator `screenLayout`: every screen paints the backdrop beneath itself. */
export function BackdropLayout({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.fill}>
      <AmbientBackdrop />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

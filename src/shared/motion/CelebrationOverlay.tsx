/**
 * A brief, non-blocking celebration over the current screen: SuccessBurst
 * plus one line ("Booking accepted"), fades in, holds ~1.3 s, fades out.
 * Never intercepts touches (pointerEvents none) and announces its message to
 * screen readers, so it confirms without ever slowing the barber down.
 *
 * Usage: keep `message` in state, set it on success, clear it in onDone.
 */
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { GlassSurface } from '../components/GlassSurface';
import { haptics } from '../haptics';
import { SuccessBurst } from './SuccessBurst';

const HOLD_MS = 1300;

export function CelebrationOverlay({ message, onDone, testID }: { message: string | null; onDone: () => void; testID?: string }) {
  const { colors, fonts } = useTheme();

  useEffect(() => {
    if (!message) return;
    void haptics.success();
    AccessibilityInfo.announceForAccessibility(message);
    const id = setTimeout(onDone, HOLD_MS);
    return () => clearTimeout(id);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
        exiting={FadeOut.duration(220).reduceMotion(ReduceMotion.System)}
        style={styles.center}
        testID={testID}
      >
        <GlassSurface variant="floating" style={styles.card}>
          <SuccessBurst size={64} />
          <Text style={[styles.text, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{message}</Text>
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { alignItems: 'center', paddingHorizontal: space['2xl'], paddingBottom: space.xl, paddingTop: space.xs, borderRadius: radius.xl, minWidth: 220 },
  text: { fontSize: 20, lineHeight: 26, marginTop: -space.sm },
});

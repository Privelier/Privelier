/**
 * Floating glass control in a conversation: appears once the person has
 * scrolled up into history and brings them back to the newest message in
 * one tap. It fades in and out (no spatial motion under Reduce Motion) and
 * is announced as a button, never as a live region, so it never interrupts.
 */
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { duration } from '../../theme/motion';
import { GlassIconButton } from './GlassIconButton';

export const JUMP_TO_LATEST_THRESHOLD = 480;

export function JumpToLatestButton({ visible, onPress, label, testID }: { visible: boolean; onPress: () => void; label: string; testID: string }) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(duration.base).reduceMotion(ReduceMotion.Never)}
      exiting={FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.Never)}
      style={styles.anchor}
      pointerEvents="box-none"
    >
      <GlassIconButton icon="chevron-down" size={44} floating onPress={onPress} accessibilityLabel={label} testID={testID} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: 20, bottom: 96 },
});

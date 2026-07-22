/**
 * Notice — the canonical calm feedback surface (Step-18 Ultra design pass).
 *
 * A hairline-bordered box on `surface`, tone set by `variant`: `error` (the
 * only one that interrupts as an a11y alert), `info` (a benign terminal state
 * such as already-reviewed — border + secondary text, no alarm), and `success`.
 *
 * The primitive owns border/radius/padding/bg/text ONLY — never outer margins,
 * because spacing varies by call site (top margin, horizontal inset, an inline
 * bottom margin). Callers pass positioning via `style`, which absorbs every
 * existing case without a boolean. An optional in-notice action (e.g. a "choose
 * another time" link) goes in `children`, keeping its own testID at the caller.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';

export function Notice({
  message,
  testID,
  variant = 'error',
  style,
  children,
  accessibilityLabel,
}: {
  message: string;
  testID: string;
  variant?: 'error' | 'info' | 'success';
  /** Caller supplies margins/positioning. */
  style?: StyleProp<ViewStyle>;
  /** e.g. an action link rendered under the message. */
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { colors, fonts } = useTheme();
  const borderColor =
    variant === 'error' ? colors.error : variant === 'success' ? colors.success : colors.border;
  const textColor =
    variant === 'error'
      ? colors.errorText
      : variant === 'success'
        ? colors.successText
        : colors.textSecondary;
  return (
    <View
      testID={testID}
      // Only a genuine failure interrupts as an alert; info/success read in order.
      accessibilityRole={variant === 'error' ? 'alert' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[styles.box, { borderColor, backgroundColor: colors.surface }, style]}
    >
      <Text style={[styles.text, { color: textColor, fontFamily: fonts.bodyMedium }]}>{message}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
    paddingVertical: space.md, // 12
    paddingHorizontal: 14, // matches the reviews/booking reference bar
  },
  text: { fontSize: 14, lineHeight: 20 },
});

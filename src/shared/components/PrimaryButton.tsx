/**
 * PrimaryButton — the canonical brass CTA (Step-18 Ultra design pass).
 *
 * ONE size, reconciling the two variants that had silently drifted: the
 * customer/auth 16/16 · minHeight 52 is the canonical bar (comfortably above
 * the 44 floor); the barber 14/15 was drift and is retired. The only genuine
 * feature the barber buttons carried — a leading icon (check/plus) — is an
 * optional `icon` prop, not a size fork.
 *
 * Brass appears here as the one fill the brand allows. `loading` keeps the
 * button at full opacity with a spinner (busy ≠ dead); only a truly `disabled`
 * button dims. Press feedback is the standard soft dim — this also gives the
 * several call sites that had NO pressed state one, for free.
 */
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { radius, space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';

type FeatherName = ComponentProps<typeof Feather>['name'];

export function PrimaryButton({
  label,
  onPress,
  testID,
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  /** Optional leading glyph (barber add/save flows). */
  icon?: FeatherName;
  /** Spinner; also blocks the press. */
  loading?: boolean;
  disabled?: boolean;
  /** Defaults to `label`. */
  accessibilityLabel?: string;
  /** Default true — every current call site stretches full width. */
  fullWidth?: boolean;
}) {
  const { colors, fonts } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? styles.fullWidth : null,
        {
          backgroundColor: colors.accent,
          opacity: loading ? 1 : disabled ? 0.6 : pressed ? pressOpacity.soft : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.onAccent} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={16} color={colors.onAccent} /> : null}
          <Text style={[styles.label, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm, // inert when there's no icon
    borderRadius: radius.md,
    paddingVertical: space.base,
    minHeight: 52, // > 44 floor; literal by design (no 52 on the scale)
  },
  fullWidth: { width: '100%' },
  label: { fontSize: 16 },
});

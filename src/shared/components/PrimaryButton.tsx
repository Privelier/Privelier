import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { usePressFeedback } from '../motion';

type FeatherName = ComponentProps<typeof Feather>['name'];

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  testID: string;
  icon?: FeatherName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  fullWidth?: boolean;
};

export function PrimaryButton({
  label,
  onPress,
  testID,
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  fullWidth = true,
}: PrimaryButtonProps) {
  const { colors, fonts } = useTheme();
  const inactive = disabled || loading;
  const { animatedStyle, onPressIn, onPressOut } = usePressFeedback({ disabled: inactive });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      testID={testID}
      style={[
        styles.hitTarget,
        fullWidth ? styles.fullWidth : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.button,
          fullWidth ? styles.fullWidth : null,
          { backgroundColor: colors.accent },
          animatedStyle,
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
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitTarget: {
    minHeight: 52,
    borderRadius: radius.pill,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    paddingVertical: space.base,
    minHeight: 52,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.6 },
  label: { fontSize: 16 },
});

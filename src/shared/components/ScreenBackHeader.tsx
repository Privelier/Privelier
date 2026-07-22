/**
 * BackButton + ScreenBackHeader — the canonical back affordance (Step-18 Ultra
 * design pass). The 36×36 disc was byte-identical across ~8 screens; this is
 * the real deduplication.
 *
 * `BackButton` is the atom (use it directly when a screen's header layout is
 * bespoke — e.g. a stacked title, a step indicator, or a disc floating over a
 * photo hero via `tone="overImage"`). `ScreenBackHeader` is a thin wrapper for
 * the common plain-row case (disc left, optional inline title, optional right
 * slot). Positioning of the over-hero disc stays the screen's job (absolute
 * placement clear of the status bar).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { pressOpacity } from '../../theme/motion';

// Theme-INDEPENDENT: a disc (or any overlay) over a photo hero must read the
// same in both modes. Exported so any screen with its own hero — currently
// BarberProfileScreen's title-block scrim/text — shares this ONE value
// instead of carrying a byte-identical local copy (Step-18 Ultra pass,
// increment-4 mop-up: this dedup was the mechanical half of the tracked
// "shared HERO_SCRIM constant" item; unifying it with Discover's differently-
// valued trending-tile scrim, rgba(0,0,0,0.55), is a separate, real design
// call and is deliberately NOT made here).
export const OVER_IMAGE_BG = 'rgba(18,18,20,0.72)';
export const OVER_IMAGE_ICON = '#F5F1E8';

export function BackButton({
  onPress,
  testID,
  tone = 'surface',
  disabled = false,
  accessibilityLabel = 'Go back',
}: {
  onPress: () => void;
  testID: string;
  tone?: 'surface' | 'overImage';
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const bg = tone === 'overImage' ? OVER_IMAGE_BG : colors.surface;
  const iconColor = tone === 'overImage' ? OVER_IMAGE_ICON : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={12}
      testID={testID}
      style={({ pressed }) => [
        styles.disc,
        { backgroundColor: bg, opacity: pressed && !disabled ? pressOpacity.soft : 1 },
      ]}
    >
      <Feather name="arrow-left" size={16} color={iconColor} />
    </Pressable>
  );
}

/** Plain header row: back disc on the left, optional inline title, optional right slot. */
export function ScreenBackHeader({
  onPress,
  backTestID,
  backDisabled = false,
  backAccessibilityLabel,
  title,
  right,
}: {
  onPress: () => void;
  backTestID: string;
  backDisabled?: boolean;
  backAccessibilityLabel?: string;
  title?: string;
  right?: ReactNode;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.header}>
      <BackButton
        onPress={onPress}
        testID={backTestID}
        disabled={backDisabled}
        accessibilityLabel={backAccessibilityLabel}
      />
      {title ? (
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
        >
          {title}
        </Text>
      ) : null}
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl, // 24
    paddingTop: space.md, // 12
  },
  title: { fontSize: 18, flexShrink: 1 },
});

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import type { BookingStatus } from '../../types';
import { BOOKING_STATUS_LABELS } from '../format';

type StatusTone = 'brass' | 'success' | 'error' | 'muted';

const STATUS_TONES: Record<BookingStatus, StatusTone> = {
  pending: 'brass',
  accepted: 'success',
  rejected: 'error',
  completed: 'muted',
  cancelled: 'muted',
};

const TONE_COLOR_KEYS = {
  brass: { fill: 'accent', text: 'accentText' },
  success: { fill: 'success', text: 'successText' },
  error: { fill: 'error', text: 'errorText' },
  muted: { fill: 'textSecondary', text: 'textSecondary' },
} as const;

const FILL_ALPHA = '14';
const BORDER_ALPHA = '52';

function appendAlpha(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

export function StatusPill({
  status,
  testID,
  style,
}: {
  status: BookingStatus;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, fonts } = useTheme();
  const tone = STATUS_TONES[status];
  const label = BOOKING_STATUS_LABELS[status];
  const colorKeys = TONE_COLOR_KEYS[tone];
  const toneColor = colors[colorKeys.fill];
  const textColor = colors[colorKeys.text];

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[
        styles.pill,
        {
          backgroundColor: appendAlpha(toneColor, FILL_ALPHA),
          borderColor: appendAlpha(toneColor, BORDER_ALPHA),
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor, fontFamily: fonts.bodyMedium }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: HAIRLINE,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  label: {
    flexShrink: 1,
    fontSize: 12,
  },
});

/**
 * "Usually replies in ~15 min" — a trust signal from barber_stats. Fast
 * responders (<= 30 min) get the brass treatment; everyone else a quiet
 * neutral chip; no data renders nothing (never "unknown").
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { getAppLanguage } from '../../locale';
import { isFastResponder, responseCopy } from '../../barberStats';

export function ResponseBadge({ minutes, onImage = false, testID }: { minutes: number | null | undefined; onImage?: boolean; testID?: string }) {
  const { colors, fonts } = useTheme();
  const copy = responseCopy(minutes, getAppLanguage() === 'de');
  if (!copy) return null;
  const fast = isFastResponder(minutes);
  const tone = fast ? colors.accentText : onImage ? 'rgba(245,241,232,0.85)' : colors.textSecondary;
  return (
    <View
      style={[styles.badge, { borderColor: fast ? colors.accent : colors.border }, onImage ? styles.onImage : null]}
      accessible
      accessibilityLabel={copy}
      testID={testID}
    >
      <Feather name={fast ? 'zap' : 'message-circle'} size={12} color={tone} />
      <Text style={[styles.text, { color: tone, fontFamily: fonts.bodyMedium }]} numberOfLines={1}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs,
    borderWidth: HAIRLINE,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  onImage: { backgroundColor: 'rgba(18,18,20,0.45)' },
  text: { fontSize: 12 },
});

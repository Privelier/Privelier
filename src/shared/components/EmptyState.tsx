/**
 * An empty state with a point: a glass medallion holding a line icon, a
 * short title, one sentence on what fills this space, and at most one next
 * action. Replaces bare "nothing here" text so an empty list still tells
 * the person where they are and what to do next.
 */
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { pressOpacity } from '../../theme/motion';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useGlassStyle } from './GlassSurface';

type Props = {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ icon, title, body, action, testID, style }: Props) {
  const { colors, fonts } = useTheme();
  const medallion = useGlassStyle('brass');
  const actionGlass = useGlassStyle('neutral');
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.medallion, medallion]} accessible={false} importantForAccessibility="no">
        <Feather name={icon} size={24} color={colors.accentText} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]} testID={testID}>
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: colors.textSecondary, fontFamily: fonts.body }]}>{body}</Text> : null}
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          testID={action.testID}
          style={({ pressed }) => [styles.action, actionGlass, pressed ? { opacity: pressOpacity.soft } : null]}
        >
          <Text style={[styles.actionLabel, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space['3xl'] },
  medallion: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  title: { marginTop: space.base, fontSize: 18, lineHeight: 24, textAlign: 'center' },
  body: { marginTop: space.sm, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  action: {
    marginTop: space.lg,
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  actionLabel: { fontSize: 14 },
});

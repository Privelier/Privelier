import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAppLanguage } from './shared/locale';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from './theme/useTheme';
import { HAIRLINE, radius, space } from './theme/spacing';
import { typeScale } from './theme/typography';
import Brandmark from './shared/components/Brandmark';
import type { Role } from './types';

type Props = {
  onSelectRole: (role: Role) => void;
};

export default function RoleSelectScreen({ onSelectRole }: Props) {
  const de = getAppLanguage() === 'de';
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* The app's threshold: the full lockup up top, one plain promise, and
          both choices low on the screen within thumb reach. */}
      <View style={styles.header}>
        <Brandmark lockup="vertical" size="xl" />
      </View>
      <View style={styles.promise}>
        <Text accessibilityRole="header" style={[styles.headline, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Dein Barber kommt zu dir.' : 'Your barber, at your door.'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {de
            ? 'Geprüfte Barber bei dir zu Hause, im Büro oder im Hotel. Wie möchtest du fortfahren?'
            : 'Verified barbers at your home, office or hotel. How would you like to continue?'}
        </Text>
      </View>

      <View style={styles.optionList}>
        <RoleOption
          label={de ? 'Weiter als Kunde' : 'Continue as customer'}
          description={de ? 'Buche einen Barber, der zu dir kommt' : 'Book a private barber to come to you'}
          onPress={() => onSelectRole('customer')}
          testID="role-select-customer"
        />
        <RoleOption
          label={de ? 'Weiter als Barber' : 'Continue as barber'}
          description={de ? 'Verwalte Leistungen und Termine. Die Prüfung deines Profils folgt nach der Registrierung.' : 'Manage your services and bookings. Profile verification follows after sign-up.'}
          onPress={() => onSelectRole('barber')}
          testID="role-select-barber"
        />
      </View>
    </SafeAreaView>
  );
}

function RoleOption({
  label,
  description,
  onPress,
  testID,
}: {
  label: string;
  description: string;
  onPress: () => void;
  testID: string;
}) {
  const { colors, fonts } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The description is otherwise invisible to screen readers (label-only).
      accessibilityHint={description}
      testID={testID}
      style={({ pressed }) => [
        styles.option,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
          {label}
        </Text>
        <Text style={[styles.optionDescription, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {description}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: space.xl,
  },
  header: {
    flex: 1,
    // Centred only here. RoleSelect is the app's one pure threshold — no
    // scroll, no content, full-width cards below — so a centred lockup
    // creates no ragged edge. Other screens stay left-aligned.
    alignItems: 'center',
    justifyContent: 'center',
  },
  promise: {
    marginBottom: space.xl,
  },
  headline: {
    ...typeScale.title1,
  },
  subtitle: {
    ...typeScale.bodyLarge,
    marginTop: space.md,
  },
  optionList: {
    gap: space.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: HAIRLINE,
    borderRadius: radius.xl,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
  },
  optionText: {
    flex: 1,
    marginRight: space.md,
  },
  optionLabel: {
    ...typeScale.bodyLarge,
    marginBottom: space.xs,
  },
  optionDescription: {
    ...typeScale.secondary,
  },
});

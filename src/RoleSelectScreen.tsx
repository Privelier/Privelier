import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from './theme/useTheme';
import Brandmark from './shared/components/Brandmark';
import type { Role } from './types';

type Props = {
  onSelectRole: (role: Role) => void;
};

export default function RoleSelectScreen({ onSelectRole }: Props) {
  const { colors, fonts } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {/* The app's threshold — the one screen that most earns the full
            lockup. Replaces the previous bare Playfair "Privelier" text (which
            carried no testID, so nothing depends on it). */}
        <Brandmark lockup="vertical" size="xl" />
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          Choose how you&rsquo;d like to continue
        </Text>
      </View>

      <View style={styles.optionList}>
        <RoleOption
          label="Continue as customer"
          description="Book a private barber to come to you"
          onPress={() => onSelectRole('customer')}
          testID="role-select-customer"
        />
        <RoleOption
          label="Continue as barber"
          description="Manage your services and bookings"
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
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 48,
    // Centred only here. RoleSelect is the app's one pure threshold — no
    // scroll, no content, full-width cards below — so a centred header
    // creates no ragged edge. Other screens stay left-aligned.
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 16,
    textAlign: 'center',
  },
  optionList: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderRadius: 10,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionText: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 13,
  },
});

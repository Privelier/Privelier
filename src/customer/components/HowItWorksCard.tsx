/**
 * Three-step "how it works" for customers who have not booked yet. The copy
 * states only what the product does today: barbers in the directory passed
 * the manual check, the customer picks a real open slot, and the barber
 * travels to the address given at booking. No promises beyond that.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/useTheme';
import { typeScale } from '../../theme/typography';
import { space } from '../../theme/spacing';
import { GlassSurface } from '../../shared/components/GlassSurface';
import { getAppLanguage } from '../../shared/locale';

type Step = { icon: keyof typeof Feather.glyphMap; title: string; body: string };

const STEPS: Record<'en' | 'de', Step[]> = {
  en: [
    { icon: 'user-check', title: 'Pick a verified barber', body: 'Every barber here was checked by hand.' },
    { icon: 'calendar', title: 'Choose a time', body: 'Only real open slots, with the price up front.' },
    { icon: 'home', title: 'They come to you', body: 'Your barber travels to the address you choose.' },
  ],
  de: [
    { icon: 'user-check', title: 'Verifizierten Barber wählen', body: 'Jeder Barber hier wurde persönlich geprüft.' },
    { icon: 'calendar', title: 'Zeit aussuchen', body: 'Nur echte freie Termine, Preis vorab sichtbar.' },
    { icon: 'home', title: 'Termin bei dir vor Ort', body: 'Dein Barber kommt an die Adresse deiner Wahl.' },
  ],
};

export function HowItWorksCard() {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const steps = STEPS[de ? 'de' : 'en'];

  return (
    <View testID="customer-home-how-it-works">
      <Text
        accessibilityRole="header"
        style={[typeScale.title3, styles.title, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
      >
        {de ? "So funktioniert's" : 'How it works'}
      </Text>
      <GlassSurface style={styles.card}>
        {steps.map((step, index) => (
          <View
            key={step.icon}
            style={styles.step}
            accessible
            accessibilityLabel={`${index + 1}. ${step.title}. ${step.body}`}
          >
            <View style={styles.rail}>
              <View style={[styles.badge, { borderColor: colors.accent }]}>
                <Feather name={step.icon} size={16} color={colors.accentText} />
              </View>
              {index < steps.length - 1 ? <View style={[styles.line, { backgroundColor: colors.border }]} /> : null}
            </View>
            <View style={styles.copy}>
              <Text style={[typeScale.body, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>{step.title}</Text>
              <Text style={[typeScale.secondary, { color: colors.textSecondary, fontFamily: fonts.body }]}>{step.body}</Text>
            </View>
          </View>
        ))}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.md },
  card: { padding: space.base, borderRadius: 18 },
  step: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center', width: 36 },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { width: 1, flex: 1, minHeight: 12, marginVertical: space.xs },
  copy: { flex: 1, minWidth: 0, gap: 2, paddingTop: 2, paddingBottom: space.base },
});

/**
 * Privelier membership preview: price, a redeem-code field and a payment
 * method choice. Payments and code checks are not live, so every action
 * only explains that nothing was charged or applied.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, radius, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

type Language = 'de' | 'en';

function formatEuroPrice(amount: number, language: Language): string {
  return new Intl.NumberFormat(language === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
}

function PaymentMethodOption({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [styles.paymentOption, { borderColor: selected ? colors.accentText : colors.border, backgroundColor: selected ? colors.surface : 'transparent', opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <FontAwesome5 name={label === 'Apple Pay' ? 'apple-pay' : 'google-pay'} size={30} color={colors.textPrimary} accessible={false} />
      <Text style={[styles.paymentOptionText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{label}</Text>
      {selected ? <Feather name="check-circle" size={16} color={colors.accentText} /> : null}
    </Pressable>
  );
}

export function MembershipCard({ language }: { language: Language }) {
  const { colors, fonts } = useTheme();
  const de = language === 'de';
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemFeedback, setRedeemFeedback] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'apple' | 'google' | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };

  const applyRedeemCode = () => {
    setRedeemFeedback(
      redeemCode.trim()
        ? de ? 'Die Codeprüfung ist noch nicht verfügbar. Es wurde kein Rabatt angewendet.' : 'Code checks are not active yet. No discount has been applied.'
        : de ? 'Gib zuerst einen Code ein.' : 'Enter a code to check it.'
    );
  };
  const choose = (method: 'apple' | 'google') => {
    setPaymentMethod(method);
    setPaymentFeedback(null);
  };

  return (
    <View style={styles.membership} testID="barber-membership">
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Privelier Mitgliedschaft' : 'Privelier membership'}</Text>
      <GlassSurface style={styles.membershipCard} testID="barber-membership-card">
        <Text style={[styles.membershipEyebrow, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Monatliche Mitgliedschaft' : 'Monthly membership'}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>{formatEuroPrice(35, language)}</Text>
          <Text style={[styles.perMonth, muted]}>{de ? 'pro Monat' : 'per month'}</Text>
        </View>
        <Text style={[styles.paymentFootnote, muted]} testID="barber-membership-availability">
          {de ? 'Vorschau · Zahlungen und Codeprüfung sind noch nicht verfügbar. Deine Auswahl löst keine Zahlung aus.' : 'Preview · Payments and code checks are not available yet. Your selection will not start a payment.'}
        </Text>
        <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionLabel, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Code einlösen' : 'Redeem a code'}</Text>
        <View style={styles.redeemRow}>
          <TextInput
            value={redeemCode}
            onChangeText={(value) => { setRedeemCode(value); setRedeemFeedback(null); }}
            placeholder={de ? 'Code eingeben' : 'Enter your code'}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={de ? 'Mitgliedschaftscode' : 'Membership redeem code'}
            testID="barber-membership-code"
            style={[styles.codeInput, { color: colors.textPrimary, borderColor: colors.border, fontFamily: fonts.body }]}
          />
          <Pressable
            onPress={applyRedeemCode}
            accessibilityRole="button"
            accessibilityLabel={de ? 'Code prüfen' : 'Check redeem code'}
            testID="barber-membership-code-apply"
            style={({ pressed }) => [styles.codeButton, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
          >
            <Text style={[styles.codeButtonText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Prüfen' : 'Check'}</Text>
          </Pressable>
        </View>
        {redeemFeedback ? <Text accessibilityRole="alert" style={[styles.feedback, muted]} testID="barber-membership-code-feedback">{redeemFeedback}</Text> : null}

        <Text style={[styles.sectionLabel, styles.paymentLabel, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Zahlungsmethode' : 'Payment method'}</Text>
        <View style={styles.paymentMethods}>
          <PaymentMethodOption label="Apple Pay" selected={paymentMethod === 'apple'} onPress={() => choose('apple')} testID="barber-membership-apple-pay" />
          <PaymentMethodOption label="Google Pay" selected={paymentMethod === 'google'} onPress={() => choose('google')} testID="barber-membership-google-pay" />
        </View>
        <Pressable
          onPress={() => setPaymentFeedback(de ? 'Zahlungen sind noch nicht aktiv. Es wurde nichts abgebucht.' : 'Payments are not active yet. No charge has been made.')}
          disabled={!paymentMethod}
          accessibilityRole="button"
          accessibilityLabel={de ? 'Zahlungsstatus ansehen' : 'View payment availability'}
          accessibilityState={{ disabled: !paymentMethod }}
          testID="barber-membership-continue"
          style={({ pressed }) => [styles.continueButton, { backgroundColor: paymentMethod ? colors.accent : colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
        >
          <Text style={[styles.continueText, { color: paymentMethod ? colors.onAccent : colors.textSecondary, fontFamily: fonts.bodySemiBold }]}>{de ? 'Zahlungsstatus ansehen' : 'View payment availability'}</Text>
        </Pressable>
        {paymentFeedback ? <Text accessibilityRole="alert" style={[styles.feedback, muted]} testID="barber-membership-payment-feedback">{paymentFeedback}</Text> : null}
        <Text style={[styles.paymentFootnote, muted]}>
          {de ? 'Apple Pay und Google Pay werden später eingerichtet. Die Auswahl startet keine Zahlung.' : 'Apple Pay and Google Pay setup is coming later. Choosing a method here never starts a payment.'}
        </Text>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  membership: { marginTop: space['2xl'] },
  sectionTitle: { fontSize: 22, lineHeight: 30 },
  membershipCard: { padding: space.lg, marginTop: space.md },
  membershipEyebrow: { fontSize: 13, lineHeight: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm },
  price: { fontSize: 34, lineHeight: 44, fontVariant: ['tabular-nums'] },
  perMonth: { fontSize: 13 },
  sectionDivider: { height: HAIRLINE, marginVertical: space.lg },
  sectionLabel: { fontSize: 14, lineHeight: 20 },
  redeemRow: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  codeInput: { flex: 1, minWidth: 0, minHeight: 48, borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md, fontSize: 14 },
  codeButton: { minWidth: 76, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md },
  codeButtonText: { fontSize: 13 },
  feedback: { fontSize: 12, lineHeight: 18, marginTop: space.sm },
  paymentLabel: { marginTop: space.lg },
  paymentMethods: { gap: space.sm, marginTop: space.sm },
  paymentOption: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: HAIRLINE, borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  paymentOptionText: { flex: 1, fontSize: 14 },
  continueButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, marginTop: space.md },
  continueText: { fontSize: 14 },
  paymentFootnote: { fontSize: 13, lineHeight: 20, marginTop: space.md },
});

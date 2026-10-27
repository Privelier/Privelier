/**
 * Barber "your location" screen — a leaf stack screen reached from Studio's
 * Location card (design: docs/design/explore-location-design-approval.md).
 * Saving pops back to Studio, whose focus refresh re-reads the card.
 * Search, selection and save rules live in useLocationEditor.
 *
 * Privacy (consent copy is mandatory on this screen): customers only ever
 * see an approximate area — the stored display coordinates are offset
 * 200–500 m server-side; the exact address and coordinates never leave the
 * barber's own row.
 */
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { FormSkeleton } from '../../shared/components/ScreenSkeletons';
import { getAppLanguage } from '../../shared/locale';
import { useDiscardGuard } from '../../shared/useDiscardGuard';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { AddressSuggestions } from '../components/location/AddressSuggestions';
import { MIN_QUERY_LENGTH, useLocationEditor } from '../hooks/useLocationEditor';
import { MAX_ADDRESS_LENGTH } from '../locationData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'LocationEdit'>;

export default function LocationEditScreen({ navigation }: Props) {
  const { colors, fonts, isDark } = useTheme();
  const de = getAppLanguage() === 'de';
  const [focused, setFocused] = useState(false);
  const editor = useLocationEditor(de, useCallback(() => navigation.goBack(), [navigation]));
  const { hasUnsavedDraft, submitting, savedRef } = editor;

  const discardGuard = useDiscardGuard(
    navigation,
    useCallback(() => hasUnsavedDraft && !submitting && !savedRef.current, [hasUnsavedDraft, submitting, savedRef])
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="barber-location-screen">
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} testID="barber-location-back" />
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Dein Standort' : 'Your location'}</Text>
      </View>

      {editor.loading ? (
        <FormSkeleton testID="barber-location-loading" label={de ? 'Standort wird geladen' : 'Loading your location'} multiline={false} />
      ) : editor.loadError ? (
        <RetryNotice testID="barber-location-load-error" message={editor.loadError} onRetry={editor.retryLoad} style={styles.noticeMargins} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {de ? 'Deine Basisadresse zeigt dich auf der Karte, damit Kunden in der Nähe dich finden.' : 'Your base address places you on the Explore map so nearby customers can find you.'}
            </Text>

            {/* Consent copy — mandatory. */}
            <View testID="barber-location-consent" style={[styles.consent, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Feather name="eye-off" size={14} color={colors.textSecondary} style={styles.consentIcon} />
              <Text style={[styles.consentText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {de
                  ? 'Kunden sehen nur einen ungefähren Bereich, nie deine genaue Adresse. Dein Pin wird um einige hundert Meter verschoben, deine Straße bleibt privat.'
                  : 'Customers only ever see an approximate area, never your exact address. Your pin is shifted a few hundred metres, and your street address stays private.'}
              </Text>
            </View>

            {editor.formError ? <Notice testID="barber-location-error" message={editor.formError} style={styles.noticeInline} /> : null}

            <TextInput
              value={editor.text}
              onChangeText={editor.onChangeText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={de ? 'z. B. Hauptmarkt 1, Nürnberg' : 'e.g. Prinsengracht 263, Amsterdam'}
              placeholderTextColor={colors.textSecondary}
              maxLength={MAX_ADDRESS_LENGTH}
              autoCorrect={false}
              accessibilityLabel={de ? 'Deine Adresse' : 'Your address'}
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={[
                styles.input,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: focused ? colors.accent : colors.inputBorder, fontFamily: fonts.body },
              ]}
              testID="barber-location-input"
            />

            <AddressSuggestions
              searching={editor.searching}
              searched={editor.searched}
              searchError={editor.searchError}
              candidates={editor.candidates}
              showPickHint={editor.needsPick && !editor.searching && editor.trimmed.length >= MIN_QUERY_LENGTH}
              de={de}
              onPick={editor.pickCandidate}
            />

            <View style={styles.formActions}>
              <PrimaryButton
                label={editor.clearing ? (de ? 'Standort entfernen' : 'Remove location') : (de ? 'Standort speichern' : 'Save location')}
                icon={editor.clearing ? 'trash-2' : 'check'}
                onPress={editor.onSave}
                loading={submitting}
                disabled={!editor.canSave}
                testID="barber-location-save"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <ConfirmSheet
        open={discardGuard.open}
        title={de ? 'Änderungen verwerfen?' : 'Discard changes?'}
        message={de ? 'Deine Standort-Änderungen werden nicht gespeichert.' : "Your location changes won't be saved."}
        confirmLabel={de ? 'Verwerfen' : 'Discard'}
        cancelLabel={de ? 'Weiter bearbeiten' : 'Keep editing'}
        destructive
        onConfirm={discardGuard.discard}
        onClose={discardGuard.keepEditing}
        testID="barber-location-discard"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingTop: space.md },
  heading: { fontSize: 24, marginTop: 16 },
  noticeMargins: { marginHorizontal: space.xl, marginTop: space.lg },
  noticeInline: { marginHorizontal: 0, marginTop: 0, marginBottom: 18 },
  body: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['2xl'] },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  consent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: HAIRLINE,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: 18,
  },
  consentIcon: { marginTop: 2 },
  consentText: { flex: 1, fontSize: 13, lineHeight: 18 },
  input: { borderWidth: HAIRLINE, borderRadius: radius.lg, padding: 14, fontSize: 16 },
  formActions: { marginTop: space.xl },
});

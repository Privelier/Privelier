/**
 * Barber "edit your bio" screen (build-order step 17, bio-edit run) — a leaf
 * STACK screen reached from the Studio tab's Bio card. Single field: the
 * barber's own profile bio.
 *
 * Per architect-review conditions:
 *  - C5: re-fetches the authoritative bio via fetchOwnBarberProfile on mount (a
 *    stale seed is never trusted); a successful save pops back to Studio, whose
 *    focus refresh then recomputes the readiness meter — no event plumbing.
 *  - C6: a plain useEffect mount fetch (NOT useFocusEffect) — this is a leaf
 *    editor with nothing to refresh on re-focus, which keeps the screen fully
 *    component-testable.
 *  - Writes go through updateOwnBio, which trims and stores empty as NULL, so
 *    clearing the bio is a valid save. Save is enabled only when the trimmed
 *    text differs from what loaded (no no-op writes); the input is capped at
 *    MAX_BIO_LENGTH so the server length CHECK can never be the rejecter.
 *
 * Authorization is entirely server-side RLS; this screen sends only the
 * caller's own id (their session user) as the row key.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { Notice } from '../../shared/components/Notice';
import { MAX_BIO_LENGTH, fetchOwnBarberProfile, updateOwnBio } from '../profileData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'BioEdit'>;

/**
 * The counter stays muted until the last 50 characters, then gains emphasis —
 * never colour. maxLength already makes overflow impossible, so reaching 500 is
 * not an error state and must not be dressed as one; and a cap is not an
 * achievement, so it never goes brass either.
 */
const COUNTER_EMPHASIS_AT = MAX_BIO_LENGTH - 50;

export default function BioEditScreen({ navigation }: Props) {
  const { colors, fonts, isDark } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [initialBio, setInitialBio] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  // Set the instant a save succeeds, so the pop it triggers is not mistaken for
  // an abandon by the discard guard below (`dirty` is still true at that point —
  // initialBio is never rewritten).
  const savedRef = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user.id ?? null;
      if (!active) return;
      setBarberId(id);
      if (!id) {
        setLoading(false);
        setLoadError('We could not find your account. Try signing out and back in.');
        return;
      }
      const result = await fetchOwnBarberProfile(id);
      if (!active) return;
      setLoading(false);
      if (result.status === 'ok') {
        const bio = result.profile?.bio ?? '';
        setInitialBio(bio);
        setText(bio);
      } else {
        setLoadError(result.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Dirty only when the trimmed text differs from what loaded — this both
  // prevents pointless no-op writes and allows clearing (initial "x" -> "" is
  // dirty, and updateOwnBio stores it as NULL).
  const dirty = text.trim() !== initialBio.trim();
  const canSave = !loading && !submitting && dirty && barberId !== null;
  // Clearing an existing bio is a legitimate save, not a destruction — it gets
  // honest labelling (below) but keeps the ordinary brass/check treatment.
  const clearing = text.trim() === '' && initialBio.trim() !== '';

  const nearLimit = text.length >= COUNTER_EMPHASIS_AT;
  const atLimit = text.length >= MAX_BIO_LENGTH;
  const remaining = MAX_BIO_LENGTH - text.length;

  // Losing typed prose to a stray back tap IS destructive — unlike clearing,
  // which the barber chose. Guards the header button and Android hardware back.
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirty || submitting || savedRef.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', "Your bio changes won't be saved.", [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty, submitting]);

  const onSave = useCallback(async () => {
    if (!barberId) return;
    setSubmitting(true);
    setFormError(null);
    const result = await updateOwnBio(barberId, text);
    setSubmitting(false);
    if (result.status === 'ok') {
      savedRef.current = true;
      navigation.goBack();
    } else if (result.status === 'not_found') {
      setFormError('We could not find your profile. Try signing out and back in.');
    } else {
      setFormError(result.message);
    }
  }, [barberId, text, navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="barber-bio-screen"
    >
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} testID="barber-bio-back" />
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Your bio
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={colors.accent}
          style={styles.spinner}
          testID="barber-bio-loading"
        />
      ) : loadError ? (
        <Notice testID="barber-bio-load-error" message={loadError} style={styles.noticeMargins} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Tell customers a little about your style and experience. This shows on your profile.
            </Text>

            {formError ? (
              <Notice testID="barber-bio-error" message={formError} style={styles.noticeInline} />
            ) : null}

            <TextInput
              value={text}
              onChangeText={(next) => {
                setText(next);
                // Don't leave a stale red notice sitting above the field the
                // barber is already fixing.
                if (formError) setFormError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. Ten years of sharp fades and classic cuts, brought to your door."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={MAX_BIO_LENGTH}
              textAlignVertical="top"
              accessibilityLabel="Your bio"
              selectionColor={colors.accent}
              cursorColor={colors.accent}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={[
                styles.input,
                {
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderColor: focused ? colors.accent : colors.border,
                  fontFamily: fonts.body,
                },
              ]}
              testID="barber-bio-input"
            />
            <Text
              accessibilityLabel={
                atLimit
                  ? "You've reached the 500 character limit"
                  : nearLimit
                    ? `${remaining} characters left`
                    : `${text.length} of ${MAX_BIO_LENGTH} characters used`
              }
              accessibilityLiveRegion={atLimit ? 'polite' : 'none'}
              style={[
                styles.counter,
                nearLimit
                  ? { color: colors.textPrimary, fontFamily: fonts.bodyMedium }
                  : { color: colors.textSecondary, fontFamily: fonts.body },
              ]}
              testID="barber-bio-counter"
            >
              {text.length} / {MAX_BIO_LENGTH}
            </Text>

            {clearing ? (
              <Text
                testID="barber-bio-clear-hint"
                style={[styles.clearHint, { color: colors.textSecondary, fontFamily: fonts.body }]}
              >
                Saving with an empty bio removes it from your profile.
              </Text>
            ) : null}

            <View style={styles.formActions}>
              <PrimaryButton
                label={clearing ? 'Remove bio' : 'Save bio'}
                icon={clearing ? 'trash-2' : 'check'}
                onPress={onSave}
                loading={submitting}
                disabled={!canSave}
                testID="barber-bio-save"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.xl, paddingTop: space.md },
  heading: { fontSize: 24, marginTop: 16 },
  spinner: { marginTop: 48 },
  noticeMargins: { marginHorizontal: space.xl, marginTop: space.lg },
  // For a notice rendered INSIDE the already-padded ScrollView body.
  noticeInline: { marginHorizontal: 0, marginTop: 0, marginBottom: 18 },
  body: { paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space['2xl'] },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  input: {
    borderWidth: HAIRLINE,
    borderRadius: radius.lg,
    padding: 14,
    minHeight: 160,
    fontSize: 16,
    lineHeight: 22,
  },
  counter: { fontSize: 12, marginTop: space.sm, textAlign: 'right' },
  clearHint: { fontSize: 13, lineHeight: 18, marginTop: space.md },
  formActions: { marginTop: space.xl },
});

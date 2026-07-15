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
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../../../lib/supabase';
import { useTheme } from '../../theme/useTheme';
import { MAX_BIO_LENGTH, fetchOwnBarberProfile, updateOwnBio } from '../profileData';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = NativeStackScreenProps<BarberStackParamList, 'BioEdit'>;

export default function BioEditScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();

  const [barberId, setBarberId] = useState<string | null>(null);
  const [initialBio, setInitialBio] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);

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

  const onSave = useCallback(async () => {
    if (!barberId) return;
    setSubmitting(true);
    setFormError(null);
    const result = await updateOwnBio(barberId, text);
    setSubmitting(false);
    if (result.status === 'ok') {
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
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          testID="barber-bio-back"
          style={[styles.backButton, { backgroundColor: colors.surface }]}
        >
          <Feather name="arrow-left" size={16} color={colors.textPrimary} />
        </Pressable>
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
        <View
          testID="barber-bio-load-error"
          accessibilityRole="alert"
          style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
            {loadError}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Tell customers a little about your style and experience. This shows on your profile.
            </Text>

            {formError ? (
              <View
                testID="barber-bio-error"
                accessibilityRole="alert"
                style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                  {formError}
                </Text>
              </View>
            ) : null}

            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. Ten years of sharp fades and classic cuts, brought to your door."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={MAX_BIO_LENGTH}
              textAlignVertical="top"
              accessibilityLabel="Your bio"
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
              style={[styles.counter, { color: colors.textSecondary, fontFamily: fonts.body }]}
              testID="barber-bio-counter"
            >
              {text.length} / {MAX_BIO_LENGTH}
            </Text>

            <Pressable
              onPress={onSave}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save bio"
              accessibilityState={{ disabled: !canSave }}
              testID="barber-bio-save"
              style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.5 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <>
                  <Feather name="check" size={14} color={colors.onAccent} />
                  <Text style={[styles.primaryButtonText, { color: colors.onAccent, fontFamily: fonts.bodySemiBold }]}>
                    Save bio
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, marginTop: 16 },
  spinner: { marginTop: 48 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12, marginHorizontal: 24, marginTop: 20 },
  noticeText: { fontSize: 14 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  input: { borderWidth: 0.5, borderRadius: 12, padding: 14, minHeight: 160, fontSize: 16, lineHeight: 22 },
  counter: { fontSize: 12, marginTop: 6, textAlign: 'right' },
  primaryButton: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 24,
  },
  primaryButtonText: { fontSize: 15 },
});

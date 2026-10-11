import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { FormTextField } from '../../auth/screens/ui';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { updateOwnProfile } from '../profileData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Load and save fail for different reasons and recover differently: a load
  // failure re-reads the profile (there is nothing to preserve yet), while a
  // save failure must retry the SAME edits — re-reading would overwrite them.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchOwnProfile();
    setLoading(false);
    if (result.status === 'error' || !result.profile) {
      setLoadError(
        result.status === 'error'
          ? result.message
          : de ? 'Dein Profil konnte nicht geladen werden.' : 'Your profile could not be loaded.'
      );
      return;
    }
    setName(result.profile.name);
    setCity(result.profile.city ?? '');
    setCountry(result.profile.country ?? '');
  }, [de]);

  useEffect(() => { Promise.resolve().then(() => void load()); }, [load]);

  const save = useCallback(async () => {
    if (name.trim().length < 2 || city.trim().length < 2) {
      setSaveError(de ? 'Gib deinen Namen und deine Stadt ein.' : 'Enter your name and city.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await updateOwnProfile({ name, city, country });
    setSaving(false);
    if (result.status === 'ok') navigation.goBack();
    else setSaveError(result.message);
  }, [name, city, country, navigation, de]);

  const invalid = name.trim().length < 2 || city.trim().length < 2;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]} edges={['top', 'left', 'right', 'bottom']} testID="customer-edit-profile-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-edit-profile-back" backDisabled={saving} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            {de ? 'Profil bearbeiten' : 'Edit profile'}
          </Text>
          {loadError ? (
            // The form stays hidden until the real profile arrives, so a save
            // can never overwrite stored values with empty fields.
            <Notice message={loadError} testID="customer-edit-profile-error" style={styles.notice}>
              <PrimaryButton label={de ? 'Erneut laden' : 'Try again'} onPress={() => void load()} loading={loading} testID="customer-edit-profile-retry" />
            </Notice>
          ) : (
            <>
              {saveError ? (
                <Notice message={saveError} testID="customer-edit-profile-save-error" variant="error" style={styles.notice}>
                  <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                    {de ? 'Deine Änderungen sind noch da.' : 'Your changes are still here.'}
                  </Text>
                </Notice>
              ) : null}
              <FormTextField label="Name" value={name} onChangeText={setName} testID="customer-edit-profile-name" autoComplete="name" textContentType="name" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => cityRef.current?.focus()} />
              <FormTextField label={de ? 'Stadt' : 'City'} value={city} onChangeText={setCity} inputRef={cityRef} testID="customer-edit-profile-city" textContentType="addressCity" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => countryRef.current?.focus()} />
              <FormTextField label={de ? 'Land' : 'Country'} value={country} onChangeText={setCountry} inputRef={countryRef} optional testID="customer-edit-profile-country" autoComplete="country" textContentType="countryName" returnKeyType="done" onSubmitEditing={() => { if (!invalid && !saving && !loading) void save(); }} />
              <PrimaryButton
                label={saveError ? (de ? 'Erneut speichern' : 'Try saving again') : de ? 'Profil speichern' : 'Save profile'}
                onPress={save}
                loading={saving || loading}
                disabled={invalid}
                testID="customer-edit-profile-save"
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: space.xl },
  heading: { fontSize: 28, lineHeight: 34, marginBottom: space.lg },
  notice: { marginBottom: space.lg },
  hint: { fontSize: 14, lineHeight: 20, marginTop: space.xs },
});

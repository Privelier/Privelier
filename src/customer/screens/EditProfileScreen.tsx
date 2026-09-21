import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { FormTextField } from '../../auth/screens/ui';
import { Notice } from '../../shared/components/Notice';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { updateOwnProfile } from '../profileData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchOwnProfile();
    setLoading(false);
    if (result.status === 'error' || !result.profile) {
      setError(result.status === 'error' ? result.message : 'Your profile could not be loaded.');
      return;
    }
    setName(result.profile.name);
    setCity(result.profile.city ?? '');
    setCountry(result.profile.country ?? '');
  }, []);

  useEffect(() => { Promise.resolve().then(() => void load()); }, [load]);

  const save = useCallback(async () => {
    if (name.trim().length < 2 || city.trim().length < 2) {
      setError('Enter your name and city.');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateOwnProfile({ name, city, country });
    setSaving(false);
    if (result.status === 'ok') navigation.goBack();
    else setError(result.message);
  }, [name, city, country, navigation]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']} testID="customer-edit-profile-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="customer-edit-profile-back" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <Notice message={error} testID="customer-edit-profile-error" style={styles.notice}><PrimaryButton label="Try again" onPress={() => void load()} testID="customer-edit-profile-retry" /></Notice> : null}
          <FormTextField label="Name" value={name} onChangeText={setName} testID="customer-edit-profile-name" autoComplete="name" textContentType="name" />
          <FormTextField label="City" value={city} onChangeText={setCity} testID="customer-edit-profile-city" textContentType="addressCity" />
          <FormTextField label="Country" value={country} onChangeText={setCountry} optional testID="customer-edit-profile-country" autoComplete="country" textContentType="countryName" />
          <PrimaryButton label="Save profile" onPress={save} loading={saving || loading} disabled={name.trim().length < 2 || city.trim().length < 2} testID="customer-edit-profile-save" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: space.xl }, notice: { marginBottom: space.lg } });

/**
 * Customer Account tab — full rebuild of the prototype's customer.account
 * route: serif header, profile row (avatar, name, email, brass "Member"
 * label), hairline-divided settings rows, and the destructive-styled sign
 * out row at the bottom.
 *
 * Deliberate deviations from the prototype:
 * - Wallet & payments and Gift cards & credits rows are ABSENT — founder-
 *   excluded as out of MVP scope (payments are Phase 2). Do not add them.
 * - The stats strip (cuts / barbers / avg rating) is deferred until real
 *   bookings/reviews data exists — an all-zero strip on day one is noise,
 *   not information.
 * - No verified badge next to the customer's name: verification is a
 *   barber-only concept in this product.
 *
 * Each settings row navigates to a real AccountSection stack screen whose
 * body is an honest placeholder until its feature exists.
 * customer-account-logout keeps its testID (referenced by the login E2E
 * flow).
 */
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { fetchOwnProfile } from '../../auth/authService';
import { useExitRole } from '../../RoleContext';
import { useTheme } from '../../theme/useTheme';
import { pressOpacity } from '../../theme/motion';
import type { UsersRow } from '../../types';
import { ACCOUNT_SECTIONS, type AccountSectionKey } from './AccountSectionScreen';
import type { CustomerTabParamList } from '../CustomerTabs';
import type { CustomerStackParamList } from '../CustomerNavigator';
import { Notice } from '../../shared/components/Notice';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Account'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const SETTINGS_ROWS: { key: AccountSectionKey; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'privacy', icon: 'shield' },
  { key: 'help', icon: 'help-circle' },
];

export default function AccountScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const onSignOut = useExitRole();
  const [profile, setProfile] = useState<UsersRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await fetchOwnProfile();
    if (result.status === 'ok') setProfile(result.profile);
    else setError(result.message);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-account-screen"
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          Account
        </Text>

        {error ? (
          <Notice message={error} testID="customer-account-error" style={styles.errorNotice}>
            <Pressable onPress={() => void load()} accessibilityRole="button" style={styles.retryAction}>
              <Text style={{ color: colors.accentText, fontFamily: fonts.bodyMedium }}>Try again</Text>
            </Pressable>
          </Notice>
        ) : null}

        <Pressable
          onPress={() => navigation.navigate('EditProfile')}
          accessibilityRole="button"
          accessibilityLabel="Edit profile and city"
          testID="customer-account-edit-profile"
          style={({ pressed }) => [styles.profileRow, pressed ? { opacity: pressOpacity.soft } : null]}
        >
          {profile?.profile_image ? (
            <Image source={{ uri: profile.profile_image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarInitial, { color: colors.textSecondary, fontFamily: fonts.headingMedium }]}>
                {profile?.name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.profileText}>
            <Text
              numberOfLines={1}
              style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}
            >
              {profile?.name || 'Member'}
            </Text>
            {profile?.email ? (
              <Text
                numberOfLines={1}
                style={[styles.email, { color: colors.textSecondary, fontFamily: fonts.body }]}
              >
                {profile.email}
              </Text>
            ) : null}
            <Text style={[styles.member, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
              Member
            </Text>
          </View>
          <Feather name="edit-2" size={16} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.settingsList}>
          {SETTINGS_ROWS.map(({ key, icon }, index) => (
            <Pressable
              key={key}
              onPress={() => navigation.navigate('AccountSection', { section: key })}
              accessibilityRole="button"
              accessibilityLabel={ACCOUNT_SECTIONS[key].title}
              testID={`customer-account-row-${key}`}
              style={({ pressed }) => [
                styles.settingsRow,
                index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null,
                pressed ? { opacity: pressOpacity.soft } : null,
              ]}
            >
              {/* Brass is rationed to the "Member" label only; row icons are muted
                  so the accent reads as a badge, not decoration. */}
              <Feather name={icon} size={16} color={colors.textSecondary} />
              <Text style={[styles.settingsLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>
                {ACCOUNT_SECTIONS[key].title}
              </Text>
              <Feather name="chevron-right" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          testID="customer-account-logout"
          style={({ pressed }) => [
            styles.signOutRow,
            { borderTopColor: colors.border },
            pressed ? { opacity: pressOpacity.soft } : null,
          ]}
        >
          <Feather name="log-out" size={16} color={colors.errorText} />
          <Text style={[styles.signOutText, { color: colors.errorText, fontFamily: fonts.body }]}>
            Sign out
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 32 },
  heading: { fontSize: 30, marginTop: 24 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 32 },
  errorNotice: { marginTop: 20 },
  retryAction: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 24 },
  profileText: { flexShrink: 1, minWidth: 0 },
  name: { fontSize: 20 },
  email: { fontSize: 12, marginTop: 2 },
  member: { fontSize: 10, letterSpacing: 2, marginTop: 4 },

  settingsList: { marginTop: 32 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  settingsLabel: { flex: 1, fontSize: 14 },

  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 0.5,
  },
  signOutText: { fontSize: 14 },
});

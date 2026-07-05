/**
 * Customer home screen (build-order step 9-10): city-based barber discovery.
 *
 * Fetches the signed-in customer's own `city` via the existing
 * `fetchOwnProfile` auth data-layer function (Contract B — same pattern used
 * elsewhere to read the caller's own users row), then lists approved barbers
 * in that city via the Stage 4 discovery data layer. No search/filter UI —
 * the automatic city-based fetch is the whole of this feature's scope.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { fetchOwnProfile } from '../../auth/authService';
import { useTheme } from '../../theme/useTheme';
import { useExitRole } from '../../RoleContext';
import type { BarberDirectoryRow } from '../../types';
import { listBarbersByCity } from '../discoveryData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'CustomerHome'>;

export default function CustomerHomeScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  // In authenticated states the exit action is a real sign-out (Contract A).
  const onSignOut = useExitRole();

  const [city, setCity] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<BarberDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const profileResult = await fetchOwnProfile();
    if (profileResult.status === 'error') {
      setLoading(false);
      setError(profileResult.message);
      return;
    }

    const ownCity = profileResult.profile?.city?.trim();
    if (!ownCity) {
      setLoading(false);
      setError('Add your city to your profile to see barbers near you.');
      return;
    }

    setCity(ownCity);
    const barbersResult = await listBarbersByCity(ownCity);
    setLoading(false);
    if (barbersResult.status === 'ok') {
      setBarbers(barbersResult.barbers);
    } else {
      setError(barbersResult.message);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // Deferred via .then() (not called directly): calling an async function
    // synchronously in an effect body runs its pre-await statements (the
    // setState calls at the top of `load`) synchronously within the effect,
    // which react-hooks/set-state-in-effect flags. Scheduling through a
    // resolved promise's .then callback matches the pattern already used in
    // the barber-side screens (ServicesScreen/AvailabilityScreen).
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      testID="customer-home-screen"
    >
      <FlatList
        data={barbers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
                Discover barbers
              </Text>
              {city ? (
                <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                  {city}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onSignOut}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              hitSlop={16}
              testID="customer-home-logout"
            >
              <Text style={[styles.logOut, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
                Log out
              </Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.spinner}
              testID="customer-home-loading"
            />
          ) : error ? (
            <View
              testID="customer-home-error"
              accessibilityRole="alert"
              style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
                {error}
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}
              testID="customer-home-empty"
            >
              {`No barbers found in ${city ?? 'your city'} yet.`}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('BarberProfile', { barberId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`View ${item.name}'s profile`}
            testID={`customer-home-barber-${item.id}`}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {item.profile_image ? (
              <Image source={{ uri: item.profile_image }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.avatarInitial, { color: colors.textSecondary, fontFamily: fonts.bodySemiBold }]}>
                  {item.name.trim().charAt(0).toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.rowInfo}>
              <Text style={[styles.rowName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                {item.name}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {[item.city, item.country].filter(Boolean).join(', ') || 'Location not set'}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingHorizontal: 24, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginBottom: 16,
  },
  headerText: { flex: 1, paddingRight: 12 },
  heading: { fontSize: 26 },
  subheading: { fontSize: 14, marginTop: 4 },
  logOut: { fontSize: 14, paddingTop: 4 },
  spinner: { marginTop: 32 },
  notice: { borderWidth: 0.5, borderRadius: 10, padding: 12 },
  noticeText: { fontSize: 14 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18 },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, marginBottom: 2 },
  rowMeta: { fontSize: 13 },
});

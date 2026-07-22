/**
 * Generic account-section screen: every settings row on the Account tab
 * (Favorites, Notifications, Privacy & security, Preferences, Help center)
 * pushes this screen with its section key. Each body is a calm, honest
 * placeholder until the underlying feature exists — none of these are MVP
 * build-order items, but the rows navigating somewhere real keeps the
 * Account tab's structure final. Wallet/payments and gift cards are
 * deliberately absent (founder-excluded, out of MVP scope).
 */
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import type { CustomerStackParamList } from '../CustomerNavigator';

export type AccountSectionKey =
  | 'favorites'
  | 'notifications'
  | 'privacy'
  | 'preferences'
  | 'help';

export const ACCOUNT_SECTIONS: Record<AccountSectionKey, { title: string; blurb: string }> = {
  favorites: {
    title: 'Favorites',
    blurb: 'Barbers you save will appear here.',
  },
  notifications: {
    title: 'Notifications',
    blurb: 'Notification preferences arrive in a later update.',
  },
  privacy: {
    title: 'Privacy & security',
    blurb: 'Privacy and security settings are on their way.',
  },
  preferences: {
    title: 'Preferences',
    blurb: 'The app follows your device appearance for now; more preferences arrive later.',
  },
  help: {
    title: 'Help center',
    blurb: 'Questions or trouble with a booking? Write to us at privelier@outlook.com.',
  },
};

type Props = NativeStackScreenProps<CustomerStackParamList, 'AccountSection'>;

export default function AccountSectionScreen({ route, navigation }: Props) {
  const { colors, fonts } = useTheme();
  const { title, blurb } = ACCOUNT_SECTIONS[route.params.section];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-account-section-screen"
    >
      <View style={styles.backRow}>
        <BackButton onPress={() => navigation.goBack()} testID="customer-account-section-back" />
      </View>

      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {title}
      </Text>
      <View style={styles.body}>
        <Text style={[styles.blurb, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {blurb}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  backRow: { flexDirection: 'row', marginTop: 12 },
  heading: { fontSize: 24, marginTop: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 96 },
  blurb: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
});

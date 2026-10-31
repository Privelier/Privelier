/**
 * Barber settings: the home for legal access, help, sign-out and account
 * deletion. Reached from
 * Studio without replacing any of the five role-specific tabs.
 */
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useExitRole } from '../../RoleContext';
import { LegalLinks } from '../../legal/LegalComponents';
import { DeleteAccountAction } from '../../shared/components/DeleteAccountAction';
import { Colophon } from '../../shared/components/Colophon';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { Reveal } from '../../shared/motion';
import { getAppLanguage } from '../../shared/locale';
import { pressOpacity } from '../../theme/motion';
import { HAIRLINE, radius, space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { BarberStackParamList } from '../BarberNavigator';
import { supabase } from '../../../lib/supabase';
import { barberProfileLink } from '../../shared/profileLinks';
import { ProfileQrCode } from '../components/ProfileQrCode';

type Props = NativeStackScreenProps<BarberStackParamList, 'Settings'>;

export default function BarberSettingsScreen({ navigation }: Props) {
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const onSignOut = useExitRole();
  const [showQr, setShowQr] = useState(false);
  const [barberId, setBarberId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setBarberId(data.session?.user.id ?? null);
    });
    return () => { active = false; };
  }, []);

  const rows: { key: string; icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void }[] = [
    { key: 'bio', icon: 'edit-3', label: de ? 'Bio bearbeiten' : 'Edit bio', onPress: () => navigation.navigate('BioEdit') },
    { key: 'location', icon: 'map-pin', label: de ? 'Einsatzgebiet bearbeiten' : 'Edit service location', onPress: () => navigation.navigate('LocationEdit') },
    { key: 'share', icon: 'share-2', label: de ? 'Profil teilen' : 'Share your profile', onPress: () => setShowQr((current) => !current) },
    {
      key: 'help',
      icon: 'help-circle',
      label: de ? 'Hilfe und Kontakt' : 'Help and contact',
      onPress: () => void Linking.openURL('mailto:privelier@outlook.com?subject=Privelier%20barber%20help'),
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']} testID="barber-settings-screen">
      <ScreenBackHeader onPress={() => navigation.goBack()} backTestID="barber-settings-back" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {de ? 'Einstellungen' : 'Settings'}
        </Text>

        <Reveal index={0}>
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rows.map((row, index) => (
              <Pressable
                key={row.key}
                onPress={row.onPress}
                accessibilityRole="button"
                accessibilityLabel={row.label}
                testID={`barber-settings-row-${row.key}`}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 ? { borderTopWidth: HAIRLINE, borderTopColor: colors.border } : null,
                  pressed ? { opacity: pressOpacity.soft } : null,
                ]}
              >
                <Feather name={row.icon} size={20} color={colors.textSecondary} />
                <Text style={[styles.rowLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>{row.label}</Text>
                <Feather name="chevron-right" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </Reveal>

        {showQr && barberId ? (
          <Reveal index={0} style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ProfileQrCode value={barberProfileLink(barberId)} size={184} testID="barber-settings-qr" />
            <Text style={[styles.qrHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              {de
                ? 'Kunden mit der Privelier-App scannen diesen Code, um dein Profil zu öffnen.'
                : 'Customers with the Privelier app can scan this to open your profile.'}
            </Text>
            <Pressable
              onPress={() => void Share.share({ message: de ? `Buche mich auf Privelier: ${barberProfileLink(barberId)}` : `Book me on Privelier: ${barberProfileLink(barberId)}` })}
              accessibilityRole="button"
              testID="barber-settings-share-link"
              style={({ pressed }) => [styles.qrShare, { borderColor: colors.accent, opacity: pressed ? pressOpacity.soft : 1 }]}
            >
              <Feather name="share" size={16} color={colors.accentText} />
              <Text style={[styles.qrShareText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Link teilen' : 'Share link'}</Text>
            </Pressable>
          </Reveal>
        ) : null}

        <Reveal index={1} style={[styles.dangerZone, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel={de ? 'Abmelden' : 'Sign out'}
            testID="barber-settings-logout"
            style={({ pressed }) => [styles.dangerRow, pressed ? { opacity: pressOpacity.soft } : null]}
          >
            <Feather name="log-out" size={20} color={colors.errorText} />
            <Text style={[styles.dangerText, { color: colors.errorText, fontFamily: fonts.body }]}>{de ? 'Abmelden' : 'Sign out'}</Text>
          </Pressable>
          <DeleteAccountAction onDeleted={onSignOut} testID="barber-settings-delete" />
        </Reveal>

        <LegalLinks includeAll testIDPrefix="barber-settings-legal" />
        <Colophon testID="barber-settings-colophon" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: space.xl, paddingBottom: space['2xl'] },
  heading: { fontSize: 30, lineHeight: 38, marginTop: space.md },
  list: { marginTop: space['2xl'], borderRadius: radius.xl, borderWidth: HAIRLINE, paddingHorizontal: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  rowLabel: { flex: 1, fontSize: 16 },
  qrCard: { marginTop: space.lg, borderWidth: HAIRLINE, borderRadius: radius.xl, padding: space.lg, alignItems: 'center', gap: space.md },
  qrHint: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  qrShare: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, borderWidth: HAIRLINE, borderRadius: radius.md, paddingHorizontal: space.base },
  qrShareText: { fontSize: 14 },
  dangerZone: { marginTop: space['2xl'], borderTopWidth: HAIRLINE, paddingTop: space.md },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52 },
  dangerText: { fontSize: 14 },
});

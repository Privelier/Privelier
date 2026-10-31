/**
 * Studio tab pieces: the "manage your studio" shortcuts and the portfolio
 * grid's uploading and add tiles.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { portfolioTileStyle } from '../../../shared/components/PortfolioGrid';
import { pressOpacity } from '../../../theme/motion';
import { HAIRLINE, space } from '../../../theme/spacing';
import { useTheme } from '../../../theme/useTheme';

type StudioScreen = 'Services' | 'Availability' | 'BioEdit' | 'LocationEdit';

const STUDIO_ACTIONS = {
  en: [
    { title: 'Services', summary: 'Prices and durations', icon: 'scissors', screen: 'Services', testID: 'barber-dashboard-services' },
    { title: 'Availability', summary: 'Your weekly schedule', icon: 'calendar', screen: 'Availability', testID: 'barber-dashboard-availability' },
    { title: 'Bio', summary: 'Your public introduction', icon: 'edit-3', screen: 'BioEdit', testID: 'barber-dashboard-bio' },
    { title: 'Location', summary: 'Your service area', icon: 'map-pin', screen: 'LocationEdit', testID: 'barber-dashboard-location' },
  ],
  de: [
    { title: 'Leistungen', summary: 'Preise und Dauer', icon: 'scissors', screen: 'Services', testID: 'barber-dashboard-services' },
    { title: 'Verfügbarkeit', summary: 'Dein Wochenplan', icon: 'calendar', screen: 'Availability', testID: 'barber-dashboard-availability' },
    { title: 'Profiltext', summary: 'Deine öffentliche Vorstellung', icon: 'edit-3', screen: 'BioEdit', testID: 'barber-dashboard-bio' },
    { title: 'Standort', summary: 'Dein Servicegebiet', icon: 'map-pin', screen: 'LocationEdit', testID: 'barber-dashboard-location' },
  ],
} as const;

// The uploading tile dims the real picked image under a flat scrim — a fixed
// over-image value, theme-independent by design (same precedent as the
// shared delete scrim and the customer hero scrim).
const UPLOAD_SCRIM = 'rgba(18,18,20,0.45)';

export function StudioManagement({ language, onOpen }: { language: 'de' | 'en'; onOpen: (screen: StudioScreen) => void }) {
  const { colors, fonts } = useTheme();
  return (
    <GlassSurface style={styles.surface} testID="barber-studio-management">
      <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{language === 'de' ? 'Verwalte dein Studio' : 'Manage your studio'}</Text>
      <View style={styles.grid}>
        {STUDIO_ACTIONS[language].map((action) => (
          <Pressable
            key={action.testID}
            onPress={() => onOpen(action.screen)}
            accessibilityRole="button"
            accessibilityLabel={`${action.title}. ${action.summary}`}
            testID={action.testID}
            style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: colors.surface }]}><Feather name={action.icon} size={21} color={colors.accentText} /></View>
            <View style={styles.copy}>
              <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{action.title}</Text>
              <Text style={[styles.summary, { color: colors.textSecondary, fontFamily: fonts.body }]}>{action.summary}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </Pressable>
        ))}
      </View>
    </GlassSurface>
  );
}

export function UploadingTile({ uri, de }: { uri: string | null; de: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[portfolioTileStyle, { backgroundColor: colors.surface }]}
      testID="barber-portfolio-uploading"
      accessibilityRole="progressbar"
      accessibilityLabel={de ? 'Bild wird hochgeladen' : 'Uploading image'}
    >
      {uri ? <Image source={{ uri }} style={styles.uploadingImage} contentFit="cover" /> : null}
      <View style={[styles.uploadingScrim, { backgroundColor: UPLOAD_SCRIM }]}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    </View>
  );
}

export function AddTile({ de, onPress }: { de: boolean; onPress: () => void }) {
  const { colors, fonts } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={de ? 'Portfoliobild hinzufügen' : 'Add portfolio image'}
      testID="barber-portfolio-add"
      style={({ pressed }) => [portfolioTileStyle, styles.addTile, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
    >
      <Feather name="plus" size={20} color={colors.accentText} />
      <Text style={[styles.addLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>{de ? 'Bild hinzufügen' : 'Add image'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: { marginTop: space.xl, padding: space.base },
  sectionTitle: { fontSize: 20, lineHeight: 27 },
  grid: { marginTop: space.md },
  action: { minHeight: 80, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: HAIRLINE, paddingVertical: space.md },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 16, lineHeight: 23 },
  summary: { fontSize: 13, lineHeight: 20, marginTop: 3 },
  uploadingImage: { width: '100%', height: '100%' },
  uploadingScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  addTile: { borderWidth: HAIRLINE, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  addLabel: { fontSize: 14, textAlign: 'center' },
});

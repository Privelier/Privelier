/**
 * Barber Studio tab: management shortcuts, then the portfolio — an
 * "N of 6 — a curated set." counter and a 2-column square grid with an add
 * tile while under the cap. Upload and delete live in usePortfolio.
 *
 * Images render via getPublicPortfolioUrl(image_url) — the DB stores the
 * object PATH, never a URL (design D2).
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { PortfolioGrid } from '../../shared/components/PortfolioGrid';
import { PortfolioTile } from '../../shared/components/PortfolioTile';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { PortfolioGridSkeleton } from '../../shared/components/ScreenSkeletons';
import { getAppLanguage } from '../../shared/locale';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { space } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import type { PortfolioRow } from '../../types';
import { AddTile, StudioManagement, UploadingTile } from '../components/portfolio/PortfolioParts';
import { usePortfolio } from '../hooks/usePortfolio';
import { MAX_PORTFOLIO_IMAGES } from '../portfolioData';
import type { BarberTabParamList } from '../BarberTabs';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Portfolio'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export default function PortfolioScreen({ navigation }: Props) {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const language = getAppLanguage();
  const de = language === 'de';
  const { colors, fonts } = useTheme();
  const [pendingDelete, setPendingDelete] = useState<PortfolioRow | null>(null);
  const { images, loading, error, uploading, pendingUri, load, add, remove } = usePortfolio(de);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-portfolio-screen">
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabClearance }]}>
        <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>Studio</Text>
        <StudioManagement language={language} onOpen={(screen) => navigation.navigate(screen)} />
        <Text style={[styles.workHeading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Deine Arbeit' : 'Your work'}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="barber-portfolio-counter">
          <Text style={{ color: colors.accentText, fontFamily: fonts.bodySemiBold }}>{images.length}</Text>
          {de ? ` von ${MAX_PORTFOLIO_IMAGES} · eine kuratierte Auswahl.` : ` of ${MAX_PORTFOLIO_IMAGES} — a curated set.`}
        </Text>

        {loading ? (
          <PortfolioGridSkeleton testID="barber-portfolio-loading" label={de ? 'Portfolio wird geladen' : 'Loading your portfolio'} style={styles.gridSpacing} />
        ) : error ? (
          <RetryNotice testID="barber-portfolio-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} />
        ) : (
          <>
            <PortfolioGrid style={styles.gridSpacing}>
              {images.map((img) => (
                <PortfolioTile
                  key={img.id}
                  imagePath={img.image_url}
                  onDelete={() => setPendingDelete(img)}
                  deleteDisabled={uploading}
                  testID={`barber-portfolio-image-${img.id}`}
                  deleteTestID={`barber-portfolio-delete-${img.id}`}
                />
              ))}
              {uploading ? (
                <UploadingTile uri={pendingUri} de={de} />
              ) : images.length < MAX_PORTFOLIO_IMAGES ? (
                <AddTile de={de} onPress={() => void add()} />
              ) : null}
            </PortfolioGrid>
            {images.length === 0 && !uploading ? (
              <Text style={[styles.emptyHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {de ? 'Zeig deine besten Arbeiten auf deinem öffentlichen Profil.' : 'Your best work, shown on your public profile.'}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <ConfirmSheet
        open={pendingDelete !== null}
        title={de ? 'Bild löschen' : 'Delete image'}
        message={de ? 'Dieses Bild aus deinem Portfolio entfernen?' : 'Remove this image from your portfolio?'}
        confirmLabel={de ? 'Löschen' : 'Delete'}
        cancelLabel={de ? 'Abbrechen' : 'Cancel'}
        destructive
        onConfirm={() => {
          const image = pendingDelete;
          setPendingDelete(null);
          if (image) void remove(image);
        }}
        onClose={() => setPendingDelete(null)}
        testID="barber-portfolio-delete-confirm"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: space.xl, paddingTop: space.xl, paddingBottom: space['2xl'] },
  heading: { fontSize: 30 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  noticeMargins: { marginTop: space.xl },
  gridSpacing: { marginTop: space.xl },
  workHeading: { fontSize: 21, lineHeight: 28, marginTop: space['2xl'] },
  emptyHint: { fontSize: 12, marginTop: 16 },
});

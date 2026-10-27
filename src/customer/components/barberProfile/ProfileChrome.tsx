/**
 * Everything that floats over the profile: the booking dock, the back,
 * share and save buttons over the hero, and the first-load skeleton.
 */
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { BackButton, OVER_IMAGE_BG, OVER_IMAGE_ICON } from '../../../shared/components/ScreenBackHeader';
import { Skeleton } from '../../../shared/components/Skeleton';
import { barberProfileLink } from '../../../shared/profileLinks';
import { pressOpacity } from '../../../theme/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow } from '../../../types';
import { formatMoney } from '../../format';
import { profileStyles as styles } from './profileStyles';

export function BookingDock({
  fromPrice,
  bottomInset,
  german,
  onChooseService,
}: {
  fromPrice: number;
  bottomInset: number;
  german: boolean;
  onChooseService: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <GlassSurface variant="floating" style={[styles.bookingDock, { paddingBottom: Math.max(bottomInset, 16) }]} testID="barber-profile-booking-dock">
      <Text style={[styles.dockPrice, numericText, { color: colors.textPrimary }]}>
        {german ? 'Ab' : 'From'} {formatMoney(fromPrice)}
      </Text>
      <Pressable
        testID="barber-profile-choose-service"
        accessibilityRole="button"
        accessibilityLabel={german ? 'Leistung zum Buchen auswählen' : 'Choose a service to book'}
        onPress={onChooseService}
        style={({ pressed }) => [styles.dockButton, { backgroundColor: colors.accent, opacity: pressed ? pressOpacity.firm : 1 }]}
      >
        <Text style={[styles.bookButtonText, { fontFamily: fonts.bodyMedium, color: colors.onAccent }]}>
          {german ? 'Leistung wählen' : 'Choose service'}
        </Text>
        <Feather name="arrow-right" size={18} color={colors.onAccent} />
      </Pressable>
    </GlassSurface>
  );
}

export function HeroButtons({
  barber,
  topInset,
  favorite,
  german,
  onBack,
  onToggleFavorite,
}: {
  barber: BarberDirectoryRow;
  topInset: number;
  /** null until known, so the heart never shows a guess. */
  favorite: boolean | null;
  german: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
}) {
  const { colors } = useTheme();
  const disc = ({ pressed }: { pressed: boolean }) => [styles.favoriteDisc, { backgroundColor: OVER_IMAGE_BG, opacity: pressed ? pressOpacity.soft : 1 }];
  return (
    <>
      <View style={[styles.backWrap, { top: topInset + 8 }]}>
        <BackButton onPress={onBack} testID="barber-profile-back" tone="overImage" />
      </View>
      <View style={[styles.favoriteWrap, { top: topInset + 8 }]}>
        <Pressable
          onPress={() => void Share.share({
            message: german
              ? `${barber.name} auf Privelier: ${barberProfileLink(barber.id)}`
              : `${barber.name} on Privelier: ${barberProfileLink(barber.id)}`,
          })}
          accessibilityRole="button"
          accessibilityLabel={german ? 'Profil teilen' : 'Share profile'}
          hitSlop={12}
          testID="barber-profile-share"
          style={disc}
        >
          <Feather name="share" size={16} color={OVER_IMAGE_ICON} />
        </Pressable>
        <Pressable
          onPress={onToggleFavorite}
          disabled={favorite === null}
          accessibilityRole="button"
          accessibilityLabel={favorite
            ? german ? 'Aus gespeicherten Barbern entfernen' : 'Remove from saved barbers'
            : german ? 'Barber speichern' : 'Save barber'}
          accessibilityState={{ selected: favorite === true, disabled: favorite === null }}
          hitSlop={12}
          testID="barber-profile-favorite"
          style={disc}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={17} color={favorite ? colors.accent : OVER_IMAGE_ICON} />
        </Pressable>
      </View>
    </>
  );
}

export function BarberProfileSkeleton() {
  return (
    <ScrollView testID="barber-profile-loading" accessible accessibilityRole="progressbar" accessibilityLabel="Loading barber profile" contentContainerStyle={styles.profileSkeleton}>
      <Skeleton style={styles.skeletonHero} />
      <Skeleton style={styles.skeletonName} />
      <Skeleton style={styles.skeletonMeta} />
      <Skeleton style={styles.skeletonBio} />
      <View style={styles.skeletonTabs}>
        {[0, 1, 2].map((index) => <Skeleton key={index} style={styles.skeletonTab} />)}
      </View>
      {[0, 1].map((index) => (
        <View key={index} style={styles.skeletonService}>
          <Skeleton style={styles.skeletonServiceName} />
          <Skeleton style={styles.skeletonServiceMeta} />
        </View>
      ))}
    </ScrollView>
  );
}

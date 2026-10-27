/**
 * Barber profile: full-bleed hero, bio with service chips, and a Services /
 * Portfolio / Reviews tab strip. Data lives in useBarberProfileData; the
 * sections are in components/barberProfile.
 *
 * Rendering stays data-honest: services show name, duration and price only
 * (no description column), there are no distance or experience lines, and
 * empty tabs say so. The per-row Book button carries the barber and the
 * full service row into the booking flow so it never re-fetches them.
 *
 * Maestro contract preserved: barber-profile-screen / -back / -loading /
 * -error / -not-found / -rating / -services-error / -services-empty /
 * -service-{id} / -portfolio-placeholder.
 */
import { useCallback, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ReportSheet } from '../../shared/components/ReportSheet';
import { BackButton } from '../../shared/components/ScreenBackHeader';
import { getAppLanguage } from '../../shared/locale';
import { ScrollGlassHeader, useReducedMotionPreference, useScrollGlass } from '../../shared/motion';
import { useTheme } from '../../theme/useTheme';
import type { ServiceRow } from '../../types';
import { BarberProfileSkeleton, BookingDock, HeroButtons } from '../components/barberProfile/ProfileChrome';
import { ProfileAbout, ProfileHero } from '../components/barberProfile/ProfileHero';
import { PortfolioTab, ProfileTabStrip, ReviewsTab, ServicesTab, type ProfileTab } from '../components/barberProfile/ProfileTabs';
import { HERO_PARALLAX_HEIGHT, profileStyles as styles } from '../components/barberProfile/profileStyles';
import { useBarberProfileData } from '../hooks/useBarberProfileData';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BarberProfile'>;

export default function BarberProfileScreen({ route, navigation }: Props) {
  const { barberId } = route.params;
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const german = getAppLanguage() === 'de';
  const scrollRef = useRef<Animated.ScrollView>(null);
  const servicesY = useRef(0);
  const { scrollY, onScroll } = useScrollGlass();
  const [tab, setTab] = useState<ProfileTab>('services');
  const [reportReviewId, setReportReviewId] = useState<string | null>(null);
  const data = useBarberProfileData(barberId);
  const { barber, services, servicesError } = data;

  const reduceMotion = useReducedMotionPreference();
  // Parallax, on the UI thread: the photo drifts at 40% of scroll speed and,
  // on an iOS pull-down, scales up slightly. Reduce Motion keeps it fixed.
  const heroParallax = useAnimatedStyle(() => {
    if (reduceMotion) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.value;
    return {
      transform: [{ translateY: y > 0 ? y * 0.4 : 0 }, { scale: y < 0 ? 1 + -y / HERO_PARALLAX_HEIGHT : 1 }],
    };
  });

  const goBack = useCallback(() => navigation.goBack(), [navigation]);
  const onBook = useCallback(
    (service: ServiceRow) => {
      if (!barber) return;
      navigation.navigate('BookingDateTime', { barberId: barber.id, barberName: barber.name, barberImage: barber.profile_image, service });
    },
    [navigation, barber]
  );

  // Loading, error and not-found render without the hero, with a plain
  // header that keeps the back affordance and its testID.
  if (data.loading || data.error || data.notFound) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-profile-screen">
        <View style={styles.plainHeader}>
          <BackButton onPress={goBack} testID="barber-profile-back" tone="surface" />
        </View>
        {data.loading ? (
          <BarberProfileSkeleton />
        ) : data.error ? (
          <View testID="barber-profile-error" accessibilityRole="alert" style={[styles.notice, { borderColor: colors.error, backgroundColor: colors.surface }]}>
            <Text style={[styles.noticeText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>{data.error}</Text>
          </View>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontFamily: fonts.body }]} testID="barber-profile-not-found">
            {german ? 'Dieser Barber ist nicht mehr verfügbar.' : 'This barber is no longer available.'}
          </Text>
        )}
      </SafeAreaView>
    );
  }

  if (!barber) return null;

  const canBook = !servicesError && services.length > 0;
  const fromPrice = canBook ? Math.min(...services.map((service) => service.price)) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']} testID="barber-profile-screen">
      {/* Light status icons read best over photography; the no-image
          fallback keeps the global "auto". */}
      {barber.profile_image ? <StatusBar style="light" /> : null}
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} ref={scrollRef} contentContainerStyle={styles.scrollContent}>
        <ProfileHero barber={barber} topInset={insets.top} parallax={heroParallax} german={german} />
        <ProfileAbout barber={barber} chips={services.slice(0, 4).map((service) => service.name)} stats={data.stats} german={german} />
        <ProfileTabStrip tab={tab} onChange={setTab} onLayoutY={(y) => { servicesY.current = y; }} german={german} />
        <View style={styles.tabContent}>
          {tab === 'services' ? (
            <ServicesTab services={services} error={servicesError} german={german} onBook={onBook} />
          ) : tab === 'portfolio' ? (
            <PortfolioTab portfolio={data.portfolio} error={data.portfolioError} german={german} />
          ) : (
            <ReviewsTab
              barber={barber}
              reviews={data.reviews}
              firstNameByReviewId={data.firstNameByReviewId}
              error={data.reviewsError}
              german={german}
              onReport={setReportReviewId}
            />
          )}
        </View>
      </Animated.ScrollView>
      <ScrollGlassHeader title={barber.name} scrollY={scrollY} start={280} testID="barber-profile-glass-header" />

      {reportReviewId ? (
        <ReportSheet open target={{ type: 'review', reviewId: reportReviewId }} onClose={() => setReportReviewId(null)} testIDPrefix="barber-profile-review" />
      ) : null}

      {canBook && fromPrice !== null ? (
        <BookingDock
          fromPrice={fromPrice}
          bottomInset={insets.bottom}
          german={german}
          onChooseService={() => {
            setTab('services');
            scrollRef.current?.scrollTo({ y: servicesY.current, animated: false });
          }}
        />
      ) : null}
      <HeroButtons
        barber={barber}
        topInset={insets.top}
        favorite={data.favorite}
        german={german}
        onBack={goBack}
        onToggleFavorite={() => void data.toggleFavorite()}
      />
    </SafeAreaView>
  );
}

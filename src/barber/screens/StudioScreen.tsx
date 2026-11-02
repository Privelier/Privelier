/**
 * Barber Studio: greeting, verification, quick actions, performance, nightly
 * stats and the setup checklist. Data lives in useStudioData; the sections
 * are in components/studio.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { LegalLinks } from '../../legal/LegalComponents';
import { useExitRole } from '../../RoleContext';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { useFeatureFlag } from '../../shared/featureFlags';
import { getAppLanguage } from '../../shared/locale';
import { Reveal, ScrollGlassHeader, useScrollGlass } from '../../shared/motion';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { useTheme } from '../../theme/useTheme';
import { QuickActions } from '../components/QuickActions';
import { StatsInsightCard } from '../components/StatsInsightCard';
import { LookStatsCard } from '../components/looks/LookStatsCard';
import { StudioAnalytics } from '../components/studio/StudioAnalytics';
import { StudioHeader, StudioSkeleton } from '../components/studio/StudioParts';
import { StudioReadiness, VerificationLine } from '../components/studio/StudioReadiness';
import { studioStyles as styles } from '../components/studio/studioStyles';
import { useStudioData } from '../hooks/useStudioData';
import type { ReadinessItemKey } from '../types';
import type { BarberTabParamList } from '../BarberTabs';
import type { BarberStackParamList } from '../BarberNavigator';

type Props = CompositeScreenProps<
  BottomTabScreenProps<BarberTabParamList, 'Studio'>,
  NativeStackScreenProps<BarberStackParamList>
>;

export default function StudioScreen({ navigation }: Props) {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const { colors } = useTheme();
  const { scrollY, onScroll } = useScrollGlass();
  const onSignOut = useExitRole();
  const de = getAppLanguage() === 'de';
  const { name, view, loading, retrying, error, stats, retry } = useStudioData(de);
  const looksOn = useFeatureFlag('looks');

  const openReadinessTarget = useCallback(
    (key: ReadinessItemKey) => {
      switch (key) {
        case 'services': navigation.navigate('Services'); return;
        case 'availability': navigation.navigate('Availability'); return;
        case 'location': navigation.navigate('LocationEdit'); return;
        case 'portfolio': navigation.navigate('Portfolio'); return;
        case 'bio': navigation.navigate('BioEdit'); return;
        case 'verification': navigation.navigate('Verify'); return;
      }
    },
    [navigation]
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="barber-dashboard-screen">
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.scrollContent, { paddingBottom: tabClearance }]}>
        <StudioHeader
          name={name}
          showSkeleton={loading && !view}
          de={de}
          onNotifications={() => navigation.navigate('NotificationCenter')}
          onSettings={() => navigation.navigate('Settings')}
          onSignOut={onSignOut}
        />

        {loading && !view ? (
          <StudioSkeleton />
        ) : error && !view ? (
          <RetryNotice testID="barber-dashboard-error" message={error} onRetry={retry} style={styles.noticeMargins} />
        ) : view ? (
          <>
            <Reveal index={0}>
              <VerificationLine profile={view.profile} retrying={retrying} de={de} onOpen={() => navigation.navigate('Verify')} onRetry={retry} />
            </Reveal>

            <View style={styles.quickActions}>
              <QuickActions onOpen={openReadinessTarget} />
            </View>

            <Reveal index={1}>
              <StudioAnalytics analytics={view.analytics} retrying={retrying} de={de} onRetry={retry} onOpenRequests={() => navigation.navigate('Requests')} />
            </Reveal>

            {stats ? (
              <Reveal index={2} style={styles.insights}>
                <StatsInsightCard stats={stats} />
              </Reveal>
            ) : null}

            {looksOn ? (
              <Reveal index={3} style={styles.insights}>
                <LookStatsCard de={de} />
              </Reveal>
            ) : null}

            {view.readiness.isLive === true ? null : (
              <StudioReadiness readiness={view.readiness} retrying={retrying} de={de} onOpenItem={openReadinessTarget} onRetry={retry} />
            )}

            <LegalLinks includeAll testIDPrefix="barber-studio-legal" />
          </>
        ) : null}
      </Animated.ScrollView>
      <ScrollGlassHeader title="Studio" scrollY={scrollY} start={56} testID="barber-dashboard-glass-header" />
    </SafeAreaView>
  );
}

/**
 * Studio's building blocks: the header row, the eight-week value trend,
 * a metric cell, the per-section "could not load" notice and the skeleton.
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { NotificationBell } from '../../../shared/components/NotificationBell';
import { Skeleton } from '../../../shared/components/Skeleton';
import { firstName, formatMoney, timeOfDayGreeting } from '../../../shared/format';
import { AnimatedNumber } from '../../../shared/motion/AnimatedNumber';
import { pressOpacity } from '../../../theme/motion';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDashboardAnalytics } from '../../types';
import { studioStyles as styles } from './studioStyles';

export function StudioHeader({
  name,
  showSkeleton,
  de,
  onNotifications,
  onSettings,
  onSignOut,
}: {
  name: string | null;
  showSkeleton: boolean;
  de: boolean;
  onNotifications: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        {showSkeleton ? (
          <View style={styles.headerSkeleton}>
            <Skeleton style={styles.skeletonGreeting} />
            <Skeleton style={styles.skeletonName} />
          </View>
        ) : name ? (
          <>
            <Text style={[styles.greeting, { color: colors.textSecondary, fontFamily: fonts.body }]}>{timeOfDayGreeting()},</Text>
            <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{firstName(name)}.</Text>
          </>
        ) : (
          <Text style={[styles.name, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>Dashboard</Text>
        )}
      </View>
      <NotificationBell onPress={onNotifications} testID="barber-dashboard-notifications" />
      <Pressable
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel={de ? 'Einstellungen' : 'Settings'}
        hitSlop={6}
        testID="barber-dashboard-settings"
        style={({ pressed }) => [styles.settingsButton, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <Feather name="settings" size={20} color={colors.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel={de ? 'Abmelden' : 'Sign out'}
        testID="barber-dashboard-logout"
        style={({ pressed }) => [styles.signOut, { opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <Feather name="log-out" size={16} color={colors.textSecondary} />
        <Text style={[styles.signOutText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Abmelden' : 'Sign out'}</Text>
      </Pressable>
    </View>
  );
}

export function EarningsTrend({ data, width, de }: { data: BarberDashboardAnalytics['weeklyTrend']; width: number; de: boolean }) {
  const { colors, fonts } = useTheme();
  const height = 100;
  const values = data.map((point) => point.bookedValue);
  const max = Math.max(...values, 0);
  const coordinates = values.map((value, index) => ({
    x: data.length < 2 ? width / 2 : 8 + (index / (data.length - 1)) * (width - 16),
    y: max === 0 ? height - 12 : height - 12 - (value / max) * (height - 28),
  }));
  const path = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const label = [styles.chartLabel, { color: colors.textSecondary, fontFamily: fonts.body }];

  return (
    <View testID="barber-dashboard-earnings-trend" accessibilityLabel={max === 0 ? 'No completed booking value in the last eight weeks' : `Eight week trend, peak ${formatMoney(max)}`}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={0} y1={height - 12} x2={width} y2={height - 12} stroke={colors.border} strokeWidth={1} />
        {max > 0 ? (
          <>
            <Path d={path} stroke={colors.accent} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            {coordinates.map((point, index) => (
              <Circle key={index} cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 4 : 2.5} fill={colors.accent} />
            ))}
          </>
        ) : null}
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={label}>{data[0]?.weekStart.slice(5) ?? ''}</Text>
        <Text style={label}>{de ? '8 Wochen' : '8 weeks'}</Text>
        <Text style={label}>{de ? 'Jetzt' : 'Now'}</Text>
      </View>
    </View>
  );
}

export function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>{label}</Text>
      <AnimatedNumber value={value} style={[styles.metricValue, { color: colors.textPrimary }]} />
      <Text style={[styles.metricDetail, { color: colors.textSecondary, fontFamily: fonts.body }]}>{detail}</Text>
    </View>
  );
}

export function SectionUnavailable({
  label,
  testID,
  onRetry,
  retrying,
  de,
}: {
  label: string;
  testID: string;
  onRetry: () => void;
  retrying: boolean;
  de: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View style={styles.unavailable} testID={testID}>
      <Text accessibilityRole="alert" style={[styles.unavailableText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
        {de ? `${label} konnte nicht geladen werden.` : `${label} could not load.`}
      </Text>
      {retrying ? (
        <ActivityIndicator size="small" color={colors.accent} accessibilityLabel={de ? 'Studio wird aktualisiert' : 'Refreshing studio'} />
      ) : (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={de ? `${label} erneut laden` : `Retry ${label.toLowerCase()}`}
          testID={`${testID}-retry`}
          style={({ pressed }) => [styles.retryAction, { opacity: pressed ? pressOpacity.soft : 1 }]}
        >
          <Text style={[styles.retryText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Erneut versuchen' : 'Try again'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function StudioSkeleton() {
  const { colors } = useTheme();
  return (
    <View testID="barber-dashboard-loading" accessible accessibilityRole="progressbar" accessibilityLabel="Loading studio" style={styles.studioSkeleton}>
      <Skeleton style={styles.skeletonVerification} />
      <View style={[styles.skeletonAnalyticsCard, { borderColor: colors.border }]}>
        <Skeleton style={styles.skeletonAnalyticsLabel} />
        <Skeleton style={styles.skeletonAnalyticsValue} />
        <Skeleton style={styles.skeletonChart} />
      </View>
      <View style={styles.skeletonMetrics}>
        <Skeleton style={styles.skeletonMetric} />
        <Skeleton style={styles.skeletonMetric} />
      </View>
      <Skeleton style={styles.skeletonSectionTitle} />
      <Skeleton style={styles.skeletonSectionRow} />
    </View>
  );
}

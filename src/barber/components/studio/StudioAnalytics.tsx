/**
 * Studio performance: this month's booking value with an eight-week trend,
 * completed cuts, open requests, the next appointment, feedback, the
 * busiest day and top services. Values are completed booking prices; the app
 * processes no payments, and the card says so.
 */
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { formatBookingWhen, formatMoney } from '../../../shared/format';
import { AnimatedNumber } from '../../../shared/motion/AnimatedNumber';
import { pressOpacity } from '../../../theme/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDashboardAnalytics, DashboardView } from '../../types';
import { EarningsTrend, Metric, SectionUnavailable } from './StudioParts';
import { studioStyles as styles } from './studioStyles';

/** The analytics RPC names the busiest weekday in English. */
const GERMAN_WEEKDAYS: Record<string, string> = {
  Monday: 'Montag', Tuesday: 'Dienstag', Wednesday: 'Mittwoch', Thursday: 'Donnerstag',
  Friday: 'Freitag', Saturday: 'Samstag', Sunday: 'Sonntag',
};

export function StudioAnalytics({
  analytics,
  retrying,
  de,
  onRetry,
  onOpenRequests,
}: {
  analytics: DashboardView['analytics'];
  retrying: boolean;
  de: boolean;
  onRetry: () => void;
  onOpenRequests: () => void;
}) {
  const { colors, fonts } = useTheme();
  return (
    <GlassSurface testID="barber-dashboard-analytics" style={styles.analyticsCard}>
      {analytics.status === 'ok' ? (
        <AnalyticsBody data={analytics.data} de={de} onOpenRequests={onOpenRequests} />
      ) : (
        <>
          <View style={styles.analyticsHeading}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Studio-Leistung' : 'Studio performance'}</Text>
            <Feather name="activity" size={18} color={colors.accentText} />
          </View>
          <SectionUnavailable label={de ? 'Studio-Auswertung' : 'Studio analytics'} testID="barber-dashboard-overview-unavailable" onRetry={onRetry} retrying={retrying} de={de} />
        </>
      )}
    </GlassSurface>
  );
}

function AnalyticsBody({ data, de, onOpenRequests }: { data: BarberDashboardAnalytics; de: boolean; onOpenRequests: () => void }) {
  const { colors, fonts } = useTheme();
  const { width } = useWindowDimensions();
  const muted = { color: colors.textSecondary, fontFamily: fonts.body };
  const next = data.nextAppointment;
  const cuts = de ? 'abgeschlossene Schnitte' : 'completed cuts';
  return (
    <>
      <View style={styles.analyticsHeading}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Studio-Performance' : 'Studio performance'}</Text>
          <Text style={[styles.analyticsTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{de ? 'Deine Arbeit im Fokus' : 'Your work, in focus'}</Text>
        </View>
        <Feather name="activity" size={18} color={colors.accentText} />
      </View>

      <Text style={[styles.heroLabel, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Buchungswert in diesem Monat' : 'Booking value this month'}</Text>
      <AnimatedNumber value={data.bookedValueMonth} format={formatMoney} durationMs={900} style={[styles.heroValue, { color: colors.textPrimary }]} />
      <Text style={[styles.heroFootnote, muted]}>{de ? 'Preise abgeschlossener Termine. In der App werden keine Zahlungen verarbeitet.' : 'Completed booking prices. No payments are processed in the app.'}</Text>
      <View style={[styles.trendBlock, { borderTopColor: colors.border }]}>
        <View style={styles.trendHeading}>
          <Text style={[styles.trendTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Buchungswert' : 'Booked value'}</Text>
          <Text style={[styles.trendPeriod, muted]}>{de ? '8 Wochen' : '8 weeks'}</Text>
        </View>
        <EarningsTrend data={data.weeklyTrend} width={Math.max(180, width - 104)} de={de} />
        {data.completedAllTime === 0 ? (
          <Text style={[styles.emptyHint, muted]}>{de ? 'Dein erster abgeschlossener Termin startet diese Entwicklung.' : 'Your first completed booking will start this trend.'}</Text>
        ) : null}
      </View>

      <View style={[styles.metricRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
        <Metric label={de ? 'Diese Woche' : 'This week'} value={data.completedWeek} detail={cuts} />
        <Metric label={de ? 'Diesen Monat' : 'This month'} value={data.completedMonth} detail={cuts} />
        <Metric label={de ? 'Gesamt' : 'All time'} value={data.completedAllTime} detail={cuts} />
      </View>

      <Pressable
        onPress={onOpenRequests}
        accessibilityRole="button"
        accessibilityLabel={de ? `${data.pendingCount} offene Anfragen. Anfragen ansehen.` : `${data.pendingCount} pending requests. View requests.`}
        testID="barber-dashboard-overview"
        style={({ pressed }) => [styles.pendingBanner, { borderColor: colors.border, opacity: pressed ? pressOpacity.soft : 1 }]}
      >
        <View style={[styles.pendingBadge, { backgroundColor: data.pendingCount > 0 ? colors.accent : colors.background }]}>
          <Text style={[styles.pendingBadgeValue, numericText, { color: data.pendingCount > 0 ? colors.onAccent : colors.textSecondary }]}>{data.pendingCount}</Text>
        </View>
        <View style={styles.pendingCopy}>
          <Text style={[styles.pendingTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
            {data.pendingCount === 1 ? (de ? 'Offene Anfrage' : 'Open request') : (de ? 'Offene Anfragen' : 'Open requests')}
          </Text>
          <Text style={[styles.pendingHint, muted]}>
            {data.pendingCount > 0 ? (de ? 'Warten auf deine Antwort' : 'Waiting for your reply') : (de ? 'Alles erledigt' : 'You’re all caught up')}
          </Text>
        </View>
        <Feather name="arrow-up-right" size={17} color={colors.textSecondary} />
      </Pressable>

      <View style={[styles.appointmentCard, { backgroundColor: colors.background }]}>
        <View style={styles.appointmentTopline}>
          <Text style={[styles.eyebrow, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>{de ? 'Nächster Termin' : 'Next appointment'}</Text>
          <Text style={[styles.upcomingText, muted]}>{data.upcomingCount} {de ? 'in den nächsten 7 Tagen' : 'in the next 7 days'}</Text>
        </View>
        {next ? (
          <>
            <Text style={[styles.appointmentName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
              {next.customerName ?? next.serviceName ?? (de ? 'Bestätigter Termin' : 'Confirmed appointment')}
            </Text>
            <Text style={[styles.appointmentWhen, muted]}>
              {formatBookingWhen(next.date, next.time)}{next.customerName && next.serviceName ? ` · ${next.serviceName}` : ''}
            </Text>
          </>
        ) : (
          <Text style={[styles.emptyText, muted]}>{de ? 'Noch nichts geplant.' : 'Nothing scheduled yet.'}</Text>
        )}
      </View>

      <View style={styles.insightRow}>
        <View style={[styles.insightCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Kundenstimmen' : 'Client feedback'}</Text>
          {data.reviewCount > 0 && data.ratingAverage !== null ? (
            <>
              <Text testID="barber-dashboard-rating" style={[styles.insightValue, numericText, { color: colors.textPrimary }]}>
                {data.ratingAverage.toFixed(2)} <Text style={{ color: colors.accentText }}>★</Text>
              </Text>
              <Text style={[styles.insightCaption, muted]}>
                {de
                  ? `${data.reviewCount} ${data.reviewCount === 1 ? 'Bewertung' : 'Bewertungen'} · ${data.repeatCustomerCount} ${data.repeatCustomerCount === 1 ? 'Stammkunde' : 'Stammkunden'}`
                  : `${data.reviewCount} ${data.reviewCount === 1 ? 'review' : 'reviews'} · ${data.repeatCustomerCount} returning clients`}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>—</Text>
              <Text style={[styles.insightCaption, muted]}>
                {de
                  ? `${data.repeatCustomerCount} ${data.repeatCustomerCount === 1 ? 'Stammkunde' : 'Stammkunden'} · noch keine Bewertungen`
                  : `${data.repeatCustomerCount} returning clients · no reviews yet`}
              </Text>
            </>
          )}
        </View>
        <View style={[styles.insightCard, { backgroundColor: colors.background }]}>
          <Text style={[styles.eyebrow, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Beliebtester Tag' : 'Busiest day'}</Text>
          {data.busiestWeekday ? (
            <>
              <Text style={[styles.insightValue, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
                {de ? (GERMAN_WEEKDAYS[data.busiestWeekday.weekday] ?? data.busiestWeekday.weekday) : data.busiestWeekday.weekday}
              </Text>
              <Text style={[styles.insightCaption, muted]}>
                {data.busiestWeekday.completedCuts} {de ? (data.busiestWeekday.completedCuts === 1 ? 'abgeschlossener Schnitt' : 'abgeschlossene Schnitte') : 'completed cuts'}
              </Text>
            </>
          ) : (
            <Text style={[styles.insightCaption, muted]}>{de ? 'Erscheint nach deinem ersten abgeschlossenen Termin.' : 'Will appear after your first completed booking.'}</Text>
          )}
        </View>
      </View>

      <View style={[styles.serviceInsight, { borderTopColor: colors.border }]}>
        <View style={styles.trendHeading}>
          <Text style={[styles.trendTitle, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Beliebte Leistungen' : 'Top services'}</Text>
          <Text style={[styles.trendPeriod, muted]}>{de ? 'abgeschlossen' : 'completed'}</Text>
        </View>
        {data.topServices.length > 0 ? data.topServices.map((service, index) => (
          <View key={`${service.name}-${index}`} style={[styles.serviceRank, index > 0 ? { borderTopColor: colors.border, borderTopWidth: 0.5 } : null]}>
            <Text style={[styles.serviceRankNumber, numericText, { color: colors.accentText }]}>{String(index + 1).padStart(2, '0')}</Text>
            <Text numberOfLines={1} style={[styles.serviceRankName, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{service.name}</Text>
            <Text style={[styles.serviceRankCount, numericText, { color: colors.textSecondary }]}>{service.completedCuts} · {formatMoney(service.bookedValue)}</Text>
          </View>
        )) : (
          <Text style={[styles.emptyHint, muted]}>{de ? 'Deine erfolgreichsten Leistungen erscheinen hier.' : 'Your best-performing services will appear here.'}</Text>
        )}
      </View>
    </>
  );
}

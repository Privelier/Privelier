/**
 * The profile's Services / Portfolio / Reviews strip and each tab's body.
 * Services is the default tab, so Maestro's service assertions need no taps.
 * Every tab has its own loading-free error and empty state: the profile has
 * already loaded when these render.
 */
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PortfolioGrid } from '../../../shared/components/PortfolioGrid';
import { PortfolioTile } from '../../../shared/components/PortfolioTile';
import { StarRating } from '../../../shared/components/StarRating';
import { pressOpacity } from '../../../theme/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow, PortfolioRow, ReviewRow, ServiceRow } from '../../../types';
import { formatMoney, formatShortDate } from '../../format';
import { profileStyles as styles } from './profileStyles';

export type ProfileTab = 'services' | 'portfolio' | 'reviews';

const TAB_LABELS: Record<ProfileTab, { en: string; de: string }> = {
  services: { en: 'Services', de: 'Leistungen' },
  portfolio: { en: 'Portfolio', de: 'Portfolio' },
  reviews: { en: 'Reviews', de: 'Bewertungen' },
};

/** Count of each 5→1 star rating among loaded reviews, with its share. */
export function ratingDistribution(reviews: readonly { rating: number }[]): { stars: number; count: number; share: number }[] {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((review) => review.rating === stars).length;
    return { stars, count, share: total === 0 ? 0 : count / total };
  });
}

function reviewCountLabel(count: number, german: boolean): string {
  if (german) return count === 1 ? '1 Bewertung' : `${count} Bewertungen`;
  return count === 1 ? '1 review' : `${count} reviews`;
}

export function ProfileTabStrip({
  tab,
  onChange,
  onLayoutY,
  german,
}: {
  tab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
  onLayoutY: (y: number) => void;
  german: boolean;
}) {
  const { colors, fonts } = useTheme();
  return (
    <View onLayout={(event) => onLayoutY(event.nativeEvent.layout.y)} style={[styles.tabStrip, { borderBottomColor: colors.border }]}>
      {(Object.keys(TAB_LABELS) as ProfileTab[]).map((key) => {
        const active = tab === key;
        const label = TAB_LABELS[key][german ? 'de' : 'en'];
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            testID={`barber-profile-tab-${key}`}
            style={({ pressed }) => [
              styles.tabButton,
              active ? { borderBottomColor: colors.accent } : null,
              pressed ? { opacity: pressOpacity.soft } : null,
            ]}
          >
            <Text style={[styles.tabLabel, { fontFamily: fonts.bodyMedium, color: active ? colors.accentText : colors.textSecondary }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StateText({ text, tone, testID }: { text: string; tone: 'error' | 'muted'; testID?: string }) {
  const { colors, fonts } = useTheme();
  return (
    <Text
      style={[styles.stateText, { color: tone === 'error' ? colors.errorText : colors.textSecondary, fontFamily: fonts.body }]}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      testID={testID}
    >
      {text}
    </Text>
  );
}

export function ServicesTab({
  services,
  error,
  german,
  onBook,
}: {
  services: readonly ServiceRow[];
  error: string | null;
  german: boolean;
  onBook: (service: ServiceRow) => void;
}) {
  const { colors, fonts } = useTheme();
  if (error) return <StateText text={error} tone="error" testID="barber-profile-services-error" />;
  if (services.length === 0) {
    return (
      <StateText
        text={german ? 'Dieser Barber hat noch keine Leistungen hinzugefügt.' : 'This barber has not added any services yet.'}
        tone="muted"
        testID="barber-profile-services-empty"
      />
    );
  }
  return (
    <>
      {services.map((service, index) => (
        <View
          key={service.id}
          style={[styles.serviceRow, index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null]}
          testID={`barber-profile-service-${service.id}`}
        >
          <View style={styles.serviceInfo}>
            <Text style={[styles.serviceName, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>{service.name}</Text>
            <Text style={[styles.serviceMeta, numericText, { color: colors.textSecondary }]}>
              {`${service.duration_minutes} min · ${formatMoney(service.price)}`}
            </Text>
          </View>
          <Pressable
            onPress={() => onBook(service)}
            accessibilityRole="button"
            accessibilityLabel={`${german ? 'Buchen' : 'Book'} ${service.name}`}
            testID={`barber-profile-book-${service.id}`}
            style={({ pressed }) => [styles.bookButton, { backgroundColor: colors.accent, opacity: pressed ? pressOpacity.firm : 1 }]}
          >
            <Text style={[styles.bookButtonText, { color: colors.onAccent, fontFamily: fonts.bodyMedium }]}>
              {german ? 'Buchen' : 'Book'}
            </Text>
          </Pressable>
        </View>
      ))}
    </>
  );
}

export function PortfolioTab({ portfolio, error, german }: { portfolio: readonly PortfolioRow[]; error: string | null; german: boolean }) {
  const { colors, fonts } = useTheme();
  if (error) return <StateText text={error} tone="error" testID="barber-profile-portfolio-error" />;
  if (portfolio.length === 0) {
    return (
      <View style={styles.portfolioEmpty} testID="barber-profile-portfolio-placeholder">
        {/* Muted, never brass: an empty portfolio is a calm state, not a call
            to action on someone else's profile. */}
        <Feather name="image" size={22} color={colors.border} />
        <Text style={[styles.portfolioEmptyText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
          {german ? 'Noch keine Portfoliofotos.' : 'No portfolio to show yet.'}
        </Text>
      </View>
    );
  }
  return (
    <PortfolioGrid style={styles.portfolioGridSpacing}>
      {portfolio.map((img) => (
        <PortfolioTile key={img.id} imagePath={img.image_url} testID={`barber-profile-portfolio-image-${img.id}`} />
      ))}
    </PortfolioGrid>
  );
}

export function ReviewsTab({
  barber,
  reviews,
  firstNameByReviewId,
  error,
  german,
  onReport,
}: {
  barber: BarberDirectoryRow;
  reviews: readonly ReviewRow[];
  firstNameByReviewId: ReadonlyMap<string, string>;
  error: string | null;
  german: boolean;
  onReport: (reviewId: string) => void;
}) {
  const { colors, fonts } = useTheme();
  if (error) return <StateText text={error} tone="error" testID="barber-profile-reviews-error" />;
  if (reviews.length === 0) {
    return (
      <View testID="barber-profile-reviews-empty">
        <Text style={[styles.reviewsRating, styles.reviewsRatingEmpty, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
          {german ? 'Neu' : 'New'}
        </Text>
        {/* A muted 5-outline row so the empty and populated states share a
            silhouette: "scale awaiting ratings", not "zero". */}
        <StarRating rating={0} size={16} style={styles.reviewsEmptyStars} />
        <StateText text={german ? 'Bewertungen erscheinen nach den ersten abgeschlossenen Terminen.' : 'Reviews arrive after the first completed bookings.'} tone="muted" />
      </View>
    );
  }
  const distribution = ratingDistribution(reviews);
  return (
    <View testID="barber-profile-reviews-list">
      {/* The average is barber_profile.rating (server-owned), announced once
          through the accessible container. */}
      <View
        style={[styles.reviewsSummary, { borderBottomColor: colors.border }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${barber.rating.toFixed(1)} ${german ? 'von 5' : 'out of 5'}, ${reviewCountLabel(reviews.length, german)}`}
      >
        <Text style={[styles.reviewsRating, numericText, { color: colors.textPrimary }]}>{barber.rating.toFixed(1)}</Text>
        <View style={styles.reviewsSummaryMeta}>
          <StarRating rating={barber.rating} size={16} emptyColor={colors.textSecondary} />
          <Text style={[styles.reviewsCount, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {reviewCountLabel(reviews.length, german)}
          </Text>
        </View>
      </View>

      {/* Built from every loaded review row, so each bar is a real count. */}
      <View
        style={styles.distribution}
        accessible
        accessibilityLabel={distribution.map(({ stars, count }) => `${stars} ${german ? 'Sterne' : 'stars'}: ${count}`).join(', ')}
        testID="barber-profile-rating-distribution"
      >
        {distribution.map(({ stars, count, share }) => (
          <View key={stars} style={styles.distributionRow}>
            <Text style={[styles.distributionLabel, numericText, { color: colors.textSecondary }]}>{stars}</Text>
            <View style={[styles.distributionTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.distributionFill, { width: `${Math.round(share * 100)}%`, backgroundColor: colors.accent }]} />
            </View>
            <Text style={[styles.distributionCount, numericText, { color: colors.textSecondary }]}>{count}</Text>
          </View>
        ))}
      </View>

      {reviews.map((review, index) => {
        const name = firstNameByReviewId.get(review.id);
        return (
          <View
            key={review.id}
            style={[styles.reviewRow, index > 0 ? { borderTopWidth: 0.5, borderTopColor: colors.border } : null]}
            testID={`barber-profile-review-${review.id}`}
          >
            <View style={styles.reviewHead}>
              <Text numberOfLines={1} style={[styles.reviewName, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>
                {name ?? (german ? 'Verifizierter Termin' : 'Verified booking')}
              </Text>
              <Text style={[styles.reviewDate, { color: colors.textSecondary, fontFamily: fonts.body }]}>{formatShortDate(review.created_at)}</Text>
              {review.comment ? (
                <Pressable
                  onPress={() => onReport(review.id)}
                  accessibilityRole="button"
                  accessibilityLabel={german ? 'Bewertung melden' : 'Report review'}
                  hitSlop={12}
                  testID={`barber-profile-review-report-${review.id}`}
                  style={styles.reviewReport}
                >
                  <Feather name="flag" size={13} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            {name ? (
              <Text style={[styles.reviewVerified, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {german ? 'Verifizierter Termin' : 'Verified booking'}
              </Text>
            ) : null}
            <StarRating rating={review.rating} size={14} style={styles.reviewStars} />
            {review.comment ? (
              <Text style={[styles.reviewComment, { color: colors.textPrimary, fontFamily: fonts.body }]}>{review.comment}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Review submission (build-order step 18) — reached from a completed booking's
 * Past card on the Bookings tab.
 *
 * The customer picks a 1–5 star rating (required) and an optional comment, then
 * posts it via submitReview, which inserts into `public.reviews` ONLY. The
 * barber attribution and completed-booking check are enforced server-side by
 * the hardened `reviews_insert_own_customer` RLS (migration 0022) — barberId is
 * carried here purely for the summary and the write, never trusted as the
 * authorization.
 *
 * submitReview's three-arm result is handled distinctly:
 * - 'ok': brief success state, then back to the Bookings tab. Its focus effect
 *   re-fetches the reviewed-booking ids, so the card flips "Leave a review" →
 *   "Reviewed" without any manual refresh.
 * - 'already_reviewed': the reviews.booking_id UNIQUE index rejected a second
 *   review (reachable on a retry, or if another device already posted one).
 *   Shown inline as a calm terminal state — the booking is already reviewed, so
 *   the only action is to go back.
 * - a generic CustomerDataFailure: its own `.message` is shown inline; the RLS
 *   rejection of a forged attribution lands here as 'forbidden'.
 *
 * Maestro contract: customer-review-submit-screen / -back / -stars /
 * -stars-star-{1..5} / -comment / -submit / -error / -success.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StarRatingInput } from '../../shared/components/StarRatingInput';
import { PrimaryButton } from '../../shared/components/PrimaryButton';
import { Notice } from '../../shared/components/Notice';
import { ScreenBackHeader } from '../../shared/components/ScreenBackHeader';
import { useTheme } from '../../theme/useTheme';
import { space } from '../../theme/spacing';
import { submitReview } from '../reviewsData';
import { customerDataErrorCopy } from '../errors';
import type { CustomerStackParamList } from '../CustomerNavigator';

type Props = NativeStackScreenProps<CustomerStackParamList, 'ReviewSubmit'>;

// Soft UI cap on the optional comment. There is no DB CHECK on reviews.comment,
// so this is a UX limit only (not a DB-coupled constant like MAX_MESSAGE_LENGTH).
const MAX_COMMENT_LENGTH = 500;

// Matches BookingConfirmScreen's brief-success pause.
const SUCCESS_PAUSE_MS = 700;

export default function ReviewSubmitScreen({ route, navigation }: Props) {
  const { bookingId, barberId, barberName, serviceName } = route.params;
  const { colors, fonts, isDark } = useTheme();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 'error' = a genuine failure (red, role=alert); 'info' = a benign terminal
  // state such as already-reviewed (neutral, no alarm).
  const [noticeTone, setNoticeTone] = useState<'error' | 'info'>('error');
  const [success, setSuccess] = useState(false);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
    },
    []
  );

  const onSubmit = useCallback(async () => {
    if (rating < 1) return; // the button is gated, but guard the write too
    setSubmitting(true);
    setError(null);
    setNoticeTone('error');

    const result = await submitReview({ bookingId, barberId, rating, comment });
    setSubmitting(false);

    if (result.status === 'ok') {
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => navigation.goBack(), SUCCESS_PAUSE_MS);
      return;
    }
    if (result.status === 'already_reviewed') {
      // Benign terminal state — this booking already has a review (e.g. posted
      // from another device). Show it calmly, not as a red failure.
      setNoticeTone('info');
      setError(customerDataErrorCopy.already_reviewed);
      return;
    }
    setError(result.message);
  }, [rating, comment, bookingId, barberId, navigation]);

  if (success) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top', 'left', 'right']}
        testID="customer-review-submit-screen"
      >
        <View style={styles.successWrap} testID="customer-review-submit-success">
          <View style={[styles.successIconRing, { backgroundColor: colors.surface }]}>
            <Feather name="check-circle" size={36} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            Review posted
          </Text>
          <Text style={[styles.successHint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {`Thanks for reviewing ${barberName}.`}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
      testID="customer-review-submit-screen"
    >
      <ScreenBackHeader
        onPress={() => navigation.goBack()}
        backTestID="customer-review-submit-back"
        backDisabled={submitting}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
            Leave a review
          </Text>
          <Text style={[styles.subheading, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {`How was ${serviceName} with ${barberName}?`}
          </Text>

          {error ? (
            <Notice
              message={error}
              testID="customer-review-submit-error"
              variant={noticeTone}
              style={styles.noticeSpacing}
            />
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
            Your rating
          </Text>
          <StarRatingInput
            value={rating}
            onChange={setRating}
            disabled={submitting}
            testID="customer-review-submit-stars"
          />
          {rating === 0 ? (
            <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.body }]}>
              Tap a star to rate — required to post.
            </Text>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>
            Comment (optional)
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            editable={!submitting}
            multiline
            maxLength={MAX_COMMENT_LENGTH}
            placeholder="Share a little about your experience"
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.accent}
            cursorColor={colors.accent}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            testID="customer-review-submit-comment"
            style={[
              styles.commentInput,
              {
                color: colors.textPrimary,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                fontFamily: fonts.body,
              },
            ]}
          />
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <PrimaryButton
            label="Post review"
            onPress={onSubmit}
            loading={submitting}
            disabled={rating === 0}
            testID="customer-review-submit-submit"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  heading: { fontSize: 24 },
  subheading: { fontSize: 14, marginTop: 8, lineHeight: 20 },

  noticeSpacing: { marginTop: space.lg },

  label: { fontSize: 13, marginTop: 28, marginBottom: 12 },
  hint: { fontSize: 12, marginTop: 10, lineHeight: 16 },

  commentInput: {
    borderWidth: 0.5,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
  },

  footer: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20, borderTopWidth: 0.5 },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  successIconRing: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 22, marginTop: 4 },
  successHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

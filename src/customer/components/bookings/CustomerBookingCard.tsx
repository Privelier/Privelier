/**
 * One booking in the customer's list, and the actions shown in its details
 * sheet. The card opens the sheet; the sheet's actions depend on the status:
 * cancel while pending or accepted, review once completed, message the
 * barber unless the booking was declined or cancelled, book again, follow a
 * live trip, and the calendar and directions tools.
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AcceptedBookingTools } from '../../../shared/components/AcceptedBookingTools';
import { Avatar } from '../../../shared/components/Avatar';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { StatusPill } from '../../../shared/components/StatusPill';
import { Reveal } from '../../../shared/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BarberDirectoryRow, BookingRow, ServiceRow } from '../../../types';
import { formatBookingWhen, formatMoney } from '../../format';
import { TrackLiveButton } from '../LiveTripEntry';
import { bookingsStyles as styles } from './bookingsStyles';

export function CustomerBookingCard({
  item,
  index,
  barber,
  service,
  cancellationQueued,
  rowError,
  de,
  onOpen,
}: {
  item: BookingRow;
  index: number;
  barber: BarberDirectoryRow | undefined;
  service: ServiceRow | undefined;
  cancellationQueued: boolean;
  rowError: string | undefined;
  de: boolean;
  onOpen: () => void;
}) {
  const { colors, fonts } = useTheme();
  const when = formatBookingWhen(item.date, item.time);
  return (
    <Reveal index={Math.min(index, 5)}>
      <GlassSurface style={styles.card} testID={`customer-bookings-row-${item.id}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${de ? 'Termindetails' : 'Appointment details'}, ${barber?.name ?? 'Barber'}, ${when}`}
          testID={`customer-bookings-open-${item.id}`}
          onPress={onOpen}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View style={styles.cardMain}>
            <Avatar
              id={barber?.id ?? item.barber_id ?? item.id}
              name={barber?.name}
              imageUrl={barber?.profile_image}
              size={56}
              accessible={false}
              testID={`customer-bookings-avatar-${item.id}`}
            />
            <View style={styles.cardInfo}>
              <View style={styles.cardTitleRow}>
                <Text numberOfLines={1} style={[styles.cardName, { color: colors.textPrimary, fontFamily: fonts.bodySemiBold }]}>
                  {barber?.name ?? 'Barber'}
                </Text>
                <StatusPill status={item.status} testID={`customer-bookings-status-${item.id}`} />
              </View>
              <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                {service?.name ?? (de ? 'Leistung' : 'Service')}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary, fontFamily: fonts.body }]}>{when}</Text>
            </View>
            <Text style={[styles.cardPrice, numericText, { color: colors.textPrimary }]}>{formatMoney(item.price)}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.cardLocation, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {item.location}
          </Text>
          <View style={styles.cardDetailsRow}>
            <Text style={[styles.cardDetailsText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
              {de ? 'Details ansehen' : 'View details'}
            </Text>
            <Feather name="arrow-up-right" size={16} color={colors.accentText} />
          </View>
        </Pressable>

        {cancellationQueued ? (
          <Text testID={`customer-bookings-row-undo-window-${item.id}`} style={[styles.reviewedText, { color: colors.textSecondary, fontFamily: fonts.body }]}>
            {de ? 'Stornierung vorgemerkt' : 'Cancellation pending'}
          </Text>
        ) : null}
        {rowError ? (
          <View style={[styles.rowError, { borderTopColor: colors.border }]} accessibilityRole="alert" testID={`customer-bookings-row-error-${item.id}`}>
            <Text style={[styles.rowErrorText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>{rowError}</Text>
          </View>
        ) : null}
      </GlassSurface>
    </Reveal>
  );
}

export function CustomerBookingActions({
  item,
  barber,
  service,
  busy,
  cancellationQueued,
  reviewed,
  openingChat,
  rowError,
  de,
  onCancel,
  onReview,
  onMessage,
  onRebook,
  onTrack,
}: {
  item: BookingRow;
  barber: BarberDirectoryRow | undefined;
  service: ServiceRow | undefined;
  busy: boolean;
  cancellationQueued: boolean;
  reviewed: boolean;
  openingChat: boolean;
  rowError: string | undefined;
  de: boolean;
  onCancel: () => void;
  onReview: () => void;
  onMessage: () => void;
  /** Absent when the barber is no longer in the directory. */
  onRebook: (() => void) | null;
  onTrack: () => void;
}) {
  const { colors, fonts } = useTheme();
  const actionable = item.status === 'pending' || item.status === 'accepted';
  let primary = null;
  if (actionable) {
    primary = cancellationQueued ? (
      <Text
        testID={`customer-bookings-row-undo-window-${item.id}`}
        accessibilityLiveRegion="polite"
        style={[styles.reviewedText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}
      >
        {de ? 'Stornierung vorgemerkt · unten rückgängig machen' : 'Cancellation pending · Undo below'}
      </Text>
    ) : busy ? (
      <ActivityIndicator
        size="small"
        color={colors.accent}
        style={styles.cardSpinner}
        testID={`customer-bookings-row-busy-${item.id}`}
        accessible
        accessibilityLabel={de ? 'Termin wird storniert' : 'Cancelling booking'}
        accessibilityLiveRegion="polite"
      />
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de ? 'Termin stornieren' : 'Cancel booking'}
        testID={`booking-cancel-${item.id}`}
        onPress={onCancel}
        style={({ pressed }) => [styles.cancelButton, { borderColor: colors.error }, pressed ? styles.cancelPressed : null]}
      >
        <Text style={[styles.cancelText, { color: colors.errorText, fontFamily: fonts.bodyMedium }]}>
          {de ? 'Termin stornieren' : 'Cancel booking'}
        </Text>
      </Pressable>
    );
  } else if (item.status === 'completed') {
    primary = reviewed ? (
      <View style={styles.reviewedRow} testID={`customer-bookings-reviewed-${item.id}`}>
        <Feather name="check" size={13} color={colors.textSecondary} />
        <Text style={[styles.reviewedText, { color: colors.textSecondary, fontFamily: fonts.bodyMedium }]}>{de ? 'Bewertet' : 'Reviewed'}</Text>
      </View>
    ) : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={de ? 'Bewertung schreiben' : 'Leave a review'}
        testID={`booking-review-${item.id}`}
        onPress={onReview}
        style={({ pressed }) => [styles.reviewButton, { borderColor: colors.accent }, pressed ? styles.reviewPressed : null]}
      >
        <Text style={[styles.reviewText, { color: colors.accentText, fontFamily: fonts.bodyMedium }]}>
          {de ? 'Bewertung schreiben' : 'Leave a review'}
        </Text>
      </Pressable>
    );
  }

  return (
    <>
      {primary}
      {item.status !== 'rejected' && item.status !== 'cancelled' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de ? 'Barber schreiben' : 'Message barber'}
          accessibilityState={{ busy: openingChat, disabled: openingChat }}
          disabled={openingChat}
          testID={`booking-message-${item.id}`}
          onPress={onMessage}
          style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed ? styles.reviewPressed : null]}
        >
          {openingChat ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <>
              <Feather name="message-circle" size={16} color={colors.textPrimary} />
              <Text style={[styles.reviewText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Barber schreiben' : 'Message barber'}</Text>
            </>
          )}
        </Pressable>
      ) : null}
      {!actionable && onRebook ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={de ? 'Erneut buchen' : 'Book again'}
          testID={`booking-rebook-${item.id}`}
          onPress={onRebook}
          style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed ? styles.reviewPressed : null]}
        >
          <Feather name="repeat" size={16} color={colors.textPrimary} />
          <Text style={[styles.reviewText, { color: colors.textPrimary, fontFamily: fonts.bodyMedium }]}>{de ? 'Erneut buchen' : 'Book again'}</Text>
        </Pressable>
      ) : null}
      {item.status === 'accepted' ? <TrackLiveButton bookingId={item.id} barberName={barber?.name ?? 'Barber'} onOpen={onTrack} /> : null}
      <AcceptedBookingTools
        booking={item}
        calendarTitle={`${service?.name ?? (de ? 'Termin' : 'Appointment')} · ${barber?.name ?? 'Privelier'}`}
        testIDPrefix={`booking-tools-${item.id}`}
      />
      {rowError ? <Text accessibilityRole="alert" style={[styles.actionError, { color: colors.errorText }]}>{rowError}</Text> : null}
    </>
  );
}

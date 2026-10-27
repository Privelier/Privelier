/**
 * Customer Bookings tab: Upcoming / Past, live status updates, cancellation
 * with undo, reviews, chat, live trips and rebooking. Data, realtime and
 * cancellation live in useCustomerBookings; the card and its actions are in
 * components/bookings.
 */
import { listPerformance } from '../../shared/listPerformance';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/useTheme';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { BookingDetails } from '../../shared/components/BookingDetails';
import { getAppLanguage } from '../../shared/locale';
import { BookingListSkeleton } from '../../shared/components/BookingListSkeleton';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { useToast } from '../../shared/components/ToastProvider';
import { GlassSegmentedControl } from '../../shared/components/GlassSegmentedControl';
import { EmptyState } from '../../shared/components/EmptyState';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { byId } from '../../shared/lookup';
import type { BookingRow } from '../../types';
import { isUpcomingBooking } from '../bookingsData';
import { fetchRoomForBooking } from '../inboxData';
import { CustomerBookingActions, CustomerBookingCard } from '../components/bookings/CustomerBookingCard';
import { bookingsStyles as styles } from '../components/bookings/bookingsStyles';
import { LiveTripBanner } from '../components/LiveTripEntry';
import { useCustomerBookings } from '../hooks/useCustomerBookings';
import { formatBookingWhen } from '../format';
import type { CustomerStackParamList } from '../CustomerNavigator';

type TabKey = 'upcoming' | 'past';
const DAY_MS = 24 * 60 * 60 * 1000;

export default function BookingsScreen() {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const { colors, fonts } = useTheme();
  const de = getAppLanguage() === 'de';
  const { showToast } = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmingBooking, setConfirmingBooking] = useState<BookingRow | null>(null);
  const data = useCustomerBookings(de);
  const { bookings, barbersById, servicesById, loading, error, load } = data;

  const list = useMemo(() => {
    const now = new Date();
    const upcoming = tab === 'upcoming';
    const filtered = bookings.filter((b) => isUpcomingBooking(b, now) === upcoming);
    // Past shows newest first (fetch order); Upcoming reads soonest first.
    return upcoming ? [...filtered].reverse() : filtered;
  }, [bookings, tab]);

  // Accepted bookings close enough to now that the barber can be on the way
  // (the server allows trips within a day of the appointment).
  const liveCandidates = useMemo(() => {
    const now = new Date().getTime();
    return bookings
      .filter((b) => b.status === 'accepted' && Math.abs(Date.parse(`${b.date}T${b.time}`) - now) <= DAY_MS)
      .slice(0, 2);
  }, [bookings]);

  const leaveReview = useCallback((row: BookingRow) => {
    // The barber deleted their account: there is nobody left to review.
    if (!row.barber_id) return;
    navigation.navigate('ReviewSubmit', {
      bookingId: row.id,
      barberId: row.barber_id,
      barberName: byId(barbersById, row.barber_id)?.name ?? 'your barber',
      serviceName: byId(servicesById, row.service_id)?.name ?? 'your appointment',
    });
  }, [navigation, barbersById, servicesById]);

  const openLiveTrip = useCallback((item: BookingRow) => {
    if (!item.barber_id) return;
    setSelectedId(null);
    const barber = byId(barbersById, item.barber_id);
    navigation.navigate('LiveTrip', {
      bookingId: item.id,
      context: {
        bookingId: item.id,
        barberId: item.barber_id,
        barberName: barber?.name ?? 'Barber',
        barberImage: barber?.profile_image ?? null,
        address: item.location,
        whenText: formatBookingWhen(item.date, item.time),
        serviceName: byId(servicesById, item.service_id)?.name ?? null,
      },
    });
  }, [barbersById, servicesById, navigation]);

  // The room already exists (created with the booking); this only resolves
  // it. A synchronous ref stops a double tap from opening two conversations.
  const openingChatRef = useRef(false);
  const [openingChat, setOpeningChat] = useState(false);
  const messageBarber = useCallback(async (row: BookingRow) => {
    if (openingChatRef.current) return;
    openingChatRef.current = true;
    setOpeningChat(true);
    const result = await fetchRoomForBooking(row.id);
    openingChatRef.current = false;
    setOpeningChat(false);
    if (result.status !== 'ok' || !result.room) {
      showToast({
        message: result.status === 'ok'
          ? de ? 'Der Chat zu diesem Termin ist nicht verfügbar.' : 'The chat for this appointment is not available.'
          : result.message,
      });
      return;
    }
    const barber = byId(barbersById, row.barber_id);
    const service = byId(servicesById, row.service_id);
    setSelectedId(null);
    navigation.navigate('Conversation', {
      room: result.room,
      title: barber?.name ?? 'Barber',
      subtitle: [service?.name, formatBookingWhen(row.date, row.time)].filter(Boolean).join(' · ') || null,
      counterpart: barber ? { id: barber.id, name: barber.name, profile_image: barber.profile_image } : null,
    });
  }, [barbersById, servicesById, navigation, showToast, de]);

  const selected = bookings.find((row) => row.id === selectedId);
  const showSkeleton = loading && bookings.length === 0;
  const showError = error !== null && bookings.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']} testID="customer-bookings-screen">
      <Text style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.headingMedium }]}>
        {de ? 'Deine Termine' : 'Your appointments'}
      </Text>

      <GlassSegmentedControl
        style={styles.tabStrip}
        value={tab}
        onChange={setTab}
        segments={[
          { key: 'upcoming' as const, label: de ? 'Demnächst' : 'Upcoming', testID: 'customer-bookings-tab-upcoming' },
          { key: 'past' as const, label: de ? 'Vergangene' : 'Past', testID: 'customer-bookings-tab-past' },
        ]}
      />

      {showSkeleton ? (
        <BookingListSkeleton testID="customer-bookings-loading" avatarSize={56} />
      ) : showError ? (
        <RetryNotice testID="customer-bookings-error" message={error ?? ''} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : (
        <>
          {error ? <RetryNotice testID="customer-bookings-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} /> : null}
          <FlatList
            {...listPerformance}
            testID="customer-bookings-list"
            data={list}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={loading && bookings.length > 0}
                onRefresh={() => void load()}
                progressViewOffset={12}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: tabClearance }]}
            ListHeaderComponent={liveCandidates.length > 0 ? (
              <>
                {liveCandidates.map((item) => (
                  <LiveTripBanner
                    key={item.id}
                    bookingId={item.id}
                    barberName={byId(barbersById, item.barber_id)?.name ?? 'Barber'}
                    onOpen={() => openLiveTrip(item)}
                  />
                ))}
              </>
            ) : undefined}
            ListEmptyComponent={
              <EmptyState
                icon={tab === 'upcoming' ? 'calendar' : 'clock'}
                testID="customer-bookings-empty"
                title={tab === 'upcoming'
                  ? (de ? 'Noch keine anstehenden Termine.' : 'No upcoming appointments yet.')
                  : (de ? 'Noch keine vergangenen Termine.' : 'No past appointments yet.')}
                body={tab === 'upcoming'
                  ? (de ? 'Wähle einen Barber und eine Zeit – er kommt zu dir.' : 'Pick a barber and a time, and they come to you.')
                  : (de ? 'Abgeschlossene Termine erscheinen hier.' : 'Finished appointments appear here.')}
                action={tab === 'upcoming' ? {
                  label: de ? 'Barber finden' : 'Find a barber',
                  onPress: () => navigation.navigate('CustomerTabs', { screen: 'Discover' }),
                  testID: 'customer-bookings-empty-discover',
                } : undefined}
              />
            }
            renderItem={({ item, index }) => (
              <CustomerBookingCard
                item={item}
                index={index}
                barber={byId(barbersById, item.barber_id)}
                service={byId(servicesById, item.service_id)}
                cancellationQueued={data.queued[item.id] === true}
                rowError={data.rowErrors[item.id]}
                de={de}
                onOpen={() => setSelectedId(item.id)}
              />
            )}
          />
        </>
      )}
      {selected ? (
        <BookingDetails
          booking={selected}
          role="customer"
          person={byId(barbersById, selected.barber_id)?.name ?? 'Barber'}
          service={byId(servicesById, selected.service_id)?.name ?? (de ? 'Termin' : 'Appointment')}
          onClose={() => setSelectedId(null)}
        >
          <CustomerBookingActions
            item={selected}
            barber={byId(barbersById, selected.barber_id)}
            service={byId(servicesById, selected.service_id)}
            busy={data.inFlight[selected.id] === true}
            cancellationQueued={data.queued[selected.id] === true}
            reviewed={data.reviewedBookingIds.has(selected.id)}
            openingChat={openingChat}
            rowError={data.rowErrors[selected.id]}
            de={de}
            onCancel={() => { setSelectedId(null); setConfirmingBooking(selected); }}
            onReview={() => { setSelectedId(null); leaveReview(selected); }}
            onMessage={() => void messageBarber(selected)}
            onRebook={selected.barber_id && barbersById.has(selected.barber_id)
              ? () => { if (!selected.barber_id) return; setSelectedId(null); navigation.navigate('BarberProfile', { barberId: selected.barber_id }); }
              : null}
            onTrack={() => openLiveTrip(selected)}
          />
        </BookingDetails>
      ) : null}
      <ConfirmSheet
        open={confirmingBooking !== null}
        title={de ? 'Diesen Termin stornieren?' : 'Cancel this booking?'}
        message={de ? 'Du kannst es 5 Sekunden lang rückgängig machen.' : 'You can undo for 5 seconds.'}
        cancelLabel={de ? 'Termin behalten' : 'Keep booking'}
        confirmLabel={de ? 'Termin stornieren' : 'Cancel booking'}
        destructive
        testID="customer-bookings-cancel-sheet"
        onClose={() => setConfirmingBooking(null)}
        onConfirm={() => {
          const row = confirmingBooking;
          setConfirmingBooking(null);
          if (row) data.queueCancellation(row);
        }}
      />
    </SafeAreaView>
  );
}

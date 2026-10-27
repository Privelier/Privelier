/**
 * Barber Requests tab: requests grouped as Needs action / Today / Upcoming /
 * History, with live status and accept, reject, complete and cancel. Data,
 * realtime and transitions live in useBarberRequests; grouping rules in
 * requestPresentation; the card and its actions in components/requests.
 */
import { useMemo, useState } from 'react';
import { RefreshControl, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookingDetails } from '../../shared/components/BookingDetails';
import { BookingListSkeleton } from '../../shared/components/BookingListSkeleton';
import { ConfirmSheet } from '../../shared/components/ConfirmSheet';
import { EmptyState } from '../../shared/components/EmptyState';
import { LoadOlderBookings } from '../../shared/components/LoadOlderBookings';
import { RetryNotice } from '../../shared/components/RetryNotice';
import { getAppLanguage } from '../../shared/locale';
import { byId } from '../../shared/lookup';
import { CelebrationOverlay } from '../../shared/motion/CelebrationOverlay';
import { useTabBarClearance } from '../../shared/navigation/tabBarClearance';
import { useTheme } from '../../theme/useTheme';
import type { BookingRow } from '../../types';
import { HistoryToggle, RequestActions, RequestCard, SectionHeader } from '../components/requests/RequestCard';
import { useRequestsStyles } from '../components/requests/requestsStyles';
import { useBarberRequests } from '../hooks/useBarberRequests';
import { buildRequestSections, isHistory, localDateKey, type RequestSection } from '../requestPresentation';
import { acceptBooking, cancelBookingAsBarber, completeBooking, rejectBooking } from '../requestsData';
import type { BarberStackParamList } from '../BarberNavigator';

type Confirmation = { title: string; label: string; action: () => void };

export default function RequestsScreen() {
  // Scroll the last row clear of the floating glass tab bar.
  const tabClearance = useTabBarClearance(32);
  const { colors } = useTheme();
  const styles = useRequestsStyles(colors);
  const de = getAppLanguage() === 'de';
  const navigation = useNavigation<NativeStackNavigationProp<BarberStackParamList>>();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const data = useBarberRequests(de);
  const { bookings, servicesById, counterpartsById, loading, error, load, runTransition } = data;

  const today = localDateKey(new Date());
  const sections = useMemo(() => buildRequestSections(bookings, today), [bookings, today]);
  const historyCount = bookings.filter(isHistory).length;
  const selected = bookings.find((row) => row.id === selectedId);
  const serviceNameOf = (row: BookingRow) => byId(servicesById, row.service_id)?.name ?? (de ? 'Termin' : 'Appointment');
  const customerNameOf = (row: BookingRow) => counterpartsById.get(row.id)?.name ?? (de ? 'Kunde' : 'Customer');

  // Reject and Cancel cannot be undone, so they are confirmed first.
  const confirmDestructive = (title: string, label: string, action: () => void) => {
    setSelectedId(null);
    setConfirmation({ title, label, action });
  };

  const showSkeleton = loading && bookings.length === 0;
  const showError = error !== null && bookings.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} testID="barber-requests-screen">
      <View style={styles.header}>
        <Text style={styles.heading}>{de ? 'Deine Anfragen' : 'Your requests'}</Text>
        <Text style={styles.subtitle}>{de ? 'Terminanfragen deiner Kunden.' : 'Booking requests from your clients.'}</Text>
      </View>

      {showSkeleton ? (
        <BookingListSkeleton testID="barber-requests-loading" avatarSize={44} />
      ) : showError ? (
        <RetryNotice testID="barber-requests-error" message={error ?? ''} onRetry={() => void load()} style={styles.noticeMargins} />
      ) : (
        <>
          {error ? <RetryNotice testID="barber-requests-error" message={error} onRetry={() => void load()} style={styles.noticeMargins} /> : null}
          <SectionList<BookingRow, RequestSection>
            testID="barber-requests-list"
            sections={sections}
            extraData={historyExpanded}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => section.key === 'history' ? (
              <HistoryToggle styles={styles} count={historyCount} expanded={historyExpanded} de={de} onToggle={() => setHistoryExpanded((expanded) => !expanded)} />
            ) : (
              <SectionHeader styles={styles} sectionKey={section.key} title={section.title} count={section.data.length} />
            )}
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
            // Older pages only ever hold history, so the control sits under it.
            ListFooterComponent={data.hasOlder && (historyExpanded || historyCount === 0) ? (
              <LoadOlderBookings
                loading={data.loadingOlder}
                error={data.olderError}
                onPress={() => void data.loadOlder()}
                testID="barber-requests-load-older"
              />
            ) : undefined}
            ListEmptyComponent={bookings.length === 0 ? (
              <EmptyState
                icon="inbox"
                testID="barber-requests-empty"
                title={de ? 'Noch keine Terminanfragen.' : 'No booking requests yet.'}
                body={de ? 'Anfragen erscheinen hier, sobald ein Kunde dich bucht.' : 'Requests appear here the moment a client books you.'}
              />
            ) : undefined}
            renderItem={({ item, index, section }) => section.key === 'history' && !historyExpanded ? null : (
              <RequestCard
                styles={styles}
                item={item}
                index={index}
                service={byId(servicesById, item.service_id)}
                counterpart={counterpartsById.get(item.id)}
                rowError={data.rowErrors[item.id]}
                de={de}
                onOpen={() => setSelectedId(item.id)}
              />
            )}
          />
        </>
      )}
      {selected ? (
        <BookingDetails booking={selected} role="barber" person={customerNameOf(selected)} service={serviceNameOf(selected)} onClose={() => setSelectedId(null)}>
          <RequestActions
            styles={styles}
            item={selected}
            busy={data.inFlight[selected.id] === true}
            rowError={data.rowErrors[selected.id]}
            serviceName={serviceNameOf(selected)}
            customerName={customerNameOf(selected)}
            de={de}
            onReject={() => confirmDestructive(de ? 'Diesen Termin ablehnen?' : 'Reject this booking?', de ? 'Ablehnen' : 'Reject', () => void runTransition(selected, 'rejected', rejectBooking))}
            onAccept={() => void runTransition(selected, 'accepted', acceptBooking)}
            onCancel={() => confirmDestructive(de ? 'Diesen Termin stornieren?' : 'Cancel this booking?', de ? 'Termin stornieren' : 'Cancel booking', () => void runTransition(selected, 'cancelled', cancelBookingAsBarber))}
            onComplete={() => void runTransition(selected, 'completed', completeBooking)}
            onOnMyWay={() => {
              setSelectedId(null);
              navigation.navigate('Trip', { booking: selected, customerName: customerNameOf(selected), serviceName: serviceNameOf(selected) });
            }}
          />
        </BookingDetails>
      ) : null}
      <ConfirmSheet
        open={confirmation !== null}
        title={confirmation?.title ?? ''}
        message={de ? 'Diese Aktion kann nicht rückgängig gemacht werden.' : 'This cannot be undone.'}
        confirmLabel={confirmation?.label ?? ''}
        cancelLabel={de ? 'Behalten' : 'Keep'}
        destructive
        testID="barber-request-confirm"
        onClose={() => setConfirmation(null)}
        onConfirm={() => { const action = confirmation?.action; setConfirmation(null); action?.(); }}
      />
      <CelebrationOverlay message={data.celebration} onDone={data.clearCelebration} testID="barber-requests-celebration" />
    </SafeAreaView>
  );
}

/**
 * One request card, its section headers, and the actions in its details
 * sheet. Cards lead with the customer's name and photo when the
 * get_booking_counterparts RPC returned them, else with the service name.
 *
 * Actions follow the state machine only: pending offers Reject and Accept,
 * accepted offers Cancel and Mark complete; the rest are terminal. Reject
 * and Cancel are confirmed first (they cannot be undone).
 */
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AcceptedBookingTools } from '../../../shared/components/AcceptedBookingTools';
import { Avatar } from '../../../shared/components/Avatar';
import { GlassSurface } from '../../../shared/components/GlassSurface';
import { StatusPill } from '../../../shared/components/StatusPill';
import { formatBookingWhen, formatMoney } from '../../../shared/format';
import { Reveal } from '../../../shared/motion';
import { numericText } from '../../../theme/typography';
import { useTheme } from '../../../theme/useTheme';
import type { BookingRow, ServiceRow } from '../../../types';
import { isTripWindow } from '../../requestPresentation';
import type { BookingCounterpart } from '../../types';
import { OnMyWayButton } from '../OnMyWayButton';
import type { RequestsStyles } from './requestsStyles';

type ActionVariant = 'primary' | 'secondary' | 'success';

function ActionButton({ styles, variant, label, testID, onPress }: {
  styles: RequestsStyles;
  variant: ActionVariant;
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const shape = variant === 'primary' ? styles.actionPrimary : variant === 'success' ? styles.actionSuccess : styles.actionSecondary;
  const text = variant === 'primary' ? styles.actionPrimaryText : variant === 'success' ? styles.actionSuccessText : styles.actionSecondaryText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, shape, pressed ? styles.actionPressed : null]}
    >
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ styles, sectionKey, title, count }: { styles: RequestsStyles; sectionKey: string; title: string; count: number }) {
  return (
    <View style={styles.sectionHeader} testID={`barber-requests-section-${sectionKey}`}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

export function HistoryToggle({ styles, count, expanded, de, onToggle }: {
  styles: RequestsStyles;
  count: number;
  expanded: boolean;
  de: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityLabel={de
        ? `${count} Termine im Verlauf ${expanded ? 'ausblenden' : 'anzeigen'}`
        : `${expanded ? 'Hide' : 'Show'} ${count} history bookings`}
      accessibilityState={{ expanded }}
      testID="barber-requests-history-toggle"
      style={styles.historyToggle}
    >
      <Text style={styles.sectionTitle}>{de ? 'Verlauf' : 'History'}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
      <Text style={styles.historyAction}>{de ? (expanded ? 'Ausblenden' : 'Anzeigen') : (expanded ? 'Hide' : 'Show')}</Text>
    </Pressable>
  );
}

export function RequestCard({ styles, item, index, service, counterpart, rowError, de, onOpen }: {
  styles: RequestsStyles;
  item: BookingRow;
  index: number;
  service: ServiceRow | undefined;
  counterpart: BookingCounterpart | undefined;
  rowError: string | undefined;
  de: boolean;
  onOpen: () => void;
}) {
  const when = formatBookingWhen(item.date, item.time);
  const title = counterpart?.name ?? service?.name ?? (de ? 'Termin' : 'Booking');
  const subline = counterpart ? (service?.name ?? (de ? 'Leistung' : 'Service')) : when;
  return (
    <Reveal index={Math.min(index, 5)}>
      <GlassSurface style={styles.card} testID={`barber-requests-row-${item.id}`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${de ? 'Termindetails' : 'Appointment details'}, ${title}, ${when}`}
          testID={`barber-requests-open-${item.id}`}
          onPress={onOpen}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <View style={styles.cardTop}>
            <Avatar
              id={counterpart?.id ?? item.customer_id ?? item.id}
              name={counterpart?.name}
              imageUrl={counterpart?.profile_image}
              size={44}
              accessible={false}
              testID={`barber-requests-avatar-${item.id}`}
            />
            <View style={styles.cardInfo}>
              <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
              <Text numberOfLines={1} style={styles.cardMeta}>{subline}</Text>
              {counterpart ? <Text style={styles.cardMeta}>{when}</Text> : null}
              <Text numberOfLines={1} style={styles.cardMeta}>{item.location}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.cardPrice, numericText]}>{formatMoney(item.price)}</Text>
              <StatusPill status={item.status} testID={`barber-requests-status-${item.id}`} style={styles.cardStatus} />
            </View>
          </View>
          <Text style={styles.detailsLink}>{de ? 'Details ansehen' : 'View details'}</Text>
        </Pressable>
        {rowError ? (
          <View style={styles.rowError} accessibilityRole="alert" testID={`barber-requests-row-error-${item.id}`}>
            <Text style={styles.rowErrorText}>{rowError}</Text>
          </View>
        ) : null}
      </GlassSurface>
    </Reveal>
  );
}

export function RequestActions({ styles, item, busy, rowError, serviceName, customerName, de, onReject, onAccept, onCancel, onComplete, onOnMyWay }: {
  styles: RequestsStyles;
  item: BookingRow;
  busy: boolean;
  rowError: string | undefined;
  serviceName: string;
  customerName: string;
  de: boolean;
  onReject: () => void;
  onAccept: () => void;
  onCancel: () => void;
  onComplete: () => void;
  onOnMyWay: () => void;
}) {
  const { colors } = useTheme();
  const live = item.status === 'pending' || item.status === 'accepted';
  return (
    <>
      {live ? (
        <View style={styles.actions} testID={`barber-requests-actions-${item.id}`}>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={colors.accent}
              style={styles.actionSpinner}
              testID={`barber-requests-row-busy-${item.id}`}
              accessible
              accessibilityLabel={de ? 'Termin wird aktualisiert' : 'Updating booking'}
              accessibilityLiveRegion="polite"
            />
          ) : item.status === 'pending' ? (
            <>
              <ActionButton styles={styles} variant="secondary" label={de ? 'Ablehnen' : 'Reject'} testID={`request-reject-${item.id}`} onPress={onReject} />
              <ActionButton styles={styles} variant="primary" label={de ? 'Annehmen' : 'Accept'} testID={`request-accept-${item.id}`} onPress={onAccept} />
            </>
          ) : (
            <>
              <ActionButton styles={styles} variant="secondary" label={de ? 'Stornieren' : 'Cancel'} testID={`request-cancel-${item.id}`} onPress={onCancel} />
              <ActionButton styles={styles} variant="success" label={de ? 'Als erledigt markieren' : 'Mark complete'} testID={`request-complete-${item.id}`} onPress={onComplete} />
            </>
          )}
        </View>
      ) : null}
      {rowError ? <Text accessibilityRole="alert" style={styles.actionError}>{rowError}</Text> : null}
      {item.status === 'accepted' && isTripWindow(item) ? <OnMyWayButton bookingId={item.id} onPress={onOnMyWay} /> : null}
      <AcceptedBookingTools booking={item} calendarTitle={`${serviceName} · ${customerName}`} showDirections testIDPrefix={`barber-booking-tools-${item.id}`} />
    </>
  );
}

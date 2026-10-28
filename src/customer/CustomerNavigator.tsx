import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { stackScreenOptions } from '../shared/navigation/stackScreenOptions';
import { useReducedMotionPreference } from '../shared/motion/useReducedMotionPreference';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import type { ChatRoomRow, ServiceRow } from '../types';
import CustomerTabs, { type CustomerTabParamList } from './CustomerTabs';
import { UnreadProvider } from './UnreadContext';
import BarberProfileScreen from './screens/BarberProfileScreen';
import AccountSectionScreen, { type AccountSectionKey } from './screens/AccountSectionScreen';
import BookingDateTimeScreen from './screens/BookingDateTimeScreen';
import BookingLocationScreen from './screens/BookingLocationScreen';
import BookingConfirmScreen from './screens/BookingConfirmScreen';
import ConversationScreen from './screens/ConversationScreen';
import ReviewSubmitScreen from './screens/ReviewSubmitScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import LegalDocumentScreen from '../legal/LegalDocumentScreen';
import type { LegalDocument } from '../legal/legalConfig';
import NotificationCenterScreen from '../shared/screens/NotificationCenterScreen';
import LiveTripScreen from './screens/LiveTripScreen';
import LookConfirmScreen from './screens/LookConfirmScreen';
import LookDetailScreen from './screens/LookDetailScreen';
import LookSearchScreen from './screens/LookSearchScreen';
import LookWishesScreen from './screens/LookWishesScreen';
import type { LiveTripContext } from './liveTripData';

/**
 * Looks S3 to S5: what a booking is made for, attached after creation: a
 * feed look, a searched style with an optional private reference photo, or
 * a barber's offer on a wish (then accept_offer links the booking).
 */
export type LookReferenceParam = { lookId: string | null; style: string; photoPath?: string | null; offerId?: string };

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  BarberProfile: { barberId: string };
  AccountSection: { section: AccountSectionKey };
  EditProfile: undefined;
  Legal: { document: LegalDocument };
  // Booking flow: DateTime -> Location -> Confirm,
  // each screen carrying forward everything the next one needs so nothing
  // has to be re-fetched mid-flow. barberName rides along from
  // BarberProfileScreen (already loaded there) purely to avoid an extra
  // getBarberProfile call on the Confirm screen's summary. barberImage rides
  // along the same way so the chat opened from Confirm shows the barber's
  // photo, as it does when opened from Inbox or Bookings.
  BookingDateTime: { barberId: string; barberName: string; barberImage?: string | null; service: ServiceRow; lookReference?: LookReferenceParam };
  BookingLocation: {
    barberId: string;
    barberName: string;
    barberImage?: string | null;
    service: ServiceRow;
    date: string;
    time: string;
    lookReference?: LookReferenceParam;
  };
  BookingConfirm: {
    barberId: string;
    barberName: string;
    barberImage?: string | null;
    service: ServiceRow;
    date: string;
    time: string;
    location: string;
    /** Street + city only (no flat number or door notes) for an accurate pin. */
    geocodeQuery?: string;
    lookReference?: LookReferenceParam;
  };
  // Chat: the Inbox thread row carries the room
  // plus its already-loaded display context so the conversation screen
  // never re-fetches what the list already knew. title = barber name,
  // subtitle = service context (both best-effort strings, prepared by the
  // Inbox row).
  Conversation: { room: ChatRoomRow; title: string; subtitle: string | null; counterpart?: { id: string; name: string | null; profile_image: string | null } | null };
  NotificationCenter: undefined;
  // Live arrival tracking: opened from a push/feed tap (id only) or from a
  // booking card (context rides along so nothing is re-fetched).
  LiveTrip: { bookingId: string; context?: LiveTripContext };
  // Review submission: reached from a completed booking's
  // Past card on the Bookings tab. barberName/serviceName ride along (already
  // loaded on that card) purely for the summary; barberId is passed to the
  // write but is NOT trusted — the 0022 RLS predicate re-checks the whole
  // (booking, customer, barber) triple server-side.
  ReviewSubmit: {
    bookingId: string;
    barberId: string;
    barberName: string;
    serviceName: string;
  };
  // Looks S2: "Is this your cut?" for the look a barber captured on one of
  // the client's completed bookings (opened from the look_confirm event).
  LookConfirm: { bookingId: string };
  // Looks S3: one published look with its proof chain (from the Discover rail).
  LookDetail: { lookId: string };
  // Looks S4: style, day and time window with instant matches.
  LookSearch: { style?: string } | undefined;
  // Looks S5: the client's wishes and the barbers' offers on them.
  LookWishes: undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  const reduceMotion = useReducedMotionPreference();
  return (
    <RoleExitProvider value={onExit}>
      {/* One unread-state instance for the whole customer app: the Inbox tab
          badge, the bold thread rows, and the conversation screen's
          mark-as-read all read the same source of truth. */}
      <UnreadProvider>
        <Stack.Navigator screenOptions={stackScreenOptions(reduceMotion)}>
          <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
          <Stack.Screen name="BarberProfile" component={BarberProfileScreen} />
          <Stack.Screen name="AccountSection" component={AccountSectionScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Legal" component={LegalDocumentScreen} />
          <Stack.Screen name="BookingDateTime" component={BookingDateTimeScreen} />
          <Stack.Screen name="BookingLocation" component={BookingLocationScreen} />
          <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="NotificationCenter">
            {(props) => <NotificationCenterScreen
              role="customer"
              onBack={() => props.navigation.goBack()}
              onOpenNotification={(row) => {
                props.navigation.goBack();
                if (row.event_type.startsWith('trip_') && row.booking_id) {
                  props.navigation.navigate('LiveTrip', { bookingId: row.booking_id });
                  return;
                }
                if (row.event_type === 'look_confirm' && row.booking_id) {
                  props.navigation.navigate('LookConfirm', { bookingId: row.booking_id });
                  return;
                }
                if (row.event_type === 'look_offer') {
                  props.navigation.navigate('LookWishes');
                  return;
                }
                props.navigation.navigate('CustomerTabs', { screen: row.event_type === 'message' ? 'Inbox' : 'Bookings' });
              }}
            />}
          </Stack.Screen>
          <Stack.Screen name="ReviewSubmit" component={ReviewSubmitScreen} />
          <Stack.Screen name="LiveTrip" component={LiveTripScreen} options={{ animation: reduceMotion ? 'fade' : 'slide_from_bottom' }} />
          <Stack.Screen name="LookConfirm" component={LookConfirmScreen} />
          <Stack.Screen name="LookDetail" component={LookDetailScreen} />
          <Stack.Screen name="LookSearch" component={LookSearchScreen} />
          <Stack.Screen name="LookWishes" component={LookWishesScreen} />
        </Stack.Navigator>
      </UnreadProvider>
    </RoleExitProvider>
  );
}

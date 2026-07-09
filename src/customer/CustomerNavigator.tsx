import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import type { ChatRoomRow, ServiceRow } from '../types';
import CustomerTabs, { type CustomerTabParamList } from './CustomerTabs';
import BarberProfileScreen from './screens/BarberProfileScreen';
import AccountSectionScreen, { type AccountSectionKey } from './screens/AccountSectionScreen';
import BookingDateTimeScreen from './screens/BookingDateTimeScreen';
import BookingLocationScreen from './screens/BookingLocationScreen';
import BookingConfirmScreen from './screens/BookingConfirmScreen';
import ConversationScreen from './screens/ConversationScreen';

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  BarberProfile: { barberId: string };
  AccountSection: { section: AccountSectionKey };
  // Booking flow (build-order step 11-12): DateTime -> Location -> Confirm,
  // each screen carrying forward everything the next one needs so nothing
  // has to be re-fetched mid-flow. barberName rides along from
  // BarberProfileScreen (already loaded there) purely to avoid an extra
  // getBarberProfile call on the Confirm screen's summary.
  BookingDateTime: { barberId: string; barberName: string; service: ServiceRow };
  BookingLocation: {
    barberId: string;
    barberName: string;
    service: ServiceRow;
    date: string;
    time: string;
  };
  BookingConfirm: {
    barberId: string;
    barberName: string;
    service: ServiceRow;
    date: string;
    time: string;
    location: string;
  };
  // Chat (build-order step 15-16): the Inbox thread row carries the room
  // plus its already-loaded display context so the conversation screen
  // never re-fetches what the list already knew. title = barber name,
  // subtitle = service context (both best-effort strings, prepared by the
  // Inbox row).
  Conversation: { room: ChatRoomRow; title: string; subtitle: string | null };
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
        <Stack.Screen name="BarberProfile" component={BarberProfileScreen} />
        <Stack.Screen name="AccountSection" component={AccountSectionScreen} />
        <Stack.Screen name="BookingDateTime" component={BookingDateTimeScreen} />
        <Stack.Screen name="BookingLocation" component={BookingLocationScreen} />
        <Stack.Screen name="BookingConfirm" component={BookingConfirmScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

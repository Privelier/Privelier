import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import type { ServiceRow } from '../types';
import CustomerTabs, { type CustomerTabParamList } from './CustomerTabs';
import BarberProfileScreen from './screens/BarberProfileScreen';
import AccountSectionScreen, { type AccountSectionKey } from './screens/AccountSectionScreen';
import BookingDateTimeScreen from './screens/BookingDateTimeScreen';
import BookingLocationScreen from './screens/BookingLocationScreen';
import BookingConfirmScreen from './screens/BookingConfirmScreen';

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
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

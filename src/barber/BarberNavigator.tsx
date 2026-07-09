import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import type { ChatRoomRow } from '../types';
import BarberTabs, { type BarberTabParamList } from './BarberTabs';
import ServicesScreen from './screens/ServicesScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';
import ConversationScreen from './screens/ConversationScreen';

export type BarberStackParamList = {
  BarberTabs: NavigatorScreenParams<BarberTabParamList> | undefined;
  Services: undefined;
  Availability: undefined;
  // Chat (build-order step 15-16): title from the Chats row (service name —
  // the customer's name is unreadable list-side under users RLS; the screen
  // itself upgrades the title via the 0012 counterparts RPC).
  Conversation: { room: ChatRoomRow; title: string; subtitle: string | null };
};

const Stack = createNativeStackNavigator<BarberStackParamList>();

export default function BarberNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BarberTabs" component={BarberTabs} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="Availability" component={AvailabilityScreen} />
        <Stack.Screen name="Conversation" component={ConversationScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

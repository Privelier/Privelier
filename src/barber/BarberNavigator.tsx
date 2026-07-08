import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import BarberTabs, { type BarberTabParamList } from './BarberTabs';
import ServicesScreen from './screens/ServicesScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';

export type BarberStackParamList = {
  BarberTabs: NavigatorScreenParams<BarberTabParamList> | undefined;
  Services: undefined;
  Availability: undefined;
};

const Stack = createNativeStackNavigator<BarberStackParamList>();

export default function BarberNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BarberTabs" component={BarberTabs} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="Availability" component={AvailabilityScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

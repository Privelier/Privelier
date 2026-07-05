import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleExitProvider } from '../RoleContext';
import BarberDashboardScreen from './screens/BarberDashboardScreen';
import ServicesScreen from './screens/ServicesScreen';
import AvailabilityScreen from './screens/AvailabilityScreen';

export type BarberStackParamList = {
  BarberDashboard: undefined;
  Services: undefined;
  Availability: undefined;
};

const Stack = createNativeStackNavigator<BarberStackParamList>();

export default function BarberNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BarberDashboard" component={BarberDashboardScreen} />
        <Stack.Screen name="Services" component={ServicesScreen} />
        <Stack.Screen name="Availability" component={AvailabilityScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

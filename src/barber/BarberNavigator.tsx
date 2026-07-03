import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleExitProvider } from '../RoleContext';
import BarberDashboardScreen from './screens/BarberDashboardScreen';

export type BarberStackParamList = {
  BarberDashboard: undefined;
};

const Stack = createNativeStackNavigator<BarberStackParamList>();

export default function BarberNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BarberDashboard" component={BarberDashboardScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

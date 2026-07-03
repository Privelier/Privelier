import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BarberDashboardScreen from './screens/BarberDashboardScreen';

export type BarberStackParamList = {
  BarberDashboard: undefined;
};

const Stack = createNativeStackNavigator<BarberStackParamList>();

export default function BarberNavigator({ onExit }: { onExit: () => void }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BarberDashboard">
        {() => <BarberDashboardScreen onBack={onExit} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomerHomeScreen from './screens/CustomerHomeScreen';

export type CustomerStackParamList = {
  CustomerHome: undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CustomerHome">
        {() => <CustomerHomeScreen onBack={onExit} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

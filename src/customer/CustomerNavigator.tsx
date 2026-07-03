import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RoleExitProvider } from '../RoleContext';
import CustomerHomeScreen from './screens/CustomerHomeScreen';

export type CustomerStackParamList = {
  CustomerHome: undefined;
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerHome" component={CustomerHomeScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

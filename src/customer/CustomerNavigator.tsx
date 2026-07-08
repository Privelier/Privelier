import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { RoleExitProvider } from '../RoleContext';
import CustomerTabs, { type CustomerTabParamList } from './CustomerTabs';
import BarberProfileScreen from './screens/BarberProfileScreen';
import AccountSectionScreen, { type AccountSectionKey } from './screens/AccountSectionScreen';

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  BarberProfile: { barberId: string };
  AccountSection: { section: AccountSectionKey };
};

const Stack = createNativeStackNavigator<CustomerStackParamList>();

export default function CustomerNavigator({ onExit }: { onExit: () => void }) {
  return (
    <RoleExitProvider value={onExit}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="CustomerTabs" component={CustomerTabs} />
        <Stack.Screen name="BarberProfile" component={BarberProfileScreen} />
        <Stack.Screen name="AccountSection" component={AccountSectionScreen} />
      </Stack.Navigator>
    </RoleExitProvider>
  );
}

/**
 * UNAUTHENTICATED shell (Contract A state 2 + 3). The ONLY place customer
 * and barber flows may share UI. Choosing a role leads to that role's auth
 * screens — never directly into an app navigator; the root switch in App.tsx
 * mounts CustomerNavigator/BarberNavigator only from server-truth role.
 *
 * AwaitEmailConfirmation (Contract A state 3) lives here as a route because
 * it is a no-session state: plain client navigation state that intentionally
 * does not survive a restart (the user lands back at the pre-auth shell).
 */
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import RoleSelectScreen from '../../RoleSelectScreen';
import AuthEntryScreen from './AuthEntryScreen';
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';
import AwaitEmailConfirmationScreen from './AwaitEmailConfirmationScreen';
import type { Role } from '../../types';

export type AuthStackParamList = {
  RoleSelect: undefined;
  AuthEntry: { role: Role };
  Login: { role: Role };
  Signup: { role: Role };
  AwaitEmailConfirmation: { email: string; role: Role };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * Module-level wrapper (no inline children render-props on Stack.Screen):
 * keeps RoleSelectScreen presentational while wiring role choice to the
 * per-role auth entry.
 */
function RoleSelectRoute() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList, 'RoleSelect'>>();
  const onSelectRole = useCallback(
    (role: Role) => navigation.navigate('AuthEntry', { role }),
    [navigation]
  );
  return <RoleSelectScreen onSelectRole={onSelectRole} />;
}

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectRoute} />
      <Stack.Screen name="AuthEntry" component={AuthEntryScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="AwaitEmailConfirmation" component={AwaitEmailConfirmationScreen} />
    </Stack.Navigator>
  );
}

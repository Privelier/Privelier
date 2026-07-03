import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import RoleSelectScreen from './src/RoleSelectScreen';
import CustomerNavigator from './src/customer/CustomerNavigator';
import BarberNavigator from './src/barber/BarberNavigator';
import { appFonts } from './src/theme/typography';
import type { Role } from './src/types';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded] = useFonts(appFonts);
  const [role, setRole] = useState<Role | null>(null);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <NavigationContainer>
        {role === 'customer' && <CustomerNavigator onExit={() => setRole(null)} />}
        {role === 'barber' && <BarberNavigator onExit={() => setRole(null)} />}
        {role === null && <RoleSelectScreen onSelectRole={setRole} />}
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

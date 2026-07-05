/**
 * Root of the app — the single session-driven root switch (Contract A).
 *
 * Exactly ONE of these renders at a time, derived from (session, profileRow)
 * by useAuthShell:
 * 1. RESTORING        → native splash stays visible; no navigator mounted.
 * 2. UNAUTHENTICATED  → pre-auth shell (AuthNavigator: RoleSelect → per-role
 *                       login/signup; AwaitEmailConfirmation lives inside it
 *                       as client navigation state).
 * 3. PROVISIONING     → ensureProfile() in flight / finish-setup form /
 *                       retryable failure.
 * 4. AUTHENTICATED    → role from the public.users row ONLY:
 *                       customer → CustomerNavigator, barber → BarberNavigator,
 *                       admin → AdminNotSupportedScreen.
 *
 * Remount stability: TOKEN_REFRESHED / USER_UPDATED never change the derived
 * phase, and each phase renders stable element types with component={} screens
 * only — navigators are never remounted by auth noise (step-4 fix preserved).
 */
import { useCallback, type ReactElement } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AuthNavigator from './src/auth/screens/AuthNavigator';
import AdminNotSupportedScreen from './src/auth/screens/AdminNotSupportedScreen';
import FinishSetupScreen from './src/auth/screens/FinishSetupScreen';
import ProvisioningScreen from './src/auth/screens/ProvisioningScreen';
import { useAuthShell, type AuthShell } from './src/auth/useAuthShell';
import CustomerNavigator from './src/customer/CustomerNavigator';
import BarberNavigator from './src/barber/BarberNavigator';
import { appFonts } from './src/theme/typography';

SplashScreen.preventAutoHideAsync();

function renderRoot(shell: AuthShell): ReactElement {
  const { state, retryProvisioning, submitSetupForm, signOutNow } = shell;
  switch (state.phase) {
    case 'restoring':
    case 'unauthenticated':
      // 'restoring' never reaches here (App returns null first); listing it
      // keeps the switch exhaustive for TypeScript.
      return <AuthNavigator />;
    case 'provisioning':
      if (state.view.kind === 'setup_form') {
        return (
          <FinishSetupScreen
            prefill={state.view.prefill}
            onSubmit={submitSetupForm}
            onSignOut={signOutNow}
          />
        );
      }
      return (
        <ProvisioningScreen
          view={state.view}
          onRetry={retryProvisioning}
          onSignOut={signOutNow}
        />
      );
    case 'authenticated':
      // Routing authority is public.users.role — never user_metadata, never
      // which auth screen was used. "Exit" in authenticated states is a real
      // sign-out (replaces the step-4 pre-auth exit-role behavior).
      switch (state.profile.role) {
        case 'customer':
          return <CustomerNavigator onExit={signOutNow} />;
        case 'barber':
          return <BarberNavigator onExit={signOutNow} />;
        case 'admin':
          return <AdminNotSupportedScreen onSignOut={signOutNow} />;
      }
  }
}

export default function App() {
  const [fontsLoaded] = useFonts(appFonts);
  const shell = useAuthShell();
  const restoring = shell.state.phase === 'restoring';

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && !restoring) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, restoring]);

  if (!fontsLoaded || restoring) {
    // RESTORING: the native splash stays up; no navigator is mounted.
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <NavigationContainer>{renderRoot(shell)}</NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

/**
 * Per-role auth entry (pre-auth shell): after RoleSelect, choose between
 * logging in and creating an account. Role only affects copy and which
 * signup variant is used downstream — it is never routing authority.
 */
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './AuthNavigator';
import { AuthScreenShell, BackLink, PrimaryButton, ScreenHeading, SecondaryButton } from './ui';

type Props = NativeStackScreenProps<AuthStackParamList, 'AuthEntry'>;

export default function AuthEntryScreen({ navigation, route }: Props) {
  const { role } = route.params;
  const isBarber = role === 'barber';

  return (
    <AuthScreenShell testID="auth-entry-screen">
      <BackLink onPress={() => navigation.goBack()} testID="auth-entry-back" />
      <ScreenHeading
        title={isBarber ? 'Barber account' : 'Customer account'}
        subtitle={
          isBarber
            ? 'Manage your services, availability and bookings.'
            : 'Book a trusted private barber to come to you.'
        }
      />
      <View style={styles.actions}>
        <PrimaryButton
          label="Log in"
          onPress={() => navigation.navigate('Login', { role })}
          testID="auth-entry-login"
        />
        <SecondaryButton
          label="Create an account"
          onPress={() => navigation.navigate('Signup', { role })}
          testID="auth-entry-signup"
        />
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
});

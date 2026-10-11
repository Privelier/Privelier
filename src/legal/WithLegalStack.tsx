/**
 * Root-phase screens (finish setup, the legal consent gate) render outside
 * the role navigators, so their "Terms" / "Privacy" links had no `Legal`
 * route to open. This wraps such a screen in a two-route native stack —
 * the screen itself plus the legal document — so those links work without
 * coupling the screen to either app's navigator.
 */
import type { ReactElement } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LegalDocumentScreen from './LegalDocumentScreen';
import type { LegalDocument } from './legalConfig';
import { stackScreenOptions } from '../shared/navigation/stackScreenOptions';
import { useReducedMotionPreference } from '../shared/motion/useReducedMotionPreference';

type LegalStackParams = { Main: undefined; Legal: { document: LegalDocument } };

const Stack = createNativeStackNavigator<LegalStackParams>();

export function WithLegalStack({ children }: { children: ReactElement }) {
  const reduceMotion = useReducedMotionPreference();
  return (
    <Stack.Navigator screenOptions={stackScreenOptions(reduceMotion)}>
      <Stack.Screen name="Main">{() => children}</Stack.Screen>
      <Stack.Screen name="Legal" component={LegalDocumentScreen} />
    </Stack.Navigator>
  );
}

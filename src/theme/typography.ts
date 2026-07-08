import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

export const appFonts = {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};

export const fontFamily = {
  heading: 'PlayfairDisplay_700Bold',
  // The reference design sets its large editorial headings at weight 500 —
  // lighter than the 700 used for the smaller auth-era headings.
  headingMedium: 'PlayfairDisplay_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

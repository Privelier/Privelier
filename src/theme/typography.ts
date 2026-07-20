import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
// Cinzel is the LOGOTYPE face (founder-supplied with the chosen "Signet" mark,
// 2026-07-21). Static faces deliberately, not the variable TTF the founders
// sent: React Native addresses fonts by family-name string, and weight
// selection inside a variable font is not reliable across iOS/Android in Expo.
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';

export const appFonts = {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Cinzel_400Regular,
  Cinzel_600SemiBold,
};

export const fontFamily = {
  heading: 'PlayfairDisplay_700Bold',
  // The reference design sets its large editorial headings at weight 500 —
  // lighter than the 700 used for the smaller auth-era headings.
  headingMedium: 'PlayfairDisplay_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  // LOGOTYPE ONLY — consumed exclusively by src/shared/components/Brandmark.tsx.
  // Do NOT use these as a heading or body face, and do not import them into a
  // screen. Cinzel is caps-by-design: its lowercase is drawn as reduced
  // capitals with almost no ascender/descender rhythm, so it cannot render the
  // sentence case CLAUDE.md mandates everywhere outside the logotype. Playfair
  // remains the editorial heading face. The mark's authority also depends on
  // this face appearing ONLY in the mark — spread it across screen headings and
  // the signet becomes app chrome.
  logo: 'Cinzel_400Regular', // the PRIVELIER wordmark
  logoSemiBold: 'Cinzel_600SemiBold', // the roundel's P — one weight step up, for stroke hierarchy
} as const;

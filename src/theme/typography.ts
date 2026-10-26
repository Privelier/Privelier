import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
// Cinzel is the LOGOTYPE face (the "Signet" mark). Static faces deliberately,
// not the variable TTF: React Native addresses fonts by family-name string, and weight
// selection inside a variable font is not reliable across iOS/Android in Expo.
import { Cinzel_400Regular, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import type { TextStyle } from 'react-native';

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

/**
 * Type scale: every text size in the app is one of these roles. Sizes and line
 * heights travel together so a screen never picks them separately. 12 is the
 * floor — anything smaller is unreadable on a phone and breaks large-text mode.
 * Pair a role with a family from `fontFamily`; roles carry no weight.
 */
export const typeScale = {
  display: { fontSize: 40, lineHeight: 48 },
  title1: { fontSize: 30, lineHeight: 38 },
  title2: { fontSize: 24, lineHeight: 31 },
  title3: { fontSize: 20, lineHeight: 26 },
  headline: { fontSize: 18, lineHeight: 24 },
  bodyLarge: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 14, lineHeight: 21 },
  secondary: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
} as const satisfies Record<string, Pick<TextStyle, 'fontSize' | 'lineHeight'>>;


/** Lining, fixed-width figures keep prices, times and dashboard values aligned. */
export const numericText: TextStyle = {
  fontFamily: fontFamily.bodySemiBold,
  fontVariant: ['lining-nums', 'tabular-nums'],
};

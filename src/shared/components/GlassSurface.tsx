/**
 * Component glass. The app background is flat charcoal; the glass lives on
 * the components themselves — tab bar, headers, chat bubbles, composer,
 * cards, chips, sheets and toasts — so each surface carries its own light:
 *
 * - a translucent body,
 * - a native diagonal sheen (light catching the top-left of the pane),
 * - an inset light edge on top and a fine specular line,
 * - a real backdrop blur on surfaces that content scrolls beneath
 *   (navigation and floating), so the pane frosts what passes under it.
 *
 * This is the one deliberate exception to the flat-hairline elevation rule
 * in theme/spacing.ts: gradients and inset light are confined to glass.
 *
 * Speed: the sheen and edges are native style layers (backgroundImage and
 * boxShadow on the New Architecture), not SVG or extra views, so card and
 * bubble lists stay cheap. Live blur is reserved for the few pinned
 * surfaces. Reduce Transparency collapses every variant to a solid surface.
 */
import type { PropsWithChildren, RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { HAIRLINE, radius } from '../../theme/spacing';
import { useTheme } from '../../theme/useTheme';
import { useReduceTransparency } from '../motion/useReduceTransparency';

export type GlassVariant = 'card' | 'navigation' | 'floating';
export type GlassTone = 'neutral' | 'brass' | 'danger';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /**
   * - card: content surfaces, list rows, bubbles. Glass body and sheen,
   *   never a live blur (many scrolling blurs are the most expensive effect
   *   on Android).
   * - navigation: tab bars, chat headers and composers. Live blur where the
   *   platform supports it (Android needs a blur target).
   * - floating: few pinned overlays — toast, offline pill, title bar,
   *   booking dock, sheets. Live blur on iOS.
   */
  variant?: GlassVariant;
  /** brass: the user's own / selected surface. danger: a failed state. */
  tone?: GlassTone;
  blurTarget?: RefObject<View | null>;
}>;

/** Glass tokens. */
export const glass = {
  cardFill: 'rgba(34,34,38,0.62)',
  blurFill: 'rgba(20,20,23,0.46)',
  brassFill: 'rgba(191,160,107,0.13)',
  dangerFill: 'rgba(168,69,62,0.12)',
  edge: 'rgba(245,241,232,0.13)',
  brassEdge: 'rgba(191,160,107,0.42)',
  dangerEdge: 'rgba(206,122,115,0.55)',
  reflection: 'rgba(245,241,232,0.34)',
  sheen: 'linear-gradient(150deg, rgba(245,241,232,0.085) 0%, rgba(245,241,232,0.02) 42%, rgba(245,241,232,0) 62%, rgba(191,160,107,0.04) 100%)',
  brassSheen: 'linear-gradient(150deg, rgba(222,196,146,0.20) 0%, rgba(191,160,107,0.07) 48%, rgba(191,160,107,0.03) 100%)',
  dangerSheen: 'linear-gradient(150deg, rgba(206,122,115,0.14) 0%, rgba(206,122,115,0.03) 55%, rgba(206,122,115,0) 100%)',
  innerLight: 'inset 0 1px 0 rgba(245,241,232,0.09)',
  floatShadow: '0 10px 28px rgba(0,0,0,0.42)',
} as const;

const TONE = {
  neutral: { fill: glass.cardFill, edge: glass.edge, sheen: glass.sheen },
  brass: { fill: glass.brassFill, edge: glass.brassEdge, sheen: glass.brassSheen },
  danger: { fill: glass.dangerFill, edge: glass.dangerEdge, sheen: glass.dangerSheen },
} as const;

/**
 * The glass style layers for a surface, for components that need them on
 * their own Pressable (chat bubbles, chips) instead of a wrapper view.
 */
export function useGlassStyle(tone: GlassTone = 'neutral', floating = false): ViewStyle {
  const { colors } = useTheme();
  const reduceTransparency = useReduceTransparency();
  if (reduceTransparency) {
    return {
      backgroundColor: colors.surface,
      borderColor: tone === 'brass' ? colors.accent : tone === 'danger' ? colors.error : colors.border,
      borderWidth: HAIRLINE,
    };
  }
  const t = TONE[tone];
  return {
    backgroundColor: t.fill,
    borderColor: t.edge,
    borderWidth: HAIRLINE,
    experimental_backgroundImage: t.sheen,
    boxShadow: floating ? `${glass.innerLight}, ${glass.floatShadow}` : glass.innerLight,
  };
}

/** A frosted pane: translucent body, sheen, light edge, specular top line. */
export function GlassSurface({ children, style, testID, variant = 'card', tone = 'neutral', blurTarget }: Props) {
  const reduceTransparency = useReduceTransparency();
  const blurCapable = variant !== 'card';
  const glassStyle = useGlassStyle(tone, variant === 'floating');

  const blur =
    blurCapable &&
    !reduceTransparency &&
    (Platform.OS === 'ios' || (variant === 'navigation' && Boolean(blurTarget)));

  return (
    <View
      testID={testID}
      style={[
        styles.surface,
        glassStyle,
        // Over a live blur the body thins out so the frosted content shows.
        blur && tone === 'neutral' ? { backgroundColor: glass.blurFill } : null,
        blurCapable && !reduceTransparency && tone === 'neutral' ? { borderColor: glass.brassEdge } : null,
        style,
      ]}
    >
      {blur ? (
        <BlurView
          testID={testID ? `${testID}-blur` : undefined}
          pointerEvents="none"
          intensity={variant === 'floating' ? 50 : 40}
          tint="dark"
          blurTarget={blurTarget}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {reduceTransparency ? null : (
        <View pointerEvents="none" style={[styles.highlight, { backgroundColor: glass.reflection }]} />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: HAIRLINE,
  },
});

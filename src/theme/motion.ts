/**
 * Motion tokens — the timing + feedback half of the Privelier design system
 * (Step-18 Ultra design pass, 2026-07-21).
 *
 * The brand is calm and editorial, so motion is a SUPPORTING signal, never a
 * spectacle: it confirms a state change (press, appear, dismiss) and then gets
 * out of the way. No bouncing, no spring overshoot, no decorative movement.
 * These are plain constants (theme-independent), used with the built-in
 * `Animated` API — this project deliberately does NOT depend on
 * react-native-reanimated (it is not in the dependency tree and adding it would
 * force a native rebuild), so everything here is expressible with `Animated`.
 *
 * PRESSED FEEDBACK: every Pressable should dim to `pressOpacity` on press —
 * one consistent value app-wide (the 2026-07-14 dashboard pass standardised
 * 0.85 for cards; interactive list rows / destructive controls may go a touch
 * lower). Prefer opacity over scale for the flat aesthetic; a press should feel
 * like a soft dim, not a bounce.
 */

/** Animation durations in ms. Fast/base/slow cover essentially every case. */
export const duration = {
  /** micro-feedback: press dim, small fades */
  fast: 120,
  /** the default: tab/content cross-fades, notice in/out */
  base: 180,
  /** larger transitions: sheets, success confirmations */
  slow: 240,
} as const;

/**
 * Standard pressed-state opacity for Pressables. Cards/link rows use `soft`;
 * primary/destructive buttons can use `firm` for a slightly clearer tap.
 */
export const pressOpacity = {
  soft: 0.85,
  firm: 0.7,
} as const;

export type Duration = keyof typeof duration;

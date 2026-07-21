/**
 * Spacing + radius scale — the geometric half of the Privelier design system
 * (the colour half is `colors.ts`, the type half is `typography.ts`).
 *
 * These are theme-INDEPENDENT (identical in light and dark), so unlike colours
 * they are plain constants imported directly, not threaded through useTheme.
 *
 * The scale is the canonical 4-based rhythm — every margin, padding and gap in
 * the app should resolve to one of these values, never an arbitrary number.
 * This is what makes spacing read as "one system" across screens (the Step-18
 * Ultra design pass, 2026-07-21).
 *
 * ELEVATION PHILOSOPHY (authoritative brand): depth is expressed with 0.5px
 * hairlines and surface-colour contrast, NEVER drop shadows or gradients. There
 * is deliberately no `shadow`/`elevation` token here — adding one would violate
 * the flat brand. Separation comes from `border` (hairline) + `surface` vs
 * `background`.
 */

/** 4-based spacing scale. Use `space.md` etc., never a bare number. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

/**
 * Corner radii, named by intent and derived from the shapes already in use:
 * avatars/thumbnails (4), buttons/cards (8–10), grouped summary cards (12),
 * hero-scale surfaces (16), and fully-round chips/pills/disc buttons (pill).
 * A circular control's radius is still half its size (e.g. a 36px back disc is
 * radius 18) — compute those inline; `pill` covers the "always round" case.
 */
export const radius = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

/** Standard hairline weight — the brand's only divider/border thickness. */
export const HAIRLINE = 0.5;

export type Space = keyof typeof space;
export type Radius = keyof typeof radius;

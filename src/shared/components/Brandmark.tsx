/**
 * The Privelier Signet — the brand mark, as chosen by the founders 2026-07-21
 * from their logo deck (option 03, "a quiet typographic seal — membership,
 * hospitality, a maison rather than an app").
 *
 * The mark is a roundel: a thick outer ring, a clear gap, a brass hairline
 * ring, and a Cinzel capital P at the centre. Two lockups add the wordmark.
 *
 * WHY VIEWS AND NOT SVG: a stroked circle is natively expressible as
 * `borderRadius: size/2` + `borderWidth` — this is not an approximation, it is
 * the same rasterizer path, and SVG would render pixel-identically. SVG earns
 * its keep for paths, clipping, or a custom-drawn glyph; our P is set in a live
 * font, so even under SVG it would be <SvgText>, which has WORSE cross-platform
 * metric behaviour than <Text>. `react-native-svg` is a native module and would
 * cost a full EAS dev-client rebuild. Revisit only if the mark ever gains a
 * non-circular element (a notch, a flourish, an outlined P).
 *
 * WHY EACH RING IS ITS OWN NESTED VIEW rather than one View with two borders:
 * Android has seam/antialiasing artifacts when compositing a large borderWidth
 * against a large borderRadius. Nesting sidesteps that, and it also makes the
 * "clear gap" literal — the gap is the PARENT's background showing through, so
 * it carries no color of its own and is therefore automatically correct on any
 * surface, in either theme, with no prop.
 *
 * BRASS BUDGET: at size 'lg' the brass hairline covers ~2.6% of the mark's own
 * bounding box. That is why the Signet can sit on a screen without spending
 * that screen's accent allowance — CLAUDE.md rations brass hard.
 *
 * PLACEMENT IS DELIBERATELY NARROW. A signet reads as "maison" precisely
 * because it is seen rarely — at the threshold and in the waiting moments,
 * never in chrome. It belongs on the role-select screen, the provisioning
 * wait, and the await-confirmation dead end. It must NOT go in tab bars, tab
 * headers (both apps open with a personal greeting — the mark would step on
 * the one warm moment each app has), as an avatar or image placeholder (that
 * makes the brand a stand-in for missing user data), or in empty/error states.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { darkPalette, lightPalette } from '../../theme/colors';
import { useTheme } from '../../theme/useTheme';

/** Which lockup from the deck. */
export type BrandmarkLockup = 'mark' | 'vertical' | 'horizontal';

/** Named sizes. There are no free-floating numeric sizes, by design. */
export type BrandmarkSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Ground behind the mark. 'auto' follows the theme; force 'dark' when placing
 * on a dark image or scrim while the app is in light mode.
 */
export type BrandmarkGround = 'auto' | 'dark' | 'light';

/** Per-size roundel geometry. Hand-tuned integers — see SIZES. */
interface MarkMetrics {
  /** Outer diameter. */
  size: number;
  outerRingWidth: number;
  /** Clear space between the outer and brass rings. */
  gap: number;
  innerRingWidth: number;
  /** Cinzel P font size. */
  glyphSize: number;
  /** Space below the mark in the vertical lockup. */
  vGap: number;
  /** Space right of the mark in the horizontal lockup. */
  hGap: number;
}

/**
 * The authoritative size table. These are hand-tuned integers, NOT computed at
 * runtime: rounding is what makes a hairline ring look crisp, and
 * `Math.round(size * ratio)` at arbitrary sizes yields half-pixel ring widths
 * that antialias into mush on Android.
 *
 * The generating ratios, for deriving a future size correctly:
 *   outerRingWidth = max(2, round(S * 0.055))
 *   gap            = max(2, round(S * 0.055))
 *   innerRingWidth = max(1, round(S * 0.011))
 *   glyphSize      = round(S * 0.60)      // = 0.42·S target cap ÷ Cinzel's 0.700em cap height
 *   vGap           = round(S * 0.20)
 *   hGap           = round(S * 0.28)
 *
 * The ratios encode a stroke hierarchy that must stay unambiguous — at 'lg':
 * outer ring 4px (structure) > P stem ~3.2px (the letter) > brass ring 1px
 * (hairline detail). That ranking is why the P is a weight step heavier than
 * the wordmark; at 400 its stem would fall between the brass hairline and the
 * outer ring and the seal would read hollow.
 */
const SIZES: Readonly<Record<BrandmarkSize, MarkMetrics>> = Object.freeze({
  sm: { size: 24, outerRingWidth: 2, gap: 2, innerRingWidth: 1, glyphSize: 14, vGap: 5, hGap: 7 },
  md: { size: 40, outerRingWidth: 2, gap: 2, innerRingWidth: 1, glyphSize: 24, vGap: 8, hGap: 11 },
  lg: { size: 64, outerRingWidth: 4, gap: 4, innerRingWidth: 1, glyphSize: 38, vGap: 13, hGap: 18 },
  xl: { size: 96, outerRingWidth: 5, gap: 5, innerRingWidth: 1, glyphSize: 58, vGap: 19, hGap: 27 },
});

/**
 * Wordmark size per lockup — the horizontal lockup needs a proportionally
 * larger wordmark than the vertical one, so this is not derivable from SIZES.
 *
 * Only the combinations below are offered, and the prop types enforce that:
 * the vertical lockup starts at 'md' (at 'sm' the wordmark would fall under
 * Cinzel's legibility floor on Android) and the horizontal lockup stops at
 * 'lg' (a 96px roundel beside a wordmark is wider than a phone wants).
 * Deliberately no extrapolated cells — an invented number here would be a
 * silent design decision.
 */
const WORDMARK_SIZE = Object.freeze({
  vertical: Object.freeze({ md: 11, lg: 14, xl: 21 }),
  horizontal: Object.freeze({ sm: 12, md: 13, lg: 20 }),
});

/**
 * Wordmark tracking, as a fraction of the wordmark's font size.
 *
 * The deck specifies 0.2–0.25em, but that was measured on the deck's own face.
 * Cinzel is a Trajan-derived inscriptional roman, and those are drawn with
 * substantially more built-in sidebearing than a didone — capitals already
 * spaced for monumental setting. Layering 0.22em on top produces the classic
 * over-tracked Trajan failure, where the word dissolves into nine separate
 * letters and stops reading as a name. 0.18em in Cinzel gives the same
 * PERCEIVED openness as 0.22em in a didone: we honour the deck's look rather
 * than its number.
 */
const WORDMARK_TRACKING_RATIO = 0.18;

/**
 * The P's horizontal optical nudge, as a fraction of its font size.
 *
 * A serif capital P has a tight left sidebearing (the stem's foot serif) and a
 * wide right one (empty space beneath the bowl), so centring its ADVANCE WIDTH
 * puts the visible ink left of true centre. Cinzel's inscriptional sidebearings
 * are generous but still asymmetric in the same direction.
 *
 * There is deliberately NO vertical nudge. Playfair needed -0.063em, derived
 * from ((ascent - descent) - capHeight) / 2 — a <Text> centres its em box, not
 * its cap. Cinzel's metrics (cap 0.700, ascent ~1.005, descent ~0.294) give
 * (0.700 + 0.294 - 1.005) / 2 = -0.0055em, i.e. 0.3px at the largest size we
 * ship: sub-pixel everywhere. That is not luck — a caps-designed face has its
 * vertical metrics drawn around the capitals, so its line box is already
 * near-symmetric about the cap. One less magic number to drift.
 */
const GLYPH_NUDGE_X_RATIO = 0.015;

interface BaseProps {
  size?: BrandmarkSize;
  /** 'auto' follows the theme. Force a ground when over an image or scrim. */
  ground?: BrandmarkGround;
  /**
   * Set when the brand name is already visible beside the mark, so a screen
   * reader does not announce "Privelier" twice.
   */
  decorative?: boolean;
  testID?: string;
  /** Outer container only — margins and layout. Never colors. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Deliberate NON-props, each of which is a drift vector — and a logo is the one
 * component where drift costs most:
 * - no `color`/`tint`: the token mapping is the brand rule, not a caller's call.
 * - no numeric size: named sizes or nothing.
 * - no `showWordmark`: that is what `lockup` is for; two ways to say one thing
 *   is how a component rots.
 * - no `onPress`: the Signet is never interactive. If it must be, the CALLER
 *   wraps it in a Pressable with its own role and label.
 * - no animation. A seal that moves is an app; a seal that sits still is a
 *   maison. (It also means reduced-motion has nothing to honour.)
 */
export type BrandmarkProps = BaseProps &
  (
    | { lockup?: 'mark' }
    | { lockup: 'vertical'; size?: 'md' | 'lg' | 'xl' }
    | { lockup: 'horizontal'; size?: 'sm' | 'md' | 'lg' }
  );

export default function Brandmark(props: BrandmarkProps) {
  const { size = 'lg', ground = 'auto', decorative = false, testID, style } = props;
  const lockup: BrandmarkLockup = props.lockup ?? 'mark';

  const { colors: themeColors, fonts } = useTheme();
  // Select a PALETTE, then read the same token names off it — never a hex
  // literal here, so the mapping stays exactly one rule.
  const colors =
    ground === 'auto' ? themeColors : ground === 'dark' ? darkPalette : lightPalette;

  const m = SIZES[size];
  // Outer ring, P and wordmark all take textPrimary: cream on dark (which is
  // the deck's white-ring-on-dark-card treatment) and near-black on light
  // (the deck's cream-ground artwork). The brass ring takes `accent` in BOTH
  // themes, never `accentText` — it is a border, not text, and the palette's
  // own note is that fills and borders keep the brand values.
  const ink = colors.textPrimary;

  const showWordmark = lockup !== 'mark';
  // Narrowed on the props union rather than indexed generically, so the type
  // system enforces the offered combinations (no vertical 'sm', no horizontal
  // 'xl') instead of us asserting past them.
  const wordmarkSize =
    props.lockup === 'vertical'
      ? WORDMARK_SIZE.vertical[props.size ?? 'lg']
      : props.lockup === 'horizontal'
        ? WORDMARK_SIZE.horizontal[props.size ?? 'lg']
        : 0;
  const tracking = round(wordmarkSize * WORDMARK_TRACKING_RATIO, 0.5);

  const roundel = (
    <View
      style={[
        styles.ring,
        {
          width: m.size,
          height: m.size,
          borderRadius: m.size / 2,
          borderWidth: m.outerRingWidth,
          borderColor: ink,
        },
      ]}
    >
      {/* The gap ring carries NO backgroundColor — the ground shows through. */}
      <View style={[styles.fillRing, { margin: m.gap }]}>
        <View
          style={[
            styles.fillRing,
            styles.roundedFully,
            { borderWidth: m.innerRingWidth, borderColor: colors.accent },
          ]}
        >
          <Text
            // A logo is a drawn object and must not reflow with Dynamic Type:
            // at 200% an unpinned P would overflow the ring. This is a
            // justified WCAG exception — no INFORMATION is lost, because the
            // brand name reaches assistive tech via the label on the root.
            allowFontScaling={false}
            accessible={false}
            importantForAccessibility="no"
            style={[
              styles.glyph,
              {
                fontFamily: fonts.logoSemiBold,
                fontSize: m.glyphSize,
                lineHeight: m.glyphSize,
                color: ink,
                transform: [{ translateX: round(m.glyphSize * GLYPH_NUDGE_X_RATIO, 0.5) }],
              },
            ]}
          >
            P
          </Text>
        </View>
      </View>
    </View>
  );

  const wordmark = showWordmark ? (
    <Text
      allowFontScaling={false}
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.wordmark,
        {
          fontFamily: fonts.logo,
          fontSize: wordmarkSize,
          lineHeight: wordmarkSize * 1.1,
          letterSpacing: tracking,
          color: ink,
          // React Native applies letterSpacing after the FINAL glyph too, so a
          // centred wordmark sits half a tracking-unit left of true centre.
          // This cancels it exactly. It is the single most common reason
          // wide-tracked wordmarks look subtly off in RN, and it is invisible
          // until you go looking for it.
          transform: [{ translateX: tracking / 2 }],
        },
      ]}
    >
      PRIVELIER
    </Text>
  ) : null;

  // The mark announces ONCE, as the brand — never as a stray "P", never twice.
  const a11y = decorative
    ? ({ accessible: false, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'image', accessibilityLabel: 'Privelier' } as const);

  return (
    <View
      {...a11y}
      testID={testID ?? 'brandmark'}
      style={[
        lockup === 'horizontal' ? styles.rowRoot : styles.columnRoot,
        showWordmark
          ? lockup === 'horizontal'
            ? { gap: m.hGap }
            : { gap: m.vGap }
          : null,
        style,
      ]}
    >
      {roundel}
      {wordmark}
    </View>
  );
}

/** Round to the nearest `step` (0.5 keeps hairlines crisp without mush). */
function round(value: number, step: number): number {
  return Math.round(value / step) * step;
}

const styles = StyleSheet.create({
  columnRoot: { alignItems: 'center' },
  rowRoot: { flexDirection: 'row', alignItems: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  // flex + alignSelf keeps every ring concentric by construction: one integer
  // (the margin) drives the inset, rather than a second hand-computed diameter.
  fillRing: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  roundedFully: { borderRadius: 9999 },
  glyph: {
    textAlign: 'center',
    // Android adds asymmetric font padding that would push the P off-centre
    // inside the ring. Required, not cosmetic.
    includeFontPadding: false,
  },
  wordmark: { includeFontPadding: false },
});
